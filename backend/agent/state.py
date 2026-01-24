"""
Agent State Definitions

Defines the state schema for the invoice processing workflow.
Supports GST compliance with B2B/B2C classification.
"""
from typing import TypedDict, Optional


class InvoiceState(TypedDict):
    """State for invoice processing workflow - GST Compliant"""

    # Input
    file_path: str
    file_type: str

    # Processing
    image_data: Optional[str]  # Base64 encoded image

    # Output - GST Compliance Fields (matching Excel structure)
    date: Optional[str]                    # Invoice date (YYYY-MM-DD)
    invoice_number: Optional[str]          # Invoice/Receipt number
    place_of_supply: Optional[str]         # State name
    customer_gstin: Optional[str]          # Buyer's GSTIN (null if B2C)
    party_name: Optional[str]              # Buyer/Customer name
    taxable_value: Optional[float]         # Taxable amount before GST
    cgst: Optional[float]                  # Central GST amount
    sgst: Optional[float]                  # State GST amount
    igst: Optional[float]                  # Integrated GST amount
    state_code: Optional[str]              # State code (e.g., "27" for Maharashtra)
    gst_rate: Optional[float]              # GST rate percentage
    gst_cess: Optional[float]              # GST Cess amount (if any)
    total_invoice_value: Optional[float]   # Total including GST
    type_of_supply: Optional[str]          # B2B, B2C_SMALL, B2C_LARGE

    # Legacy fields (for backward compatibility)
    invoice_id: Optional[str]              # Alias for invoice_number
    amount: Optional[str]                  # Formatted total amount

    # Metadata
    confidence: Optional[str]
    raw_response: Optional[dict]
    error: Optional[str]


def create_initial_state(file_path: str, file_type: str) -> InvoiceState:
    """Create initial state for processing"""
    return InvoiceState(
        file_path=file_path,
        file_type=file_type,
        image_data=None,
        # GST fields
        date=None,
        invoice_number=None,
        place_of_supply=None,
        customer_gstin=None,
        party_name=None,
        taxable_value=None,
        cgst=None,
        sgst=None,
        igst=None,
        state_code=None,
        gst_rate=None,
        gst_cess=None,
        total_invoice_value=None,
        type_of_supply=None,
        # Legacy
        invoice_id=None,
        amount=None,
        # Metadata
        confidence=None,
        raw_response=None,
        error=None,
    )


def classify_supply_type(customer_gstin: Optional[str], total_invoice_value: Optional[float]) -> str:
    """
    Classify the type of supply based on GST rules:
    - B2B: If buyer GSTIN is present
    - B2C_LARGE: If no buyer GSTIN and total value >= 20,00,000 (20 lakhs)
    - B2C_SMALL: If no buyer GSTIN and total value < 20,00,000 (20 lakhs)
    """
    TWENTY_LAKHS = 2000000  # 20,00,000

    if customer_gstin and customer_gstin.strip():
        return "B2B"

    if total_invoice_value and total_invoice_value >= TWENTY_LAKHS:
        return "B2C_LARGE"

    return "B2C_SMALL"
