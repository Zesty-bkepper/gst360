"""
Security utilities for GST360
- File validation (magic bytes)
- XSS sanitization
- Input validation
"""
import html
import re
from typing import Optional

# Magic bytes for allowed file types
FILE_SIGNATURES = {
    # JPEG
    b'\xff\xd8\xff\xe0': 'image/jpeg',
    b'\xff\xd8\xff\xe1': 'image/jpeg',
    b'\xff\xd8\xff\xe2': 'image/jpeg',
    b'\xff\xd8\xff\xe3': 'image/jpeg',
    b'\xff\xd8\xff\xdb': 'image/jpeg',
    # PNG
    b'\x89PNG\r\n\x1a\n': 'image/png',
    # GIF
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    # PDF
    b'%PDF-': 'application/pdf',
    # WebP
    b'RIFF': 'image/webp',  # WebP starts with RIFF, need to check further
}

ALLOWED_MIME_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
}

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def validate_file_content(file_content: bytes, claimed_type: str) -> tuple[bool, str, Optional[str]]:
    """
    Validate file content using magic bytes.

    Returns:
        tuple: (is_valid, detected_type, error_message)
    """
    if len(file_content) < 8:
        return False, "", "File too small to validate"

    if len(file_content) > MAX_FILE_SIZE:
        return False, "", f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB"

    # Check magic bytes
    detected_type = None

    # Check for PDF
    if file_content[:5] == b'%PDF-':
        detected_type = 'application/pdf'

    # Check for PNG
    elif file_content[:8] == b'\x89PNG\r\n\x1a\n':
        detected_type = 'image/png'

    # Check for JPEG
    elif file_content[:2] == b'\xff\xd8':
        detected_type = 'image/jpeg'

    # Check for GIF
    elif file_content[:6] in (b'GIF87a', b'GIF89a'):
        detected_type = 'image/gif'

    # Check for WebP (RIFF....WEBP)
    elif file_content[:4] == b'RIFF' and file_content[8:12] == b'WEBP':
        detected_type = 'image/webp'

    if detected_type is None:
        return False, "", "Unknown or unsupported file type. Allowed: PDF, JPEG, PNG, GIF, WebP"

    if detected_type not in ALLOWED_MIME_TYPES:
        return False, detected_type, f"File type {detected_type} not allowed"

    # Check for embedded PHP/script content in images (polyglot detection)
    dangerous_patterns = [
        b'<?php',
        b'<?=',
        b'<script',
        b'javascript:',
        b'onerror=',
        b'onload=',
    ]

    for pattern in dangerous_patterns:
        if pattern in file_content.lower() if isinstance(file_content, bytes) else pattern.lower() in file_content:
            # Check case-insensitive
            if pattern.lower() in file_content.lower():
                return False, detected_type, "File contains potentially malicious content"

    return True, detected_type, None


def sanitize_string(value: str) -> str:
    """
    Sanitize string input to prevent XSS.
    Escapes HTML special characters.
    """
    if value is None:
        return None
    return html.escape(str(value), quote=True)


def sanitize_business_input(data: dict) -> dict:
    """
    Sanitize all string fields in business input.
    """
    string_fields = ['business_name', 'phone', 'notes', 'iec_code']
    sanitized = data.copy()

    for field in string_fields:
        if field in sanitized and sanitized[field]:
            sanitized[field] = sanitize_string(sanitized[field])

    return sanitized


def validate_gstn(gstn: str) -> bool:
    """
    Validate GSTN format.
    Format: 2 digits state code + 10 char PAN + 1 entity code + 1 Z + 1 checksum
    Example: 27AADCT2893E1ZC
    """
    if not gstn or len(gstn) != 15:
        return False

    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$'
    return bool(re.match(pattern, gstn.upper()))


def validate_pan(pan: str) -> bool:
    """
    Validate PAN card format.
    Format: 5 letters + 4 digits + 1 letter
    Example: AADCT2893E
    """
    if not pan or len(pan) != 10:
        return False

    pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    return bool(re.match(pattern, pan.upper()))
