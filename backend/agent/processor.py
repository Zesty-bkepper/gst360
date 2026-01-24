"""
Invoice Processor

Main interface for processing invoices using the LangGraph agent.
"""
from typing import Optional

from .config import config
from .state import create_initial_state
from .graph import compile_graph


class InvoiceProcessor:
    """
    Invoice processing service using LangGraph + Anthropic Vision.

    Usage:
        processor = InvoiceProcessor()
        result = processor.process("path/to/invoice.jpg", "image/jpeg")
    """

    _instance: Optional["InvoiceProcessor"] = None
    _graph = None

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._graph is None:
            config.validate()
            self._graph = compile_graph()

    def process(self, file_path: str, file_type: str) -> dict:
        """
        Process an invoice file and extract data.

        Args:
            file_path: Path to the invoice image/PDF
            file_type: MIME type of the file

        Returns:
            dict with:
                - invoice_id: Extracted invoice number
                - amount: Total amount with currency
                - date: Invoice date (YYYY-MM-DD)
                - confidence: Extraction confidence (high/medium/low)
                - raw_response: Full extraction response
                - error: Error message if failed
        """
        initial_state = create_initial_state(file_path, file_type)
        result = self._graph.invoke(initial_state)

        return {
            # GST Compliance Fields
            "date": result.get("date"),
            "invoice_number": result.get("invoice_number"),
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
            # Legacy fields
            "invoice_id": result.get("invoice_id"),
            "amount": result.get("amount"),
            # Metadata
            "confidence": result.get("confidence"),
            "raw_response": result.get("raw_response"),
            "error": result.get("error"),
        }


# Convenience function
def process_invoice(file_path: str, file_type: str) -> dict:
    """
    Process an invoice file (convenience function).

    Args:
        file_path: Path to the invoice image/PDF
        file_type: MIME type of the file

    Returns:
        Extraction result dict
    """
    processor = InvoiceProcessor()
    return processor.process(file_path, file_type)
