import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, FileSearch, FileText, Search, ShieldAlert, UploadCloud, X, Download, Bug, LoaderCircle } from 'lucide-react';
import './style.css';

const API = 'http://127.0.0.1:8000';
const sampleLog = `2026-11-17 10:20:01 INFO Server started on port 8000
2026-11-17 10:20:04 WARNING Deprecated API endpoint will be removed in a future version
2026-11-17 10:20:09 ERROR Connection timed out while contacting payment service
2026-11-17 10:20:12 ERROR Traceback (most recent call last): ValueError: invalid input
2026-11-17 10:20:20 CRITICAL Out of memory: process killed by operating system
2026-11-17 10:20:25 INFO Shutdown complete`;
const levels = ['Critical', 'High', 'Medium', 'Low'];
const icons = { Critical: ShieldAlert, High: AlertCircle, Medium: AlertTriangle, Low: Activity };

function App() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try { const response = await fetch(`${API}/api/history`); if (response.ok) setHistory(await response.json()); } catch { /* API may still be starting */ }
  };
  React.useEffect(() => { loadHistory(); }, []);

  const runAnalysis = async (file) => {
    setError(''); setBusy(true);
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`${API}/api/analyze`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Analysis failed.');
      setResult(data); setFilter('All'); setQuery(''); await loadHistory();
    } catch (err) { setError(`${err.message}. Make sure the backend is running at http://127.0.0.1:8000.`); }
    finally { setBusy(false); }
  };
  const useSample = () => {
    const file = new File([sampleLog], 'sample_application.log', { type: 'text/plain' });
    runAnalysis(file);
  };
  const visible = useMemo(() => (result?.findings || []).filter(item =>
    (filter === 'All' || item.severity === filter) &&
    `${item.message} ${item.category} ${item.suggestion}`.toLowerCase().includes(query.toLowerCase())
  ), [result, filter, query]);

  const downloadReport = async () => {
    if (!result) return;
    try {
      const response = await fetch(`${API}/api/report/${result.analysis_id}`);
      if (!response.ok) throw new Error('Report is unavailable.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'buglens-analysis-report.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Bug size={22}/></div><div><strong>BugLens<span> AI</span></strong><small>LOG INTELLIGENCE</small></div></div>
      <div className="side-label">WORKSPACE</div><div className="side-link active"><FileSearch size={17}/> Log Analyzer</div>
      <div className="side-label history-label">RECENT ANALYSES</div>
      {history.length ? history.slice(0,6).map(item => <button className="history-item" key={item.analysis_id} onClick={() => setError('Run a new upload to view its full findings; history stores summaries only in this demo.')}>{item.filename}<small>{item.findings_count} findings</small></button>) : <p className="empty-history">Your recent scans will appear here.</p>}
      <div className="sidebar-bottom"><div className="status-dot"/> Local analysis engine <span>v1.0</span></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><span className="eyebrow">DEVELOPER TOOLKIT / DIAGNOSTICS</span><h1>Log Analyzer</h1></div><div className="local-badge"><span/> PRIVATE · LOCAL</div></header>
      <section className="intro"><div><h2>Find the signal in your logs.</h2><p>Upload an application log and let BugLens identify errors, rank their severity, and recommend what to investigate next.</p></div><div className="intro-icon"><FileSearch size={35}/></div></section>
      <section className="upload-card">
        <div className="upload-icon"><UploadCloud size={25}/></div><h3>Upload your log file</h3><p>Drop a <b>.log</b> or <b>.txt</b> file here, or choose one from your computer.</p>
        <label className={`upload-button ${busy ? 'disabled' : ''}`}><input type="file" accept=".log,.txt,text/plain" disabled={busy} onChange={e => e.target.files?.[0] && runAnalysis(e.target.files[0])}/>{busy ? <><LoaderCircle className="spin" size={17}/> Analyzing...</> : 'Choose log file'}</label>
        <small>Maximum file size: 5 MB · Files are processed in memory</small>
        <button className="sample-button" onClick={useSample} disabled={busy}>Try with sample log <span>↗</span></button>
      </section>
      {error && <div className="error-banner"><X size={17}/>{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {result && <>
        <div className="section-heading"><div><span className="eyebrow">ANALYSIS RESULTS</span><h2>{result.filename}</h2><p>{result.total_lines} lines scanned · {result.findings_count} findings detected</p></div><button className="download-button" onClick={downloadReport}><Download size={16}/> Export CSV</button></div>
        <div className="stats-grid">
          <div className="stat-card total"><span>Total findings</span><strong>{result.findings_count}</strong><small>Detected patterns</small></div>
          {levels.map(level => { const Icon = icons[level]; return <div className={`stat-card ${level.toLowerCase()}`} key={level}><span><Icon size={15}/> {level}</span><strong>{result.severity_counts[level]}</strong><small>{level === 'Critical' ? 'Immediate attention' : level === 'High' ? 'Investigate soon' : level === 'Medium' ? 'Review recommended' : 'Monitor'}</small></div>; })}
        </div>
        <section className="findings-card"><div className="findings-header"><div><h3>Detected issues</h3><p>Review each match and its suggested next step.</p></div><div className="filters"><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search findings"/></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{levels.map(x => <option key={x}>{x}</option>)}</select></div></div>
          {visible.length ? <div className="finding-list">{visible.map(item => { const Icon = icons[item.severity]; return <article className="finding" key={item.id}><div className={`finding-icon ${item.severity.toLowerCase()}`}><Icon size={18}/></div><div className="finding-body"><div className="finding-title"><strong>{item.category}</strong><span className={`severity-pill ${item.severity.toLowerCase()}`}>{item.severity}</span><span className="line-number">Line {item.line}</span></div><code>{item.message}</code><div className="suggestion"><b>Suggested next step</b><p>{item.suggestion}</p></div></div></article>; })}</div> : <div className="no-findings"><CheckCircle2 size={24}/><b>No matching findings</b><span>Try another severity filter or search term.</span></div>}
        </section>
      </>}
      {!result && <div className="empty-state"><div><CheckCircle2 size={19}/></div><span><b>Ready when you are.</b> Upload a log file to generate your first report.</span></div>}
      <footer>BugLens AI <span>·</span> Rule-based diagnostics for faster debugging <span>·</span> Verify suggestions before production changes</footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
