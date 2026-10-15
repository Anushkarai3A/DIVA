"""LangGraph pipeline: parse -> extract -> validate -> [assess] -> explain.

Routing after validate_extraction:
- failed (parse/extraction error)      -> END (service turns this into 502)
- critical_missing (all 5 required     -> skip LLM assess nodes, explain why
  fields absent) no values were invented
- otherwise                            -> assess_impact -> assess_severity -> explain
"""
from langgraph.graph import END, StateGraph

from app.ai.nodes.assess_impact import assess_impact
from app.ai.nodes.assess_severity import assess_severity
from app.ai.nodes.explain import generate_explanation
from app.ai.nodes.extract import extract_deviation
from app.ai.nodes.parse_document import parse_document
from app.ai.nodes.validate import validate_extraction
from app.ai.state import DeviationState


def route_after_validation(state: DeviationState) -> str:
    if state.get("failed"):
        return "end"
    validation = state.get("validation")
    if validation is not None and validation.critical_missing:
        return "explain"
    return "assess"


def build_graph():
    workflow = StateGraph(DeviationState)

    workflow.add_node("parse_document", parse_document)
    workflow.add_node("extract", extract_deviation)
    workflow.add_node("validate", validate_extraction)
    workflow.add_node("assess_impact", assess_impact)
    workflow.add_node("assess_severity", assess_severity)
    workflow.add_node("explain", generate_explanation)

    workflow.set_entry_point("parse_document")
    workflow.add_edge("parse_document", "extract")
    workflow.add_edge("extract", "validate")
    workflow.add_conditional_edges(
        "validate",
        route_after_validation,
        {"end": END, "explain": "explain", "assess": "assess_impact"},
    )
    workflow.add_edge("assess_impact", "assess_severity")
    workflow.add_edge("assess_severity", "explain")
    workflow.add_edge("explain", END)

    return workflow.compile()
