# API Documentation

Base URL: `http://localhost:8000` (Docker) — all bodies JSON unless noted.

Error contract: `{ "detail": { "message": string, "code": string, "request_id"?: string } }`
(422 from Pydantic body validation returns FastAPI's default `detail: [...]` list.)

## System

### GET /api/health
`{ "status": "ok" | "degraded", "db": "up" | "down" }`

### GET /api/config
`{ "demo_mode": bool, "model": string, "provider": "demo" | "groq", "max_upload_mb": int }`

## Documents

### POST /api/documents/extract
Multipart upload (`file`: pdf | docx | txt | eml, ≤5 MB) **or** JSON `{text, source_type?}`.
→ `{ text, source_type, char_count, filename? }`
Errors: **415** unsupported type · **413** too large · **422** empty/unreadable · magic-byte mismatch.

## AI

### POST /api/ai/extract-deviation
Body: `{ text: string (≥1 char), source_type?: "pdf" | "docx" | "txt" | "email" | "text" }`
→ `{ extraction: { data, confidence, evidence }, validation, impact, severity, explanation, provider, model, elapsed_ms, errors[] }`

- `extraction.data`: the 20 fields, each `string | null` — never invented, null when not stated.
- `extraction.confidence`: 0.0–1.0 per field; **null field ⇒ 0.0**.
- `validation`: `{ missing_information, low_confidence, ungrounded, errors, critical_missing }`.
  `ungrounded` values (batch/product/equipment/actual) are cut to ≤0.4 confidence.
- `impact` / `severity`: `null` when `critical_missing` (no values fabricated).
- `provider`: which provider actually ran — `groq`, or `demo` after an honest fallback (`errors` explains why).
- Errors: **422** empty text · **502** `ai_unavailable` (after repair retry) · **504** `ai_timeout`.

### POST /api/ai/assess-impact
Body: `{ fields: ExtractedFields, raw_text? }` → `{ impact, provider, model }` · 422 / 502 / 504

### POST /api/ai/assess-severity
Body: `{ fields, validation?, raw_text? }` → `{ severity, provider, model }` · 422 / 502 / 504

### POST /api/ai/refine
Body: `{ instruction, current_fields, validation?, raw_text? }`
→ `{ proposals: [{ field, current_value, proposed_value, reason }], message?, provider, model }`
Proposals are **never auto-applied** — the human applies or rejects each one.
Errors: **422** blank instruction · **502** / **504**.

## Deviations

### POST /api/deviations
`DeviationCreate` (+ optional `ai_assessment` — the `/api/ai/extract-deviation` response plus
`raw_text_excerpt`). → **201** `DeviationOut`.
Side effects: allocates `DEV-YYYY-NNNN`, stores `ai_assessments` row, audit events
`ai_extracted` + `created`.

### GET /api/deviations
Query: `search`, `severity`, `status`, `page`, `page_size` → `{ items: DeviationOut[], total }`

### GET /api/deviations/{id}
→ `DeviationOut` + `ai_assessments[]` + `audit_events[]` · **404** unknown id

### PUT /api/deviations/{id}
Full replacement (`DeviationUpdate`) → `DeviationOut`.
Audit events: `updated` always; `field_edited` with `{field:{from,to}}` diff;
`severity_overridden` when only the severity changed.
