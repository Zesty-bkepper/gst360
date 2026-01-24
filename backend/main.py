"""
GST360 Backend API - Business Management and Document Processing
With security hardening: Authentication, Authorization, Input Validation
"""
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database import init_db, get_db, Business, Document, OnboardingStatus, ExtractedInvoice
from models import (
    BusinessCreate, BusinessResponse, BusinessUpdate,
    OnboardingStatusUpdate, DocumentUpload, DocumentResponse,
    OnboardingProgress, DashboardStats, InvoiceConfirm
)
from agent import process_invoice
from storage import storage
from auth import (
    get_current_business, create_access_token, hash_password, verify_password,
    LoginRequest, LoginResponse, RegisterRequest, security
)
from security import validate_file_content, sanitize_string, sanitize_business_input

# Initialize FastAPI app
app = FastAPI(
    title="GST360 API",
    description="Backend API for GST360 - Business GST Compliance Platform",
    version="1.0.0"
)


# ==================== Security Middleware ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        # Remove server header
        if "server" in response.headers:
            del response.headers["server"]
        return response

app.add_middleware(SecurityHeadersMiddleware)


# CORS middleware - restricted to specific origins
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://gst360-alb-68296613.ap-south-1.elb.amazonaws.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ==================== Database Column for Password ====================
# Note: Run this migration to add password columns to businesses table
def add_password_columns():
    """Add password columns if they don't exist"""
    from sqlalchemy import text
    from database import engine
    columns = [
        ("password_hash", "VARCHAR(128)"),
        ("password_salt", "VARCHAR(64)"),
    ]
    with engine.connect() as conn:
        for col_name, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE businesses ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Migration note for businesses.{col_name}: {e}")


# Initialize database on startup
@app.on_event("startup")
def startup():
    init_db()
    add_password_columns()
    print("Database initialized successfully!")


# ==================== Auth Endpoints ====================

@app.post("/api/auth/register", response_model=LoginResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new business with password
    """
    # Sanitize inputs
    business_name = sanitize_string(request.business_name)

    # Check if GSTN already exists
    existing = db.query(Business).filter(Business.gstn == request.gstn).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business with this GSTN already exists")

    # Check if email already exists
    existing_email = db.query(Business).filter(Business.email == request.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password
    password_hash, password_salt = hash_password(request.password)

    # Create new business
    db_business = Business(
        business_name=business_name,
        email=request.email,
        phone=sanitize_string(request.phone) if request.phone else None,
        gstn=request.gstn.upper(),
        pan_card=request.pan_card.upper(),
        onboarding_status=OnboardingStatus.PENDING,
        onboarding_step=1
    )

    # Set password (using raw SQL since column may not be in model)
    db.add(db_business)
    db.commit()
    db.refresh(db_business)

    # Update password hash using raw SQL
    from sqlalchemy import text
    db.execute(
        text("UPDATE businesses SET password_hash = :hash, password_salt = :salt WHERE id = :id"),
        {"hash": password_hash, "salt": password_salt, "id": db_business.id}
    )
    db.commit()

    # Generate token
    access_token = create_access_token(db_business.id, db_business.email)

    return LoginResponse(
        access_token=access_token,
        business_id=db_business.id,
        business_name=db_business.business_name,
        expires_in=3600
    )


@app.post("/api/auth/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password
    """
    # Find business by email
    business = db.query(Business).filter(Business.email == request.email).first()
    if not business:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Get password hash and salt using raw SQL
    from sqlalchemy import text
    result = db.execute(
        text("SELECT password_hash, password_salt FROM businesses WHERE id = :id"),
        {"id": business.id}
    ).fetchone()

    if not result or not result[0] or not result[1]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    password_hash, password_salt = result[0], result[1]

    # Verify password
    if not verify_password(request.password, password_hash, password_salt):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not business.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Generate token
    access_token = create_access_token(business.id, business.email)

    return LoginResponse(
        access_token=access_token,
        business_id=business.id,
        business_name=business.business_name,
        expires_in=3600
    )


@app.get("/api/auth/me", response_model=BusinessResponse)
def get_current_user(current_business: Business = Depends(get_current_business)):
    """
    Get current authenticated business info
    """
    return current_business


# ==================== Business Endpoints ====================

@app.post("/api/businesses", response_model=BusinessResponse, status_code=201)
def create_business(business: BusinessCreate, db: Session = Depends(get_db)):
    """
    Register a new business (Legacy endpoint - use /api/auth/register instead)
    """
    # Sanitize inputs
    business_name = sanitize_string(business.business_name)

    # Check if GSTN already exists
    existing = db.query(Business).filter(Business.gstn == business.gstn).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business with this GSTN already exists")

    # Check if email already exists
    existing_email = db.query(Business).filter(Business.email == business.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new business with sanitized inputs
    db_business = Business(
        business_name=business_name,
        email=business.email,
        phone=sanitize_string(business.phone) if business.phone else None,
        gstn=business.gstn.upper(),
        pan_card=business.pan_card.upper(),
        iec_code=sanitize_string(business.iec_code) if business.iec_code else None,
        is_pan_india=business.is_pan_india,
        selected_states=business.selected_states,
        annual_turnover=business.annual_turnover,
        onboarding_status=OnboardingStatus.PENDING,
        onboarding_step=1
    )

    db.add(db_business)
    db.commit()
    db.refresh(db_business)

    return db_business


@app.get("/api/businesses", response_model=List[BusinessResponse])
def list_businesses(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    List businesses - returns only the authenticated business (no mass exposure)
    """
    # Only return the authenticated business (prevent mass data exposure)
    return [current_business]


@app.get("/api/businesses/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Get a specific business by ID (IDOR protected)
    """
    # IDOR Protection: Can only access own business
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return current_business


@app.get("/api/businesses/gstn/{gstn}", response_model=BusinessResponse)
def get_business_by_gstn(
    gstn: str,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Get a specific business by GSTN (IDOR protected)
    """
    # IDOR Protection: Can only access own business
    if gstn.upper() != current_business.gstn:
        raise HTTPException(status_code=403, detail="Access denied")

    return current_business


@app.patch("/api/businesses/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    updates: BusinessUpdate,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Update business information (IDOR protected)
    """
    # IDOR Protection: Can only update own business
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Sanitize string inputs
    update_data = updates.model_dump(exclude_unset=True)
    sanitized_data = sanitize_business_input(update_data)

    for field, value in sanitized_data.items():
        setattr(current_business, field, value)

    db.commit()
    db.refresh(current_business)
    return current_business


@app.patch("/api/businesses/{business_id}/onboarding", response_model=BusinessResponse)
def update_onboarding_status(
    business_id: int,
    status_update: OnboardingStatusUpdate,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Update business onboarding status (IDOR protected)
    """
    # IDOR Protection
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    current_business.onboarding_status = status_update.onboarding_status

    if status_update.onboarding_step:
        current_business.onboarding_step = status_update.onboarding_step

    if status_update.onboarding_status == OnboardingStatus.VERIFIED.value:
        current_business.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(current_business)
    return current_business


@app.get("/api/businesses/{business_id}/onboarding-progress", response_model=OnboardingProgress)
def get_onboarding_progress(
    business_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Get detailed onboarding progress for a business (IDOR protected)
    """
    # IDOR Protection
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    steps = ["Registration", "Document Upload", "Verification", "Activation"]
    completed_steps = steps[:current_business.onboarding_step]

    next_actions = {
        OnboardingStatus.PENDING.value: "Upload required documents",
        OnboardingStatus.DOCUMENTS_UPLOADED.value: "Awaiting verification",
        OnboardingStatus.VERIFICATION_IN_PROGRESS.value: "Verification in progress",
        OnboardingStatus.VERIFIED.value: "Complete account activation",
        OnboardingStatus.ACTIVE.value: "Account is active",
        OnboardingStatus.SUSPENDED.value: "Contact support"
    }

    return OnboardingProgress(
        current_step=current_business.onboarding_step,
        total_steps=4,
        status=current_business.onboarding_status.value if hasattr(current_business.onboarding_status, 'value') else current_business.onboarding_status,
        steps_completed=completed_steps,
        next_action=next_actions.get(
            current_business.onboarding_status.value if hasattr(current_business.onboarding_status, 'value') else current_business.onboarding_status,
            "Unknown"
        )
    )


# ==================== Document Endpoints ====================

@app.post("/api/businesses/{business_id}/documents", response_model=DocumentUpload)
async def upload_document(
    business_id: int,
    file: UploadFile = File(...),
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Upload a document (invoice/receipt) for a business.
    Validates file content using magic bytes, not just MIME type.
    """
    # IDOR Protection: Can only upload to own business
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file content using magic bytes (not just MIME type)
    is_valid, detected_type, error = validate_file_content(content, file.content_type)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Sanitize filename (remove path traversal attempts)
    safe_filename = Path(file.filename).name
    if not safe_filename or safe_filename.startswith('.'):
        safe_filename = f"upload_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Save using storage abstraction (local + optional S3)
    file_path = storage().save(content, safe_filename, business_id)

    # Create database record with detected type (not claimed type)
    db_document = Document(
        business_id=business_id,
        filename=safe_filename,
        file_type=detected_type,
        file_size=file_size,
        file_path=file_path,
        status="pending"
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # Update business onboarding status if first document
    if current_business.onboarding_status == OnboardingStatus.PENDING:
        current_business.onboarding_status = OnboardingStatus.DOCUMENTS_UPLOADED
        current_business.onboarding_step = 2
        db.commit()

    return db_document


@app.get("/api/businesses/{business_id}/documents", response_model=List[DocumentResponse])
def list_documents(
    business_id: int,
    status: Optional[str] = None,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    List all documents for a business (IDOR protected)
    """
    # IDOR Protection
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(Document).filter(Document.business_id == business_id)

    if status:
        query = query.filter(Document.status == status)

    documents = query.order_by(Document.uploaded_at.desc()).all()
    return documents


@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Get a specific document by ID (IDOR protected)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # IDOR Protection: Can only access own documents
    if document.business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return document


@app.get("/api/documents/{document_id}/file")
def get_document_file(
    document_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Serve the actual document file (IDOR protected)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # IDOR Protection: Can only access own documents
    if document.business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        media_type=document.file_type,
        filename=document.filename
    )


@app.patch("/api/documents/{document_id}/process")
def process_document_endpoint(
    document_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Process document using LangGraph + Anthropic Vision (IDOR protected)
    Extracts GST-compliant invoice data and classifies supply type (B2B/B2C)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # IDOR Protection: Can only process own documents
    if document.business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update status to processing
    document.status = "processing"
    db.commit()

    try:
        # Process with LangGraph agent
        result = process_invoice(document.file_path, document.file_type)

        if result.get("error"):
            document.status = "error"
            document.extracted_data = {"error": result["error"]}
            db.commit()
            return {"message": f"Processing failed: {result['error']}", "document_id": document_id}

        # Update document with extracted GST compliance data
        document.status = "completed"
        document.processed_at = datetime.utcnow()

        # GST Compliance Fields
        document.invoice_number = result.get("invoice_number") or result.get("invoice_id")
        document.place_of_supply = result.get("place_of_supply")
        document.customer_gstin = result.get("customer_gstin")
        document.party_name = result.get("party_name")
        document.taxable_value = result.get("taxable_value")
        document.cgst = result.get("cgst")
        document.sgst = result.get("sgst")
        document.igst = result.get("igst")
        document.state_code = result.get("state_code")
        document.gst_rate = result.get("gst_rate")
        document.gst_cess = result.get("gst_cess")
        document.total_invoice_value = result.get("total_invoice_value")
        document.type_of_supply = result.get("type_of_supply")

        # Legacy fields (backward compatibility)
        document.gst_amount = result.get("amount") or str(result.get("total_invoice_value", ""))
        document.extracted_data = result.get("raw_response")

        # Parse and set invoice date
        if result.get("date"):
            try:
                document.invoice_date = datetime.strptime(result["date"], "%Y-%m-%d")
            except:
                pass

        db.commit()

        # Also save to extracted_invoices table with full GST data
        invoice_date = None
        if result.get("date"):
            try:
                invoice_date = datetime.strptime(result["date"], "%Y-%m-%d")
            except:
                pass

        extracted = ExtractedInvoice(
            document_id=document_id,
            business_id=document.business_id,
            # GST Compliance Fields
            date=invoice_date,
            invoice_number=result.get("invoice_number") or result.get("invoice_id"),
            place_of_supply=result.get("place_of_supply"),
            customer_gstin=result.get("customer_gstin"),
            party_name=result.get("party_name"),
            taxable_value=result.get("taxable_value"),
            cgst=result.get("cgst"),
            sgst=result.get("sgst"),
            igst=result.get("igst"),
            state_code=result.get("state_code"),
            gst_rate=result.get("gst_rate"),
            gst_cess=result.get("gst_cess"),
            total_invoice_value=result.get("total_invoice_value"),
            type_of_supply=result.get("type_of_supply"),
            # Legacy fields
            invoice_id=result.get("invoice_number") or result.get("invoice_id"),
            amount=result.get("amount"),
            # Metadata
            confidence=result.get("confidence"),
            raw_response=result.get("raw_response"),
        )
        db.add(extracted)
        db.commit()

        return {
            "message": "Document processed successfully",
            "document_id": document_id,
            "type_of_supply": result.get("type_of_supply"),
            "extracted": {
                "invoice_number": result.get("invoice_number"),
                "date": result.get("date"),
                "place_of_supply": result.get("place_of_supply"),
                "customer_gstin": result.get("customer_gstin"),
                "party_name": result.get("party_name"),
                "taxable_value": result.get("taxable_value"),
                "cgst": result.get("cgst"),
                "sgst": result.get("sgst"),
                "igst": result.get("igst"),
                "state_code": result.get("state_code"),
                "gst_rate": result.get("gst_rate"),
                "gst_cess": result.get("gst_cess"),
                "total_invoice_value": result.get("total_invoice_value"),
                "type_of_supply": result.get("type_of_supply"),
                "confidence": result.get("confidence")
            }
        }

    except Exception as e:
        document.status = "error"
        document.extracted_data = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Delete a document from storage and database (IDOR protected)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # IDOR Protection: Can only delete own documents
    if document.business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete file from storage (local + S3 if configured)
    storage().delete(document.file_path)

    # Delete from extracted_invoices if exists
    db.query(ExtractedInvoice).filter(ExtractedInvoice.document_id == document_id).delete()

    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


@app.get("/api/extracted-invoices")
def list_extracted_invoices(
    skip: int = 0,
    limit: int = 100,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    List extracted invoices for authenticated business only (IDOR protected)
    """
    # Only return invoices for authenticated business
    query = db.query(ExtractedInvoice).filter(
        ExtractedInvoice.business_id == current_business.id
    )

    invoices = query.order_by(ExtractedInvoice.created_at.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": inv.id,
            "document_id": inv.document_id,
            "business_id": inv.business_id,
            "date": inv.date.strftime("%Y-%m-%d") if inv.date else None,
            "invoice_number": inv.invoice_number,
            "place_of_supply": inv.place_of_supply,
            "customer_gstin": inv.customer_gstin,
            "party_name": inv.party_name,
            "taxable_value": inv.taxable_value,
            "cgst": inv.cgst,
            "sgst": inv.sgst,
            "igst": inv.igst,
            "state_code": inv.state_code,
            "gst_rate": inv.gst_rate,
            "gst_cess": inv.gst_cess,
            "total_invoice_value": inv.total_invoice_value,
            "type_of_supply": inv.type_of_supply,
            "confidence": inv.confidence,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv in invoices
    ]


@app.patch("/api/documents/{document_id}/confirm")
def confirm_invoice_data(
    document_id: int,
    data: InvoiceConfirm,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Confirm or update extracted invoice data (IDOR protected)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # IDOR Protection: Can only confirm own documents
    if document.business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update document with confirmed/edited values
    if data.invoice_number is not None:
        document.invoice_number = data.invoice_number
    if data.gst_amount is not None:
        document.gst_amount = data.gst_amount
    if data.invoice_date is not None:
        try:
            document.invoice_date = datetime.strptime(data.invoice_date, "%Y-%m-%d")
        except ValueError:
            pass

    # Mark as verified by setting a flag in extracted_data
    if document.extracted_data:
        document.extracted_data["verified"] = True
        document.extracted_data["verified_at"] = datetime.utcnow().isoformat()
    else:
        document.extracted_data = {"verified": True, "verified_at": datetime.utcnow().isoformat()}

    # Flag the JSON column as modified for SQLAlchemy to detect the change
    flag_modified(document, "extracted_data")

    db.commit()

    # Update extracted_invoices table if exists
    extracted = db.query(ExtractedInvoice).filter(
        ExtractedInvoice.document_id == document_id
    ).first()

    if extracted:
        if data.invoice_number is not None:
            extracted.invoice_id = data.invoice_number
        if data.gst_amount is not None:
            extracted.amount = data.gst_amount
        if data.invoice_date is not None:
            try:
                extracted.date = datetime.strptime(data.invoice_date, "%Y-%m-%d")
            except ValueError:
                pass
        db.commit()

    return {
        "message": "Invoice data confirmed successfully",
        "document_id": document_id,
        "invoice_number": document.invoice_number,
        "gst_amount": document.gst_amount,
        "invoice_date": document.invoice_date.isoformat() if document.invoice_date else None
    }


# ==================== Dashboard Endpoints ====================

@app.get("/api/businesses/{business_id}/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    business_id: int,
    current_business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """
    Get dashboard statistics for a business (IDOR protected)
    """
    # IDOR Protection
    if business_id != current_business.id:
        raise HTTPException(status_code=403, detail="Access denied")

    documents = db.query(Document).filter(Document.business_id == current_business.id).all()

    total = len(documents)
    processed = len([d for d in documents if d.status == "completed"])
    pending = len([d for d in documents if d.status in ["pending", "processing"]])

    # Calculate total GST
    total_gst = 0
    for doc in documents:
        if doc.gst_amount:
            # Parse GST amount (remove ₹ and commas)
            try:
                amount = float(doc.gst_amount.replace("₹", "").replace(",", ""))
                total_gst += amount
            except:
                pass

    last_upload = None
    if documents:
        last_upload = max(d.uploaded_at for d in documents)

    return DashboardStats(
        total_documents=total,
        processed_documents=processed,
        pending_documents=pending,
        total_gst=f"₹{total_gst:,.2f}",
        last_upload=last_upload
    )


# ==================== Debug Endpoint (temporary) ====================

DEBUG_SECRET = os.getenv("DEBUG_SECRET", "gst360-debug-temp-key")

@app.get("/api/debug/schema")
def debug_schema(secret: str, db: Session = Depends(get_db)):
    """
    Check actual database schema on production.
    """
    if secret != DEBUG_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    from sqlalchemy import text, inspect
    from database import engine

    inspector = inspect(engine)

    tables = {}
    for table_name in ['businesses', 'documents', 'extracted_invoices']:
        columns = inspector.get_columns(table_name)
        tables[table_name] = [
            {"name": col['name'], "type": str(col['type'])}
            for col in columns
        ]

    return {"database": str(engine.url).split('@')[-1], "tables": tables}


@app.get("/api/debug/tables")
def debug_tables(secret: str, db: Session = Depends(get_db)):
    """
    Temporary debug endpoint to view table contents.
    Requires secret key. Remove in production.
    """
    if secret != DEBUG_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    businesses = db.query(Business).limit(10).all()
    documents = db.query(Document).order_by(Document.id.desc()).limit(10).all()
    invoices = db.query(ExtractedInvoice).order_by(ExtractedInvoice.id.desc()).limit(10).all()

    # Get total counts
    total_businesses = db.query(Business).count()
    total_documents = db.query(Document).count()
    total_invoices = db.query(ExtractedInvoice).count()

    return {
        "counts": {
            "businesses": total_businesses,
            "documents": total_documents,
            "extracted_invoices": total_invoices
        },
        "businesses": [
            {"id": b.id, "name": b.business_name, "email": b.email, "gstn": b.gstn,
             "pan": b.pan_card, "status": str(b.onboarding_status), "created_at": str(b.created_at)}
            for b in businesses
        ],
        "documents": [
            {"id": d.id, "filename": d.filename, "status": d.status, "business_id": d.business_id,
             "type": d.file_type, "invoice_number": d.invoice_number, "uploaded_at": str(d.uploaded_at)}
            for d in documents
        ],
        "extracted_invoices": [
            {
                "id": i.id,
                "document_id": i.document_id,
                "business_id": i.business_id,
                "invoice_number": i.invoice_number,
                "date": str(i.date) if i.date else None,
                "place_of_supply": i.place_of_supply,
                "customer_gstin": i.customer_gstin,
                "party_name": i.party_name,
                "taxable_value": i.taxable_value,
                "cgst": i.cgst,
                "sgst": i.sgst,
                "igst": i.igst,
                "state_code": i.state_code,
                "gst_rate": i.gst_rate,
                "total_invoice_value": i.total_invoice_value,
                "type_of_supply": i.type_of_supply,
                "confidence": i.confidence,
                "created_at": str(i.created_at) if i.created_at else None
            }
            for i in invoices
        ]
    }


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "gst360-api"}


@app.get("/")
def root():
    """Root endpoint with API info"""
    return {
        "name": "GST360 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
