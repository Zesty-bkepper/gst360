"""
Agent State Definitions

Defines the state schema for the invoice processing workflow.
"""
from typing import TypedDict, Optional


class InvoiceState(TypedDict):
    """State for invoice processing workflow"""

    # Input
    file_path: str
    file_type: str

    # Processing
    image_data: Optional[str]  # Base64 encoded image

    # Output - Core fields (invoice_id, amount, date)
    invoice_id: Optional[str]
    amount: Optional[str]
    date: Optional[str]

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
        invoice_id=None,
        amount=None,
        date=None,
        confidence=None,
        raw_response=None,
        error=None,
    )
