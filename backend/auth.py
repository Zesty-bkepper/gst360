"""
Authentication module for GST360
JWT-based authentication with password hashing
"""
import os
from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db, Business

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Security scheme
security = HTTPBearer()


class TokenData(BaseModel):
    business_id: int
    email: str
    exp: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    business_id: int
    business_name: str
    expires_in: int


class RegisterRequest(BaseModel):
    business_name: str
    email: EmailStr
    password: str
    gstn: str
    pan_card: str
    phone: Optional[str] = None


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash password with salt using SHA-256"""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verify password against hash"""
    check_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(check_hash, hashed)


def create_access_token(business_id: int, email: str) -> str:
    """Create JWT access token"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "business_id": business_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(
            business_id=payload["business_id"],
            email=payload["email"],
            exp=datetime.fromtimestamp(payload["exp"])
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_business(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Business:
    """
    Dependency to get the current authenticated business.
    Use this to protect endpoints.
    """
    token_data = decode_token(credentials.credentials)

    business = db.query(Business).filter(Business.id == token_data.business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Business not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not business.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business account is deactivated"
        )

    return business


def get_optional_business(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[Business]:
    """
    Optional authentication - returns None if no token provided.
    Use for endpoints that work differently for authenticated vs anonymous users.
    """
    if credentials is None:
        return None

    try:
        return get_current_business(credentials, db)
    except HTTPException:
        return None
