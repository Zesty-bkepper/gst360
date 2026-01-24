"""
Database configuration and models for GST360 Business Management
Supports GST compliance with B2B/B2C classification.
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, JSON, Enum as SQLEnum, Float
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


class SupplyType(str, enum.Enum):
    """Type of supply classification for GST"""
    B2B = "B2B"              # Business to Business (buyer has GSTIN)
    B2C_SMALL = "B2C_SMALL"  # Business to Consumer, invoice < 20 lakhs
    B2C_LARGE = "B2C_LARGE"  # Business to Consumer, invoice >= 20 lakhs


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
    Extended with GST compliance fields.
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

    # GST Compliance Fields (matching Excel structure)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(DateTime, nullable=True)
    place_of_supply = Column(String(100), nullable=True)
    customer_gstin = Column(String(15), nullable=True, index=True)  # Buyer's GSTIN
    party_name = Column(String(255), nullable=True)  # Buyer/Customer name
    taxable_value = Column(Float, nullable=True)  # Amount before GST
    cgst = Column(Float, nullable=True)  # Central GST
    sgst = Column(Float, nullable=True)  # State GST
    igst = Column(Float, nullable=True)  # Integrated GST
    state_code = Column(String(2), nullable=True)  # State code (e.g., "27")
    gst_rate = Column(Float, nullable=True)  # GST rate percentage
    gst_cess = Column(Float, nullable=True)  # GST Cess
    total_invoice_value = Column(Float, nullable=True)  # Total including GST
    type_of_supply = Column(String(20), nullable=True)  # B2B, B2C_SMALL, B2C_LARGE

    # Legacy fields (for backward compatibility)
    gst_amount = Column(String(50), nullable=True)  # Formatted total amount
    vendor_name = Column(String(255), nullable=True)

    # Extracted Data (full JSON from AI)
    extracted_data = Column(JSON, nullable=True)

    # Metadata
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', status='{self.status}', type='{self.type_of_supply}')>"


class ExtractedInvoice(Base):
    """
    Extracted invoice data from vision model processing
    GST-compliant schema with B2B/B2C classification.
    """
    __tablename__ = "extracted_invoices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, nullable=False, index=True)  # FK to documents table
    business_id = Column(Integer, nullable=False, index=True)

    # GST Compliance Fields (matching Excel export structure)
    date = Column(DateTime, nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    place_of_supply = Column(String(100), nullable=True)
    customer_gstin = Column(String(15), nullable=True, index=True)  # Buyer's GSTIN
    party_name = Column(String(255), nullable=True)  # Buyer/Customer name
    taxable_value = Column(Float, nullable=True)
    cgst = Column(Float, nullable=True)
    sgst = Column(Float, nullable=True)
    igst = Column(Float, nullable=True)
    state_code = Column(String(2), nullable=True)
    gst_rate = Column(Float, nullable=True)
    gst_cess = Column(Float, nullable=True)
    total_invoice_value = Column(Float, nullable=True)
    type_of_supply = Column(String(20), nullable=True)  # B2B, B2C_SMALL, B2C_LARGE

    # Legacy fields (backward compatibility)
    invoice_id = Column(String(100), nullable=True)
    amount = Column(String(50), nullable=True)

    # Metadata
    confidence = Column(String(10), nullable=True)
    raw_response = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ExtractedInvoice(id={self.id}, invoice_number='{self.invoice_number}', type='{self.type_of_supply}')>"

    def to_excel_row(self) -> dict:
        """Convert to Excel export format"""
        return {
            "date": self.date.strftime("%d-%m-%Y") if self.date else None,
            "invoice number": self.invoice_number,
            "place of supply": self.place_of_supply,
            "GSTnumber (of customer)": self.customer_gstin,
            "party name": self.party_name,
            "Taxable value": self.taxable_value,
            "CGST": self.cgst,
            "SGST": self.sgst,
            "IGST": self.igst,
            "state code": self.state_code,
            "GST rate": self.gst_rate,
            "GST cess": self.gst_cess,
            "Type of supply": self.type_of_supply
        }


def init_db():
    """Initialize the database and create all tables"""
    Base.metadata.create_all(bind=engine)
    # Run migrations for existing tables
    run_migrations()


def run_migrations():
    """Run database migrations to add new columns to existing tables"""
    from sqlalchemy import text

    # Columns to add to documents table (if they don't exist)
    documents_columns = [
        ("place_of_supply", "VARCHAR(100)"),
        ("customer_gstin", "VARCHAR(15)"),
        ("party_name", "VARCHAR(255)"),
        ("taxable_value", "FLOAT"),
        ("cgst", "FLOAT"),
        ("sgst", "FLOAT"),
        ("igst", "FLOAT"),
        ("state_code", "VARCHAR(2)"),
        ("gst_rate", "FLOAT"),
        ("gst_cess", "FLOAT"),
        ("total_invoice_value", "FLOAT"),
        ("type_of_supply", "VARCHAR(20)"),
    ]

    # Columns to add to extracted_invoices table (if they don't exist)
    extracted_columns = [
        ("date", "TIMESTAMP"),
        ("invoice_number", "VARCHAR(100)"),
        ("place_of_supply", "VARCHAR(100)"),
        ("customer_gstin", "VARCHAR(15)"),
        ("party_name", "VARCHAR(255)"),
        ("taxable_value", "FLOAT"),
        ("cgst", "FLOAT"),
        ("sgst", "FLOAT"),
        ("igst", "FLOAT"),
        ("state_code", "VARCHAR(2)"),
        ("gst_rate", "FLOAT"),
        ("gst_cess", "FLOAT"),
        ("total_invoice_value", "FLOAT"),
        ("type_of_supply", "VARCHAR(20)"),
        ("invoice_id", "VARCHAR(100)"),
        ("amount", "VARCHAR(50)"),
        ("confidence", "VARCHAR(10)"),
        ("raw_response", "JSON"),
        ("created_at", "TIMESTAMP"),
    ]

    with engine.connect() as conn:
        # Add columns to documents table
        for col_name, col_type in documents_columns:
            try:
                conn.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                conn.commit()
            except Exception as e:
                # Column might already exist or other error
                conn.rollback()
                print(f"Migration note for documents.{col_name}: {e}")

        # Add columns to extracted_invoices table
        for col_name, col_type in extracted_columns:
            try:
                conn.execute(text(f"ALTER TABLE extracted_invoices ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Migration note for extracted_invoices.{col_name}: {e}")

    print("Database migrations completed!")


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
