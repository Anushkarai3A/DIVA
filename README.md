# DIVA — AI-Powered Deviation Intake Module

An AI-powered deviation intake application designed for pharmaceutical API manufacturing. The system extracts structured information from uploaded documents or pasted text, assists with impact and severity assessment, and allows users to review and edit AI-generated information before saving.

## Overview

Deviation reporting in pharmaceutical manufacturing requires accurate documentation of unexpected events, process deviations, and out-of-specification results. Manually transferring information from reports into structured forms can be time-consuming and error-prone.

DIVA simplifies this process using AI-assisted extraction and assessment while keeping the user in control of the final record.

The application supports the following workflow:

1. Upload a deviation document or paste deviation details.
2. Extract and process the source content.
3. Use AI to identify and structure relevant deviation information.
4. Automatically populate the Log Deviation form.
5. Generate an initial impact assessment and severity recommendation.
6. Review and edit the extracted information.
7. Interact with the AI assistant to clarify or refine information.
8. Save the reviewed deviation.
9. Access saved deviations through the application.

AI-generated assessments are advisory and must be reviewed by the user before the deviation is finalized.

## Key Features

### AI-Powered Deviation Extraction

Accepts deviation information from supported documents or pasted text and uses AI to extract relevant fields for the Log Deviation form.

### Automatic Form Population

Maps the structured AI response to the corresponding form fields, reducing the need for manual data entry.

### Impact Assessment

Provides an initial assessment of potential deviation impacts, such as product quality, process consistency, and batch integrity, based on the available information.

### Severity Recommendation

Generates an initial severity recommendation with supporting reasoning to help the user evaluate the event.

### Human-in-the-Loop Review

Allows users to review and edit extracted information and assessment results before saving the deviation.

### AI Interaction

Provides an interface for asking questions about deviations and refining information, subject to the implemented AI workflow.

### Deviation Management

Supports creating, reviewing, saving, and accessing deviation records.

### Theme Support

Provides light and dark theme options where implemented.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| State Management | Redux |
| Backend | Python, FastAPI |
| AI Orchestration | LangGraph |
| Language Model Provider | Groq |
| Database | PostgreSQL |

The exact versions and additional libraries are defined in the project's dependency and configuration files.

## System Architecture

The application uses a frontend-backend architecture in which the frontend handles user interaction while the backend coordinates document processing, AI operations, validation, and persistence.

```text
User
 |
 v
React Frontend
 |
 | Document Upload or Pasted Text
 v
FastAPI Backend
 |
 v
Document and Text Processing
 |
 v
LangGraph AI Workflow
 |
 v
Groq Language Model
 |
 v
Structured AI Response
 |
 v
Validation and Response Handling
 |
 v
Log Deviation Form
 |
 | User Review and Editing
 v
Save Deviation
 |
 v
PostgreSQL Database
```

The diagram represents the intended workflow. The exact processing sequence should be verified against the current implementation.

## Application Workflow

### 1. Input

The user opens the New Deviation page and uploads a supported document or enters deviation details as text.

### 2. Document Processing

The backend processes the submitted input and extracts usable text where required.

### 3. AI Extraction

The extracted content is passed to the AI workflow to identify relevant deviation information and produce structured output.

### 4. Impact and Severity Assessment

The AI provides an initial impact assessment, severity recommendation, and supporting reasoning based on the available information.

### 5. Form Population

The frontend receives the response and populates the corresponding fields in the Log Deviation form.

### 6. Review and Editing

The user reviews the AI-generated fields, corrects inaccuracies, and refines the information when necessary.

### 7. Persistence

The user submits the reviewed deviation for saving. The backend persists the record in PostgreSQL if the save operation succeeds.

## Running the Application

The project contains separate frontend and backend components. Start each component using the commands defined in the repository.

### Prerequisites

- Node.js and npm
- Python
- PostgreSQL
- A valid Groq API key for live AI processing

### Backend Setup

Open a terminal in the backend directory.

Activate the existing Python virtual environment in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If the project uses `requirements.txt`, install the dependencies:

```powershell
pip install -r requirements.txt
```

Start the FastAPI application using the current development configuration:

```powershell
python -m uvicorn app.main:app --port 8000 --reload
```

The backend should be available at:

`http://127.0.0.1:8000`

If interactive API documentation is enabled, open:

`http://127.0.0.1:8000/docs`

### Frontend Setup

Open a separate terminal in the frontend directory.

Install dependencies:

```bash
npm install
```

Start the Vite development server using the configured script:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Database Setup

Ensure PostgreSQL is running and the backend database configuration points to the correct database.

Apply the required migrations or initialization scripts according to the project's database setup.

## Environment Configuration

Configure environment variables using the project's existing `.env.example` and configuration files.

Typical variables may include:

```text
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=your_database_connection_string
```

These are examples. Confirm the exact variable names in the source code.

- Never commit real API keys or database credentials.
- Keep local environment files out of version control.
- Do not expose secrets through frontend environment variables.
- Restart the relevant development server after changing environment configuration.

## Error Handling and Troubleshooting

### Backend Connectivity

If the frontend reports that the backend is unavailable:

1. Confirm that FastAPI is running.
2. Verify the configured API base URL.
3. Check the endpoint used by the frontend.
4. Verify that CORS permits the frontend origin.
5. Inspect failed requests in the browser's Network tab.
6. Review backend logs for incoming requests and exceptions.

A running backend does not guarantee that the frontend is calling the correct URL or endpoint.

### AI Rate Limits

The language model provider may return HTTP 429 when rate limits are reached. Inspect backend logs and use appropriate retry and error-handling mechanisms.

Do not treat every AI failure as a network connectivity problem.

### Document Extraction Failure

Verify that the uploaded file uses a supported format, remains within the configured size limit, and contains extractable content.

### Database Errors

Check the PostgreSQL service, connection string, database schema, and migration status.

## Project Structure

The repository contains separate components for the frontend, backend, database, documentation, and sample data.

```text
diva-deviation-intake/
├── backend/
├── database/
├── docs/
├── frontend/
├── sample-data/
├── .env.example
├── .gitignore
├── diva.png
├── docker-compose.yml
├── plan.md
├── PROJECT_OVERVIEW.md
└── README.md
```

This is a simplified representation of the project structure. Refer to the current repository for the exact contents of each directory.

## Product Principles

- AI assists with extraction and assessment rather than replacing human review.
- AI-generated information must be reviewed before the deviation is saved.
- Missing information should not be silently fabricated.
- The final saved record should reflect the information approved by the user.
- Errors should distinguish connectivity failures from AI processing failures.

## Scope and Limitations

DIVA is an AI Product Engineer Challenge implementation focused on deviation intake and AI-assisted assessment.

AI recommendations do not guarantee assessment accuracy, establish regulatory compliance, or replace the quality review procedures required by a pharmaceutical manufacturer.

Production deployment would require appropriate security controls, access management, auditability, validation, monitoring, and quality-system review.

## License

This project was developed as part of a technical product engineering challenge. Refer to the applicable submission requirements and project ownership terms before distributing the source code.
