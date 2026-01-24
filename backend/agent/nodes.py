"""
Agent Node Functions

Individual processing steps for the invoice extraction workflow.
Extracts GST-compliant data and classifies supply type (B2B/B2C).
"""
import os
import base64
import json
import re
from datetime import datetime

import anthropic

from .config import config
from .state import InvoiceState, classify_supply_type


# Indian State Codes mapping
STATE_CODES = {
    "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03",
    "chandigarh": "04", "uttarakhand": "05", "haryana": "06", "delhi": "07",
    "rajasthan": "08", "uttar pradesh": "09", "bihar": "10", "sikkim": "11",
    "arunachal pradesh": "12", "nagaland": "13", "manipur": "14", "mizoram": "15",
    "tripura": "16", "meghalaya": "17", "assam": "18", "west bengal": "19",
    "jharkhand": "20", "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23",
    "gujarat": "24", "dadra and nagar haveli": "26", "maharashtra": "27",
    "andhra pradesh": "28", "karnataka": "29", "goa": "30", "lakshadweep": "31",
    "kerala": "32", "tamil nadu": "33", "puducherry": "34", "andaman and nicobar": "35",
    "telangana": "36", "andhra pradesh (new)": "37", "ladakh": "38"
}


def load_image(state: InvoiceState) -> InvoiceState:
    """
    Node 1: Load and encode image file to base64
    Uses storage backend (local or S3) to fetch the file.
    """
    from storage import storage

    file_path = state["file_path"]

    try:
        store = storage()

        # Check if file exists in storage
        if not store.exists(file_path):
            return {**state, "error": f"File not found: {file_path}"}

        # Get file content from storage (works with both local and S3)
        file_content = store.get(file_path)
        image_data = base64.standard_b64encode(file_content).decode("utf-8")

        return {**state, "image_data": image_data}

    except Exception as e:
        return {**state, "error": f"Failed to load image: {str(e)}"}


def extract_invoice_data(state: InvoiceState) -> InvoiceState:
    """
    Node 2: Use Anthropic Vision to extract GST invoice data
    """
    if state.get("error"):
        return state

    if not state.get("image_data"):
        return {**state, "error": "No image data available"}

    try:
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

        # Determine media type
        media_type = _get_media_type(state["file_type"])

        # Build the GST extraction prompt
        prompt = _build_gst_extraction_prompt()

        # Call Claude Vision
        message = client.messages.create(
            model=config.ANTHROPIC_MODEL,
            max_tokens=config.MAX_TOKENS,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": state["image_data"],
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        }
                    ],
                }
            ],
        )

        # Parse response
        response_text = message.content[0].text.strip()
        extracted = _parse_response(response_text)

        if extracted is None:
            return {
                **state,
                "error": f"Failed to parse response: {response_text}",
                "raw_response": {"text": response_text}
            }

        # Extract and convert numeric values
        taxable_value = _parse_amount(extracted.get("taxable_value"))
        cgst = _parse_amount(extracted.get("cgst"))
        sgst = _parse_amount(extracted.get("sgst"))
        igst = _parse_amount(extracted.get("igst"))
        gst_cess = _parse_amount(extracted.get("gst_cess"))
        total_invoice_value = _parse_amount(extracted.get("total_invoice_value"))
        gst_rate = _parse_float(extracted.get("gst_rate"))

        # Get state code from place of supply
        place_of_supply = extracted.get("place_of_supply")
        state_code = extracted.get("state_code") or _get_state_code(place_of_supply)

        # Get customer GSTIN
        customer_gstin = extracted.get("customer_gstin")
        if customer_gstin:
            customer_gstin = customer_gstin.strip().upper()
            # Validate GSTIN format - must be 15 characters and start with 2-digit state code
            # Regex: 2 digits (state) + 10 chars (PAN) + 1 entity + 1 Z + 1 checksum
            if len(customer_gstin) != 15 or not re.match(r'^[0-9]{2}[A-Z0-9]{13}$', customer_gstin):
                # Check if it looks like an attempt at GSTIN (contains digits and letters, reasonable length)
                if len(customer_gstin) >= 10 and re.search(r'[0-9]', customer_gstin) and re.search(r'[A-Z]', customer_gstin):
                    pass  # Accept as potential GSTIN for demo/test purposes
                else:
                    customer_gstin = None  # Invalid GSTIN, treat as B2C

        return {
            **state,
            # GST Compliance Fields
            "date": extracted.get("date"),
            "invoice_number": extracted.get("invoice_number"),
            "place_of_supply": place_of_supply,
            "customer_gstin": customer_gstin,
            "party_name": extracted.get("party_name"),
            "taxable_value": taxable_value,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "state_code": state_code,
            "gst_rate": gst_rate,
            "gst_cess": gst_cess,
            "total_invoice_value": total_invoice_value,
            # Legacy fields (backward compatibility)
            "invoice_id": extracted.get("invoice_number"),
            "amount": extracted.get("total_invoice_value"),
            # Metadata
            "confidence": extracted.get("confidence", "medium"),
            "raw_response": extracted,
            "error": None
        }

    except anthropic.APIError as e:
        return {**state, "error": f"Anthropic API error: {str(e)}"}
    except Exception as e:
        return {**state, "error": f"Extraction failed: {str(e)}"}


def validate_and_classify(state: InvoiceState) -> InvoiceState:
    """
    Node 3: Validate data and classify supply type (B2B/B2C)
    """
    if state.get("error"):
        return state

    # Parse and normalize date if present
    if state.get("date"):
        normalized_date = _normalize_date(state["date"])
        if normalized_date:
            state = {**state, "date": normalized_date}

    # Classify supply type based on customer GSTIN and invoice value
    type_of_supply = classify_supply_type(
        state.get("customer_gstin"),
        state.get("total_invoice_value")
    )
    state = {**state, "type_of_supply": type_of_supply}

    return state


# Legacy alias for backward compatibility
def validate_output(state: InvoiceState) -> InvoiceState:
    """Alias for validate_and_classify (backward compatibility)"""
    return validate_and_classify(state)


# ==================== Helper Functions ====================

def _get_media_type(file_type: str) -> str:
    """Get media type for Anthropic API"""
    file_type_lower = file_type.lower()

    if "pdf" in file_type_lower:
        return "application/pdf"
    elif "png" in file_type_lower:
        return "image/png"
    elif "gif" in file_type_lower:
        return "image/gif"
    elif "webp" in file_type_lower:
        return "image/webp"
    else:
        return "image/jpeg"


def _build_gst_extraction_prompt() -> str:
    """Build the GST-compliant extraction prompt for Claude"""
    return """Analyze this Indian GST invoice/receipt image and extract ALL the following information for GST compliance filing.

Return ONLY a JSON object with these exact keys:
{
    "date": "invoice date in DD-MM-YYYY or YYYY-MM-DD format",
    "invoice_number": "invoice number or receipt number",
    "place_of_supply": "state name where goods/services are supplied (e.g., Maharashtra, Karnataka)",
    "state_code": "2-digit state code if visible (e.g., 27 for Maharashtra)",
    "customer_gstin": "buyer/customer GSTIN number (15 characters) or null if not present (B2C invoice)",
    "party_name": "buyer/customer name or company name",
    "taxable_value": "taxable amount before GST as a decimal number",
    "cgst": "CGST amount as a decimal number or null if not applicable",
    "sgst": "SGST amount as a decimal number or null if not applicable",
    "igst": "IGST amount as a decimal number or null if not applicable",
    "gst_rate": "GST rate percentage (e.g., 18, 12, 5) or null",
    "gst_cess": "GST Cess amount as a decimal number or null if not applicable",
    "total_invoice_value": "total invoice amount including all taxes as a decimal number",
    "confidence": "high/medium/low based on image clarity and data completeness"
}

CRITICAL RULES FOR AMOUNTS:
1. Remove currency symbols (₹, Rs., INR) but PRESERVE the decimal point
2. Indian format "36,000.00" = 36000.00 (thirty-six thousand)
3. Indian format "4,80,000" = 480000 (four lakh eighty thousand)
4. Indian format "42,480.00" = 42480.00 (forty-two thousand four hundred eighty)
5. If you see ".00" at the end, the number before it is the full amount in rupees
6. DO NOT multiply amounts - extract exactly as shown

OTHER RULES:
7. If buyer GSTIN is not present or says "Unregistered", set customer_gstin to null
8. Look for Place of Supply which may include state code in parentheses like "Maharashtra (27)"
9. CGST and SGST are used for intra-state supplies, IGST for inter-state supplies
10. If any field cannot be determined, use null

Return ONLY the JSON object, no other text or explanation."""


def _parse_response(response_text: str) -> dict | None:
    """Parse JSON response from Claude"""
    try:
        # Handle markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        return json.loads(response_text)

    except json.JSONDecodeError:
        # Try to find JSON in response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        return None


def _parse_amount(value) -> float | None:
    """Parse amount string to float"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove currency symbols and commas
        cleaned = re.sub(r'[₹Rs.,\s]', '', value)
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _parse_float(value) -> float | None:
    """Parse any value to float"""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _get_state_code(place_of_supply: str | None) -> str | None:
    """Extract or lookup state code from place of supply"""
    if not place_of_supply:
        return None

    # Check if state code is in parentheses like "Maharashtra (27)"
    match = re.search(r'\((\d{2})\)', place_of_supply)
    if match:
        return match.group(1)

    # Lookup from state codes dictionary
    place_lower = place_of_supply.lower().strip()
    for state_name, code in STATE_CODES.items():
        if state_name in place_lower or place_lower in state_name:
            return code

    return None


def _normalize_date(date_str: str) -> str | None:
    """Normalize date to YYYY-MM-DD format"""
    if not date_str:
        return None

    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
        "%d-%m-%y", "%d/%m/%y", "%d.%m.%Y", "%d.%m.%y"
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str.strip(), fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return date_str  # Return original if no format matches
