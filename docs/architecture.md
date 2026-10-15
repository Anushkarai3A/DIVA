# DIVA.AI Architecture

Frontend → FastAPI → Document Extraction → LangGraph → Groq → Structured Extraction → Impact Assessment → Severity Recommendation → Human Review → PostgreSQL

The AI workflow should be implemented as separate LangGraph nodes for extraction, validation, impact assessment, severity assessment, and explanation.
