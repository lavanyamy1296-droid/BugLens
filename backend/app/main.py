from __future__ import annotations

import csv
import io
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="BugLens AI API", version="1.0.0", description="Rule-based log analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024
history: list[dict[str, Any]] = []

# Ordered from most severe to least severe. Each rule has an explainable match and a practical hint.
RULES = [
    ("Critical", "Out of memory", re.compile(r"out of memory|memoryerror|oom killed|cannot allocate memory", re.I), "The process may have exhausted available memory. Check memory usage, large objects, leaks, and container or server limits."),
    ("Critical", "Database unavailable", re.compile(r"database (?:is )?unavailable|could not connect to server|connection refused.*(?:postgres|mysql|database)|too many connections", re.I), "Verify database health, host/port, credentials, network access, and connection-pool limits."),
    ("Critical", "Service crash / fatal error", re.compile(r"fatal error|segmentation fault|process exited with code [1-9]|uncaught exception", re.I), "Inspect the surrounding stack trace and recent deployments. Reproduce in a safe environment before applying a fix."),
    ("High", "Authentication or permission failure", re.compile(r"unauthorized|forbidden|permission denied|access denied|401\s|403\s", re.I), "Check identity, token expiry, role permissions, file ownership, and secret configuration. Do not expose credentials in logs."),
    ("High", "Application exception", re.compile(r"traceback \(most recent call last\)|exception|\berror\b|\bpanic\b", re.I), "Read the complete stack trace and identify the first application-code frame. Validate inputs and recent code changes."),
    ("High", "Connection / network failure", re.compile(r"connection timed out|connection reset|name or service not known|temporary failure in name resolution|network is unreachable", re.I), "Check DNS, network connectivity, firewall rules, service availability, and timeout settings."),
    ("Medium", "Request or resource not found", re.compile(r"\b404\b|not found|no such file or directory", re.I), "Confirm the requested route, file path, resource identifier, and deployment/static-file configuration."),
    ("Medium", "Rate limit / capacity warning", re.compile(r"\b429\b|rate limit|too many requests|throttl", re.I), "Review request volume and service quotas. Add backoff/retry behavior and caching where appropriate."),
    ("Medium", "Deprecated API or configuration", re.compile(r"deprecated|will be removed in a future version", re.I), "Plan an update to the supported API or configuration and review the library's migration guidance."),
    ("Low", "Warning", re.compile(r"\bwarning\b|\bwarn\b", re.I), "Review the warning context. It may not be immediately harmful, but repeated warnings can indicate configuration or compatibility issues."),
]


def analyze_text(content: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        for severity, category, pattern, suggestion in RULES:
            if pattern.search(line):
                findings.append({
                    "id": str(uuid.uuid4()),
                    "line": line_number,
                    "severity": severity,
                    "category": category,
                    "message": line[:700],
                    "suggestion": suggestion,
                })
                break
    return findings


@app.get("/")
def root():
    return {"name": "BugLens AI API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "BugLens AI"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    filename = file.filename or "uploaded.log"
    if not filename.lower().endswith((".log", ".txt")):
        raise HTTPException(status_code=400, detail="Please upload a .log or .txt file.")
    raw = await file.read(MAX_FILE_SIZE + 1)
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 5 MB.")
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("utf-8", errors="replace")
    findings = analyze_text(content)
    counts = Counter(item["severity"] for item in findings)
    result = {
        "analysis_id": str(uuid.uuid4()),
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "total_lines": len(content.splitlines()),
        "scanned_lines": sum(1 for line in content.splitlines() if line.strip()),
        "findings_count": len(findings),
        "severity_counts": {level: counts.get(level, 0) for level in ["Critical", "High", "Medium", "Low"]},
        "findings": findings,
    }
    history.insert(0, result)
    del history[20:]
    return result


@app.get("/api/history")
def get_history():
    return [
        {key: item[key] for key in ["analysis_id", "filename", "created_at", "total_lines", "findings_count", "severity_counts"]}
        for item in history
    ]


@app.get("/api/report/{analysis_id}")
def download_report(analysis_id: str):
    result = next((item for item in history if item["analysis_id"] == analysis_id), None)
    if result is None:
        raise HTTPException(status_code=404, detail="Analysis not found. It may have been cleared after a server restart.")
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Line", "Severity", "Category", "Message", "Suggested next step"])
    for finding in result["findings"]:
        writer.writerow([finding["line"], finding["severity"], finding["category"], finding["message"], finding["suggestion"]])
    buffer.seek(0)
    safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", result["filename"].rsplit(".", 1)[0]) or "log"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="buglens_{safe_name}_report.csv"'},
    )
