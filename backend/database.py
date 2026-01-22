"""
Database configuration and models for GST360 Business Management
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import enum

# Support both SQLite (dev) and PostgreSQL (production)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gst360.db")

# Configure engine based on database type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class OnboardingStatus(str, enum.Enum):
    PENDING = "pending"
    DOCUMENTS_UPLOADED = "documents_uploaded"
    VERIFICATION_IN_PROGRESS = "verification_in_progress"
    VERIFIED = "verified"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class TurnoverRange(str, enum.Enum):
    UPTO_20L = "Up to ₹20 Lakhs"
    L20_TO_1CR = "₹20 Lakhs - ₹1 Crore"
    CR1_TO_5CR = "₹1 Crore - ₹5 Crore"
    CR5_TO_10CR = "₹5 Crore - ₹10 Crore"
    CR10_TO_50CR = "₹10 Crore - ₹50 Crore"
    CR50_TO_100CR = "₹50 Crore - ₹100 Crore"
    ABOVE_100CR = "Above ₹100 Crore"


class Business(Base):
    """
    Business entity table - stores all registered businesses
    """
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Business Information
    business_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=True)

    # Tax Information
    gstn = Column(String(15), nullable=False, unique=True, index=True)  # GST Number
    pan_card = Column(String(10), nullable=False, index=True)  # PAN Card
    iec_code = Column(String(10), nullable=True)  # Import Export Code (optional)

    # Location Information
    is_pan_india = Column(Boolean, default=False)
    selected_states = Column(JSON, default=list)  # List of state names

    # Financial Information
    annual_turnover = Column(String(50), nullable=True)

    # Onboarding Status
    onboarding_status = Column(
        SQLEnum(OnboardingStatus),
        default=OnboardingStatus.PENDING
    )
    onboarding_step = Column(Integer, default=1)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)

    # Additional fields
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<Business(id={self.id}, name='{self.business_name}', gstn='{self.gstn}')>"


class Document(Base):
    """
    Documents uploaded by businesses (invoices, receipts, etc.)
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    business_id = Column(Integer, nullable=False, index=True)

    # Document Information
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, image/jpeg, etc.
    file_size = Column(Integer, nullable=False)  # in bytes
    file_path = Column(String(500), nullable=False)

    # Processing Status
    status = Column(String(50), default="pending")  # pending, processing, completed, error

    # Extracted Data (from OCR/AI processing)
    extracted_data = Column(JSON, nullable=True)
    gst_amount = Column(String(50), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    invoice_date = Column(DateTime, nullable=True)
    vendor_name = Column(String(255), nullable=True)

    # Metadata
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', status='{self.status}')>"


class ExtractedInvoice(Base):
    """
    Extracted invoice data from vision model processing
    Simple 3-column schema: invoice_id, amount, date
    """
    __tablename__ = "extracted_invoices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, nullable=False, index=True)  # FK to documents table
    business_id = Column(Integer, nullable=False, index=True)

    # Core extracted fields
    invoice_id = Column(String(100), nullable=True, index=True)  # Invoice number from document
    amount = Column(String(50), nullable=True)  # Total amount (stored as string to preserve formatting)
    date = Column(DateTime, nullable=True)  # Invoice date

    # Additional metadata
    confidence = Column(String(10), nullable=True)  # Extraction confidence score
    raw_response = Column(JSON, nullable=True)  # Full LLM response for debugging
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ExtractedInvoice(id={self.id}, invoice_id='{self.invoice_id}', amount='{self.amount}')>"


def init_db():
    """Initialize the database and create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
