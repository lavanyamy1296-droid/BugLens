# BugLens AI — Intelligent Error & Log Analyzer

BugLens AI is a local developer tool that analyzes `.log` and `.txt` files, detects common error patterns, assigns severity, suggests practical next steps, and presents a dashboard with downloadable findings.

## Features
- Upload `.log` and `.txt` files (up to 5 MB)
- Detect common Python, JavaScript, network, database, and server errors
- Classify findings as Critical, High, Medium, or Low
- Provide rule-based troubleshooting suggestions (no API key required)
- Dashboard summary, severity breakdown, and searchable findings
- Download analysis as CSV

> This is a developer-assistance tool. Suggestions are heuristic and should be verified before changing production systems.

## Requirements
- Python 3.10+
- Node.js 18+

## Run on Windows (PowerShell)
Open two VS Code terminals.

### 1. Backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
API: http://127.0.0.1:8000/docs

### 2. Frontend
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
Open the Vite URL printed in the terminal (normally http://localhost:5173).

If `py` is unavailable, use `python` instead. Running the venv's Python executable directly avoids PowerShell activation-policy issues.

## API
- `GET /api/health` — health check
- `POST /api/analyze` — multipart upload with field name `file`
- `GET /api/history` — recent analyses stored in memory for the current backend session
- `GET /api/report/{analysis_id}` — download findings as CSV

## Notes
- Analysis history is held in memory and clears when the backend restarts.
- Files are processed in memory and are not saved to disk.
- Pattern matching is explainable and rule-based; it is not a trained diagnostic model.
