"""
Pydantic models for API request/response validation
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class BusinessCreate(BaseModel):
    """Schema for creating a new business during signup"""
    business_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = None
    gstn: str = Field(..., min_length=15, max_length=15)
    pan_card: str = Field(..., min_length=10, max_length=10)
    iec_code: Optional[str] = Field(None, max_length=10)
    is_pan_india: bool = False
    selected_states: List[str] = []
    annual_turnover: Optional[str] = None

    @field_validator('gstn')
    @classmethod
    def validate_gstn(cls, v):
        """Validate GST Number format: 22AAAAA0000A1Z5"""
        pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if not re.match(pattern, v.upper()):
            raise ValueError('Invalid GSTN format. Expected format: 22AAAAA0000A1Z5')
        return v.upper()

    @field_validator('pan_card')
    @classmethod
    def validate_pan(cls, v):
        """Validate PAN Card format: ABCDE1234F"""
        pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
        if not re.match(pattern, v.upper()):
            raise ValueError('Invalid PAN format. Expected format: ABCDE1234F')
        return v.upper()

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        """Validate phone number"""
        if v is None:
            return v
        # Remove spaces and special characters
        cleaned = re.sub(r'[\s\-\(\)\+]', '', v)
        if len(cleaned) < 10 or len(cleaned) > 13:
            raise ValueError('Phone number must be 10-13 digits')
        return v

    @field_validator('selected_states')
    @classmethod
    def validate_states(cls, v, info):
        """Ensure states are selected if not PAN India"""
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "business_name": "XYZ Enterprises Pvt Ltd",
                "email": "contact@xyz.com",
                "phone": "+91 98765 43210",
                "gstn": "27AABCU9603R1ZM",
                "pan_card": "AABCU9603R",
                "iec_code": "AAAAAAA000",
                "is_pan_india": False,
                "selected_states": ["Maharashtra", "Gujarat", "Karnataka"],
                "annual_turnover": "₹1 Crore - ₹5 Crore"
            }
        }


class BusinessResponse(BaseModel):
    """Schema for business response"""
    id: int
    business_name: str
    email: str
    phone: Optional[str]
    gstn: str
    pan_card: str
    iec_code: Optional[str]
    is_pan_india: bool
    selected_states: List[str]
    annual_turnover: Optional[str]
    onboarding_status: str
    onboarding_step: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class BusinessUpdate(BaseModel):
    """Schema for updating business information"""
    business_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_pan_india: Optional[bool] = None
    selected_states: Optional[List[str]] = None
    annual_turnover: Optional[str] = None


class OnboardingStatusUpdate(BaseModel):
    """Schema for updating onboarding status"""
    onboarding_status: str
    onboarding_step: Optional[int] = None


class DocumentUpload(BaseModel):
    """Schema for document upload response"""
    id: int
    business_id: int
    filename: str
    file_type: str
    file_size: int
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    """Schema for detailed document response"""
    id: int
    business_id: int
    filename: str
    file_type: str
    file_size: int
    status: str
    extracted_data: Optional[dict]
    gst_amount: Optional[str]
    invoice_number: Optional[str]
    invoice_date: Optional[datetime]
    vendor_name: Optional[str]
    uploaded_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


class OnboardingProgress(BaseModel):
    """Schema for onboarding progress"""
    current_step: int
    total_steps: int
    status: str
    steps_completed: List[str]
    next_action: str


class DashboardStats(BaseModel):
    """Schema for dashboard statistics"""
    total_documents: int
    processed_documents: int
    pending_documents: int
    total_gst: str
    last_upload: Optional[datetime]


class InvoiceConfirm(BaseModel):
    """Schema for confirming/updating extracted invoice data"""
    invoice_number: Optional[str] = None
    gst_amount: Optional[str] = None
    invoice_date: Optional[str] = None
