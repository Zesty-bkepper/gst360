"""
Agent Graph Definition

Builds the LangGraph workflow for invoice processing.
"""
from langgraph.graph import StateGraph, START, END

from .state import InvoiceState
from .nodes import load_image, extract_invoice_data, validate_output


def create_invoice_graph() -> StateGraph:
    """
    Create the invoice processing graph.

    Workflow:
        START → load_image → extract_data → validate → END
    """
    workflow = StateGraph(InvoiceState)

    # Add nodes
    workflow.add_node("load_image", load_image)
    workflow.add_node("extract_data", extract_invoice_data)
    workflow.add_node("validate", validate_output)

    # Define edges (linear flow)
    workflow.add_edge(START, "load_image")
    workflow.add_edge("load_image", "extract_data")
    workflow.add_edge("extract_data", "validate")
    workflow.add_edge("validate", END)

    return workflow


def compile_graph():
    """Compile the graph for execution"""
    workflow = create_invoice_graph()
    return workflow.compile()
