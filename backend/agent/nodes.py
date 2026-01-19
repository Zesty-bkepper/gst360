"""
Agent Node Functions

Individual processing steps for the invoice extraction workflow.
"""
import os
import base64
import json
import re
from datetime import datetime

import anthropic

from .config import config
from .state import InvoiceState


def load_image(state: InvoiceState) -> InvoiceState:
    """
    Node 1: Load and encode image file to base64
    """
    file_path = state["file_path"]

    try:
        if not os.path.exists(file_path):
            return {**state, "error": f"File not found: {file_path}"}

        with open(file_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        return {**state, "image_data": image_data}

    except Exception as e:
        return {**state, "error": f"Failed to load image: {str(e)}"}


def extract_invoice_data(state: InvoiceState) -> InvoiceState:
    """
    Node 2: Use Anthropic Vision to extract invoice data
    """
    if state.get("error"):
        return state

    if not state.get("image_data"):
        return {**state, "error": "No image data available"}

    try:
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

        # Determine media type
        media_type = _get_media_type(state["file_type"])

        # Build the extraction prompt
        prompt = _build_extraction_prompt()

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

        return {
            **state,
            "invoice_id": extracted.get("invoice_id"),
            "amount": extracted.get("amount"),
            "date": extracted.get("date"),
            "confidence": extracted.get("confidence", "medium"),
            "raw_response": extracted,
            "error": None
        }

    except anthropic.APIError as e:
        return {**state, "error": f"Anthropic API error: {str(e)}"}
    except Exception as e:
        return {**state, "error": f"Extraction failed: {str(e)}"}


def validate_output(state: InvoiceState) -> InvoiceState:
    """
    Node 3: Validate and clean extracted data
    """
    if state.get("error"):
        return state

    # Parse and normalize date if present
    if state.get("date"):
        normalized_date = _normalize_date(state["date"])
        if normalized_date:
            state = {**state, "date": normalized_date}

    return state


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


def _build_extraction_prompt() -> str:
    """Build the extraction prompt for Claude"""
    return """Analyze this invoice/receipt image and extract the following information.
Return ONLY a JSON object with these exact keys:
{
    "invoice_id": "the invoice number or receipt number",
    "amount": "the total amount with currency symbol",
    "date": "the invoice date in YYYY-MM-DD format",
    "confidence": "high/medium/low based on image clarity"
}

If any field cannot be determined, use null.
Return ONLY the JSON, no other text."""


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
        json_match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        return None


def _normalize_date(date_str: str) -> str | None:
    """Normalize date to YYYY-MM-DD format"""
    formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]

    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return date_str  # Return original if no format matches
