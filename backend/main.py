"""
GST360 Backend API - Business Management and Document Processing
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

# Initialize FastAPI app
app = FastAPI(
    title="GST360 API",
    description="Backend API for GST360 - Business GST Compliance Platform",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup():
    init_db()
    print("Database initialized successfully!")


# ==================== Business Endpoints ====================

@app.post("/api/businesses", response_model=BusinessResponse, status_code=201)
def create_business(business: BusinessCreate, db: Session = Depends(get_db)):
    """
    Register a new business (Signup endpoint)
    """
    # Check if GSTN already exists
    existing = db.query(Business).filter(Business.gstn == business.gstn).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business with this GSTN already exists")

    # Check if email already exists
    existing_email = db.query(Business).filter(Business.email == business.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new business
    db_business = Business(
        business_name=business.business_name,
        email=business.email,
        phone=business.phone,
        gstn=business.gstn,
        pan_card=business.pan_card,
        iec_code=business.iec_code,
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
    db: Session = Depends(get_db)
):
    """
    List all registered businesses with optional filtering
    """
    query = db.query(Business)

    if status:
        query = query.filter(Business.onboarding_status == status)

    businesses = query.offset(skip).limit(limit).all()
    return businesses


@app.get("/api/businesses/{business_id}", response_model=BusinessResponse)
def get_business(business_id: int, db: Session = Depends(get_db)):
    """
    Get a specific business by ID
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@app.get("/api/businesses/gstn/{gstn}", response_model=BusinessResponse)
def get_business_by_gstn(gstn: str, db: Session = Depends(get_db)):
    """
    Get a specific business by GSTN
    """
    business = db.query(Business).filter(Business.gstn == gstn.upper()).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@app.patch("/api/businesses/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    updates: BusinessUpdate,
    db: Session = Depends(get_db)
):
    """
    Update business information
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business, field, value)

    db.commit()
    db.refresh(business)
    return business


@app.patch("/api/businesses/{business_id}/onboarding", response_model=BusinessResponse)
def update_onboarding_status(
    business_id: int,
    status_update: OnboardingStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Update business onboarding status
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    business.onboarding_status = status_update.onboarding_status

    if status_update.onboarding_step:
        business.onboarding_step = status_update.onboarding_step

    if status_update.onboarding_status == OnboardingStatus.VERIFIED.value:
        business.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(business)
    return business


@app.get("/api/businesses/{business_id}/onboarding-progress", response_model=OnboardingProgress)
def get_onboarding_progress(business_id: int, db: Session = Depends(get_db)):
    """
    Get detailed onboarding progress for a business
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    steps = ["Registration", "Document Upload", "Verification", "Activation"]
    completed_steps = steps[:business.onboarding_step]

    next_actions = {
        OnboardingStatus.PENDING.value: "Upload required documents",
        OnboardingStatus.DOCUMENTS_UPLOADED.value: "Awaiting verification",
        OnboardingStatus.VERIFICATION_IN_PROGRESS.value: "Verification in progress",
        OnboardingStatus.VERIFIED.value: "Complete account activation",
        OnboardingStatus.ACTIVE.value: "Account is active",
        OnboardingStatus.SUSPENDED.value: "Contact support"
    }

    return OnboardingProgress(
        current_step=business.onboarding_step,
        total_steps=4,
        status=business.onboarding_status.value if hasattr(business.onboarding_status, 'value') else business.onboarding_status,
        steps_completed=completed_steps,
        next_action=next_actions.get(
            business.onboarding_status.value if hasattr(business.onboarding_status, 'value') else business.onboarding_status,
            "Unknown"
        )
    )


# ==================== Document Endpoints ====================

@app.post("/api/businesses/{business_id}/documents", response_model=DocumentUpload)
async def upload_document(
    business_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a document (invoice/receipt) for a business.
    Saves to local filesystem and optionally to AWS S3.
    """
    # Verify business exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Allowed: PDF, JPEG, PNG, GIF, WebP"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Save using storage abstraction (local + optional S3)
    file_path = storage().save(content, file.filename, business_id)

    # Create database record
    db_document = Document(
        business_id=business_id,
        filename=file.filename,
        file_type=file.content_type,
        file_size=file_size,
        file_path=file_path,
        status="pending"
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # Update business onboarding status if first document
    if business.onboarding_status == OnboardingStatus.PENDING:
        business.onboarding_status = OnboardingStatus.DOCUMENTS_UPLOADED
        business.onboarding_step = 2
        db.commit()

    return db_document


@app.get("/api/businesses/{business_id}/documents", response_model=List[DocumentResponse])
def list_documents(
    business_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all documents for a business
    """
    query = db.query(Document).filter(Document.business_id == business_id)

    if status:
        query = query.filter(Document.status == status)

    documents = query.order_by(Document.uploaded_at.desc()).all()
    return documents


@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    """
    Get a specific document by ID
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: int, db: Session = Depends(get_db)):
    """
    Serve the actual document file (image/PDF)
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        media_type=document.file_type,
        filename=document.filename
    )


@app.patch("/api/documents/{document_id}/process")
def process_document_endpoint(document_id: int, db: Session = Depends(get_db)):
    """
    Process document using LangGraph + Anthropic Vision
    Extracts invoice_id, amount, and date from the document
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

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

        # Update document with extracted data
        document.status = "completed"
        document.processed_at = datetime.utcnow()
        document.invoice_number = result.get("invoice_id")
        document.gst_amount = result.get("amount")
        document.extracted_data = result.get("raw_response")

        # Parse and set invoice date
        if result.get("date"):
            try:
                document.invoice_date = datetime.strptime(result["date"], "%Y-%m-%d")
            except:
                pass

        db.commit()

        # Also save to extracted_invoices table
        extracted = ExtractedInvoice(
            document_id=document_id,
            business_id=document.business_id,
            invoice_id=result.get("invoice_id"),
            amount=result.get("amount"),
            date=document.invoice_date,
            confidence=result.get("confidence"),
            raw_response=result.get("raw_response"),
        )
        db.add(extracted)
        db.commit()

        return {
            "message": "Document processed successfully",
            "document_id": document_id,
            "extracted": {
                "invoice_id": result.get("invoice_id"),
                "amount": result.get("amount"),
                "date": result.get("date"),
                "confidence": result.get("confidence")
            }
        }

    except Exception as e:
        document.status = "error"
        document.extracted_data = {"error": str(e)}
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Delete a document from storage and database
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from storage (local + S3 if configured)
    storage().delete(document.file_path)

    # Delete from extracted_invoices if exists
    db.query(ExtractedInvoice).filter(ExtractedInvoice.document_id == document_id).delete()

    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


@app.patch("/api/documents/{document_id}/confirm")
def confirm_invoice_data(
    document_id: int,
    data: InvoiceConfirm,
    db: Session = Depends(get_db)
):
    """
    Confirm or update extracted invoice data after user verification.
    Called when user verifies the extracted data is correct or edits it.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

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
def get_dashboard_stats(business_id: int, db: Session = Depends(get_db)):
    """
    Get dashboard statistics for a business
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    documents = db.query(Document).filter(Document.business_id == business_id).all()

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
