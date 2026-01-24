"""
Storage Abstraction Layer

Supports both local filesystem and AWS S3 storage.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, BinaryIO
from abc import ABC, abstractmethod
from datetime import datetime

# Storage configuration
STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local")  # "local" or "s3"
LOCAL_UPLOAD_DIR = Path(os.environ.get("LOCAL_UPLOAD_DIR", "uploads"))
AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "gst360-invoices")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")


class StorageBackend(ABC):
    """Abstract base class for storage backends"""

    @abstractmethod
    def save(self, file_content: bytes, filename: str, business_id: int) -> str:
        """Save file and return the storage path/key"""
        pass

    @abstractmethod
    def get(self, path: str) -> bytes:
        """Get file content by path"""
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """Delete file by path"""
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """Check if file exists"""
        pass

    @abstractmethod
    def get_url(self, path: str) -> str:
        """Get URL/path for file access"""
        pass


class LocalStorage(StorageBackend):
    """Local filesystem storage"""

    def __init__(self, base_dir: Path = LOCAL_UPLOAD_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file_content: bytes, filename: str, business_id: int) -> str:
        # Create business directory
        business_dir = self.base_dir / str(business_id)
        business_dir.mkdir(exist_ok=True)

        # Generate unique filename
        file_ext = Path(filename).suffix
        unique_name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{file_ext}"
        file_path = business_dir / unique_name

        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)

        return str(file_path)

    def get(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def delete(self, path: str) -> bool:
        try:
            if os.path.exists(path):
                os.remove(path)
                return True
            return False
        except Exception:
            return False

    def exists(self, path: str) -> bool:
        return os.path.exists(path)

    def get_url(self, path: str) -> str:
        return f"file://{os.path.abspath(path)}"


class S3Storage(StorageBackend):
    """AWS S3 storage"""

    def __init__(self, bucket: str = AWS_S3_BUCKET, region: str = AWS_REGION):
        self.bucket = bucket
        self.region = region
        self._client = None

    @property
    def client(self):
        if self._client is None:
            import boto3
            # Use default credential chain (works with IAM roles in ECS/Lambda)
            self._client = boto3.client(
                "s3",
                region_name=self.region,
            )
        return self._client

    def save(self, file_content: bytes, filename: str, business_id: int) -> str:
        # Generate S3 key
        file_ext = Path(filename).suffix
        unique_name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{file_ext}"
        s3_key = f"invoices/{business_id}/{unique_name}"

        # Upload to S3
        self.client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=file_content,
            ContentType=self._get_content_type(file_ext),
        )

        return s3_key

    def get(self, path: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=path)
        return response["Body"].read()

    def delete(self, path: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=path)
            return True
        except Exception:
            return False

    def exists(self, path: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=path)
            return True
        except:
            return False

    def get_url(self, path: str) -> str:
        # Generate presigned URL for temporary access
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": path},
            ExpiresIn=3600,  # 1 hour
        )
        return url

    def _get_content_type(self, ext: str) -> str:
        content_types = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return content_types.get(ext.lower(), "application/octet-stream")


class HybridStorage(StorageBackend):
    """
    Hybrid storage - saves to both local and S3.
    Useful for development/transition period.
    """

    def __init__(self):
        self.local = LocalStorage()
        self.s3 = S3Storage() if self._s3_configured() else None

    def _s3_configured(self) -> bool:
        return bool(
            os.environ.get("AWS_ACCESS_KEY_ID") and
            os.environ.get("AWS_SECRET_ACCESS_KEY")
        )

    def save(self, file_content: bytes, filename: str, business_id: int) -> str:
        # Always save locally
        local_path = self.local.save(file_content, filename, business_id)

        # Also save to S3 if configured
        s3_key = None
        if self.s3:
            try:
                s3_key = self.s3.save(file_content, filename, business_id)
            except Exception as e:
                print(f"S3 upload failed (continuing with local): {e}")

        # Return local path (primary storage for now)
        return local_path

    def get(self, path: str) -> bytes:
        # Try local first
        if self.local.exists(path):
            return self.local.get(path)
        # Fall back to S3
        if self.s3 and self.s3.exists(path):
            return self.s3.get(path)
        raise FileNotFoundError(f"File not found: {path}")

    def delete(self, path: str) -> bool:
        local_deleted = self.local.delete(path)
        s3_deleted = self.s3.delete(path) if self.s3 else False
        return local_deleted or s3_deleted

    def exists(self, path: str) -> bool:
        return self.local.exists(path) or (self.s3 and self.s3.exists(path))

    def get_url(self, path: str) -> str:
        return self.local.get_url(path)


def get_storage() -> StorageBackend:
    """
    Factory function to get the appropriate storage backend.
    """
    backend = STORAGE_BACKEND.lower()

    if backend == "s3":
        return S3Storage()
    elif backend == "hybrid":
        return HybridStorage()
    else:  # default to local
        return LocalStorage()


# Global storage instance
_storage: Optional[StorageBackend] = None


def storage() -> StorageBackend:
    """Get the global storage instance"""
    global _storage
    if _storage is None:
        _storage = get_storage()
    return _storage
