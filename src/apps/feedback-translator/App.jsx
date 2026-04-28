import { useApiKey } from "../../shared/components/KeyGate";
import { callGemini, callGeminiRaw } from "../../shared/lib/gemini-client";
import { useState, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  /* ══ HEADER ══ */
  .site-header{background:var(--surface);border-bottom:1px solid var(--rule);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;}
  .header-brand{display:flex;flex-direction:column;gap:0.1rem;}
  .header-eyebrow{font-family:var(--font-mono);font-size:0.5rem;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:var(--accent,#6C8EF5);}
  .header-appname{font-size:1.5rem;font-weight:700;color:var(--ink,#E8ECF8);letter-spacing:-0.03em;line-height:1;}
  .header-appname span{color:var(--accent,#6C8EF5);}
  .header-tagline{font-family:var(--font-mono);font-size:0.52rem;color:var(--ink-dim,#7A85B0);margin-top:0.15rem;letter-spacing:0.04em;}
  @media(max-width:480px){.header-tagline{display:none}}
  .site-footer{border-top:1px solid var(--rule,#1A2240);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;background:var(--surface,#0F1320);}
  .footer-left{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim,#7A85B0);}
  .footer-left strong{color:var(--accent,#6C8EF5);font-weight:500;}
  .footer-right{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim,#7A85B0);}
`;

const css = `
${FONTS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #080b14;
  --glass: rgba(255,255,255,0.06);
  --glass-border: rgba(255,255,255,0.10);
  --glass-border-bright: rgba(255,255,255,0.20);
  --text: #f0f2f8;
  --text-mid: #8b92a8;
  --text-dim: #4a5168;
  --accent: #6c8fff;
  --accent2: #a78bfa;
  --accent-glow: rgba(108,143,255,0.25);
  --green: #34d399;
  --amber: #fbbf24;
  --red: #f87171;
  --card-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset;
}

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

.bg-mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 20% 10%, rgba(108,143,255,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.07) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 60% 30%, rgba(52,211,153,0.04) 0%, transparent 50%);
}

.app { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

/* ── HEADER ── */
.hdr {
  padding: 16px 32px; display: flex; align-items: center; gap: 14px;
  border-bottom: 1px solid var(--glass-border);
  backdrop-filter: blur(12px); background: rgba(8,11,20,0.8);
  position: sticky; top: 0; z-index: 100;
}
.logo-mark {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; box-shadow: 0 0 16px var(--accent-glow);
}
.logo-text { font-size: 15px; font-weight: 600; letter-spacing: -0.3px; }
.logo-text span { color: var(--accent); }
.hdr-pill {
  margin-left: auto; font-family: 'DM Mono', monospace; font-size: 10px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-mid);
  background: var(--glass); border: 1px solid var(--glass-border);
  padding: 5px 12px; border-radius: 20px; white-space: nowrap;
}

/* ── LAYOUT ── */
.main {
  flex: 1; display: grid;
  grid-template-columns: 420px 1fr;
  min-height: calc(100vh - 65px);
}

/* ── INPUT PANEL ── */
.inp-side {
  padding: 28px 24px; border-right: 1px solid var(--glass-border);
  display: flex; flex-direction: column; gap: 18px; overflow-y: auto;
}
.inp-heading { font-size: 20px; font-weight: 600; letter-spacing: -0.4px; line-height: 1.3; }
.inp-heading span {
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.inp-sub { font-size: 12.5px; color: var(--text-mid); line-height: 1.6; margin-top: 3px; }
.field-label {
  font-family: 'DM Mono', monospace; font-size: 10px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-dim); margin-bottom: 7px;
}
.field-optional { color: var(--text-dim); font-weight: 400; margin-left: 4px; }

.glass-ta {
  width: 100%; background: var(--glass); border: 1px solid var(--glass-border);
  border-radius: 10px; padding: 13px 15px;
  font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text);
  outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical; line-height: 1.7;
}
.glass-ta::placeholder { color: var(--text-dim); }
.glass-ta:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.ta-main { height: 160px; }
.ta-ctx  { height: 60px; }

.char-row {
  display: flex; justify-content: flex-end;
  font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text-dim); margin-top: 3px;
}

.divider { height: 1px; background: var(--glass-border); margin: 2px 0; }

/* ── BUTTONS ── */
.analyse-btn {
  width: 100%; padding: 14px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: white;
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center;
  justify-content: center; gap: 10px; letter-spacing: -0.2px;
  box-shadow: 0 4px 20px rgba(108,143,255,0.3);
}
.analyse-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(108,143,255,0.4); }
.analyse-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.reset-btn {
  width: 100%; padding: 10px; background: transparent;
  border: 1px solid var(--glass-border); border-radius: 10px;
  font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-mid); cursor: pointer;
  transition: all 0.15s;
}
.reset-btn:hover { border-color: var(--glass-border-bright); color: var(--text); }

.spin {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── OUTPUT PANEL ── */
.out-side {
  padding: 28px 32px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 14px;
}

.idle {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--text-dim); text-align: center;
}
.idle-icon {
  width: 60px; height: 60px; border-radius: 14px;
  background: var(--glass); border: 1px solid var(--glass-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; opacity: 0.5;
}
.idle-text { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; }

/* ── GLASS CARD ── */
.gcard {
  background: var(--glass); border: 1px solid var(--glass-border);
  border-radius: 14px; padding: 20px 22px; box-shadow: var(--card-shadow);
  backdrop-filter: blur(12px);
  opacity: 0; transform: translateY(14px);
  transition: opacity 0.45s ease, transform 0.45s ease, border-color 0.2s;
}
.gcard.visible { opacity: 1; transform: translateY(0); }
.gcard:hover { border-color: var(--glass-border-bright); }

.card-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-icon {
  width: 28px; height: 28px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;
}
.icon-blue   { background: rgba(108,143,255,0.15); }
.icon-amber  { background: rgba(251,191,36,0.15); }
.icon-green  { background: rgba(52,211,153,0.15); }
.icon-purple { background: rgba(167,139,250,0.15); }

.card-title {
  font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 600;
  letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-mid);
}

/* loading dots */
.ldots { display: flex; align-items: center; gap: 8px; font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text-dim); }
.ldots .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
.ldots .dot:nth-child(2) { animation-delay: 0.2s; }
.ldots .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }

/* ── DECODE ── */
.decode-text { font-size: 13.5px; line-height: 1.8; color: var(--text); }
.inference-tag {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 10px;
  background: rgba(108,143,255,0.12); border: 1px solid rgba(108,143,255,0.2);
  border-radius: 6px; padding: 4px 10px;
  font-family: 'DM Mono', monospace; font-size: 10px; color: var(--accent);
}

/* ── SCORE RING ── */
.score-row { display: flex; align-items: center; gap: 18px; }
.score-ring { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
.score-ring svg { width: 72px; height: 72px; }
.score-num {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 500;
}
.score-meta { flex: 1; }
.score-lbl { font-size: 16px; font-weight: 600; letter-spacing: -0.3px; margin-bottom: 4px; }
.score-reason { font-size: 12px; color: var(--text-mid); line-height: 1.6; }
.c-low  { color: var(--red); }
.c-mid  { color: var(--amber); }
.c-high { color: var(--green); }
.s-low  { stroke: var(--red); }
.s-mid  { stroke: var(--amber); }
.s-high { stroke: var(--green); }

/* ── TASKS ── */
.task-list { display: flex; flex-direction: column; gap: 9px; }
.task-item {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 11px 13px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: background 0.15s;
}
.task-item:hover { background: rgba(255,255,255,0.05); }
.task-num { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--green); min-width: 20px; margin-top: 1px; }
.task-text { font-size: 13px; line-height: 1.6; color: var(--text); }

/* ── REPLY ── */
.tone-row { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.tone-lbl { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); white-space: nowrap; }
.tone-sel {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);
  border-radius: 8px; padding: 7px 11px; font-family: 'DM Sans', sans-serif;
  font-size: 12px; color: var(--text); outline: none; cursor: pointer; transition: border-color 0.2s;
}
.tone-sel option { background: #1a2035; color: #f0f2f8; }
.tone-sel:focus { border-color: var(--accent); }

.regen-btn {
  padding: 7px 13px; background: rgba(108,143,255,0.12);
  border: 1px solid rgba(108,143,255,0.2); border-radius: 8px;
  font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--accent); cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.regen-btn:hover { background: rgba(108,143,255,0.22); }
.regen-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.reply-text {
  font-size: 13px; line-height: 1.85; color: var(--text); white-space: pre-wrap;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px; padding: 13px 15px;
}

.copy-btn {
  display: flex; align-items: center; gap: 6px; margin-top: 10px;
  padding: 7px 13px; background: transparent; border: 1px solid var(--glass-border);
  border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 10px;
  letter-spacing: 1px; text-transform: uppercase; color: var(--text-mid); cursor: pointer; transition: all 0.15s;
}
.copy-btn:hover { border-color: var(--glass-border-bright); color: var(--text); }

/* ── ERROR ── */
.errbox {
  background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2);
  border-radius: 10px; padding: 13px 15px;
  font-size: 12px; color: var(--red); font-family: 'DM Mono', monospace; line-height: 1.6;
}

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 22px; right: 22px;
  background: rgba(255,255,255,0.1); backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border-bright); border-radius: 10px;
  padding: 10px 18px; font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 1px; color: var(--text); z-index: 1000; animation: toastIn 0.3s ease;
}
@keyframes toastIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

/* ── RESPONSIVE ── */
@media (max-width: 720px) {
  .main { grid-template-columns: 1fr; grid-template-rows: auto auto; }
  .inp-side { border-right: none; border-bottom: 1px solid var(--glass-border); padding: 20px 16px; max-height: none; }
  .out-side { padding: 20px 16px; }
  .hdr { padding: 12px 16px; }
  .hdr-pill { display: none; }
}
`;

// ── HELPERS ────────────────────────────────────────────────────────────────
function parseJSON(t) {
  try { return JSON.parse(t.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

// Single combined API call — returns all 4 outputs at once
const SYSTEM_ALL = `You are FeedbackTranslator, a diagnostic tool that analyses feedback and returns structured outputs.

Given feedback (and optional context), return ONLY a single valid JSON object with this exact shape:
{
  "decoded": "Plain English explanation of what the feedback is really saying. Be honest and direct about what the giver means, including subtext. 2-4 sentences.",
  "inference": "One short phrase describing the key inference made, e.g. 'Inferred: visual polish, not content depth'",
  "score": 6,
  "score_reason": "One sentence explaining why the feedback scored this specificity level.",
  "tasks": [
    "Concrete action starting with a verb",
    "Concrete action starting with a verb"
  ],
  "reply_professional": "A professional, neutral reply acknowledging the feedback and stating next steps. 3-4 sentences.",
  "reply_warm": "A warm, appreciative reply acknowledging the feedback collaboratively. 3-4 sentences.",
  "reply_direct": "A brief, direct reply. 2-3 sentences max.",
  "score_label": "Vague"
}

Score rules: 1-3=Vague, 4-6=Partial, 7-8=Specific, 9-10=Precise. score_label must match.
Tasks: 3-5 items, each a specific doable action.
No markdown, no preamble, ONLY the JSON object.`;


// ── SCORE RING ──────────────────────────────────────────────────────────────
function ScoreRing({ score, runId }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [runId]);

  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (animated ? score / 10 : 0));
  const cls = score <= 3 ? "c-low" : score <= 6 ? "c-mid" : "c-high";
  const strokeCls = score <= 3 ? "s-low" : score <= 6 ? "s-mid" : "s-high";

  return (
    <div className="score-ring">
      <svg viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)", width: 72, height: 72 }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
          className={strokeCls}
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className={`score-num ${cls}`}>{score}</div>
    </div>
  );
}

// ── CARD ────────────────────────────────────────────────────────────────────
function Card({ show, delay = 0, children }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [show, delay]);
  return <div className={`gcard ${visible ? "visible" : ""}`}>{children}</div>;
}

// ── LOADING DOTS ────────────────────────────────────────────────────────────
function LDots({ label }) {
  return <div className="ldots"><div className="dot"/><div className="dot"/><div className="dot"/><span style={{marginLeft:4}}>{label}</span></div>;
}

// ── MAIN ────────────────────────────────────────────────────────────────────
function FeedbackTranslatorApp() {
  const [feedback, setFeedback] = useState("");
  const [context, setContext]   = useState("");
  const [tone, setTone]         = useState("professional");
  const [loading, setLoading]   = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [result, setResult]     = useState(null);
  const [reply, setReply]       = useState("");
  const [error, setError]       = useState(null);
  const [runId, setRunId]       = useState(0);
  const [toast, setToast]       = useState(null);
  // step: 0=idle, 1=loading, 2=done
  const [step, setStep]         = useState(0);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  function reset() {
    setResult(null); setReply(""); setError(null); setStep(0);
  }

  async function analyse() {
    if (!feedback.trim() || loading) return;
    reset();
    setLoading(true);
    setStep(1);
    setRunId(r => r + 1);

    const userMsg = context.trim()
      ? `Context: ${context.trim()}\n\nFeedback: ${feedback.trim()}`
      : `Feedback: ${feedback.trim()}`;

    try {
      const raw = await callGemini(userMsg, 2000);
      const parsed = parseJSON(raw);
      if (!parsed || !parsed.decoded) throw new Error("Unexpected response format. Please try again.");
      setResult(parsed);
      setReply(parsed[`reply_${tone}`] || parsed.reply_professional || "");
      setStep(2);
    } catch (e) {
      setError(e.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  async function regenReply() {
    if (!result || regenLoading) return;
    setRegenLoading(true);
    const tonePrompt = `You previously decoded this feedback. Now write a single reply in a ${tone} tone.
Decoded meaning: ${result.decoded || ""}
Action tasks: ${(result.tasks || []).join("; ")}
Write only the reply text, no explanation.`;
    try {
      const text = await callGeminiRaw(tonePrompt, 800);
      if (text) setReply(text);
    } catch (e) { setError(e.message); }
    setRegenLoading(false);
  }

  // Sync reply when tone changes (use cached result)
  useEffect(() => {
    if (result) {
      const cached = result[`reply_${tone}`];
      if (cached) setReply(cached);
    }
  }, [tone, result]);

  const scoreCls = result ? (result.score <= 3 ? "c-low" : result.score <= 6 ? "c-mid" : "c-high") : "";

  return (
    <>
      <style>{css}</style>
      <div className="bg-mesh" />
      <div className="app">

        {/* HEADER */}
        <header className="hdr">
          <div className="logo-mark">⚡</div>
          <div className="logo-text">Feedback<span>Translator</span></div>
          <div className="hdr-pill">Diagnostic Tool</div>
        </header>

        <div className="main">

          {/* ── INPUT ── */}
          <div className="inp-side">
            <div>
              <div className="inp-heading">Decode any <span>feedback</span></div>
              <div className="inp-sub">Paste vague or ambiguous feedback. Get a plain-English breakdown, specificity score, action tasks, and a reply draft — instantly.</div>
            </div>

            <div>
              <div className="field-label">Feedback received</div>
              <textarea
                className="glass-ta ta-main"
                placeholder={`e.g. "This is good but needs more polish. The direction feels off — let's align next week."`}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
              />
              <div className="char-row">{feedback.length} chars</div>
            </div>

            <div>
              <div className="field-label">Context <span className="field-optional">(optional)</span></div>
              <textarea
                className="glass-ta ta-ctx"
                placeholder="What was reviewed? e.g. 'A product pitch deck for Q3 planning'"
                value={context}
                onChange={e => setContext(e.target.value)}
              />
            </div>

            <div className="divider" />

            <button className="analyse-btn" onClick={analyse} disabled={loading || !feedback.trim()}>
              {loading ? <><div className="spin" />Analysing…</> : "Analyse Feedback →"}
            </button>

            {step > 0 && (
              <button className="reset-btn" onClick={reset} disabled={loading}>Clear &amp; reset</button>
            )}
          </div>

          {/* ── OUTPUT ── */}
          <div className="out-side">

            {error && <div className="errbox">⚠ {error}</div>}

            {step === 0 && !error && (
              <div className="idle">
                <div className="idle-icon">⚡</div>
                <div className="idle-text">Awaiting feedback</div>
              </div>
            )}

            {/* Loading state — single card with spinner */}
            {step === 1 && (
              <Card show delay={0}>
                <div className="card-hdr">
                  <div className="card-icon icon-blue">🔍</div>
                  <div className="card-title">Analysing</div>
                </div>
                <LDots label="Running full diagnostic…" />
              </Card>
            )}

            {/* Results — 4 cards staggered */}
            {step === 2 && result && (
              <>
                {/* CARD 1 — DECODE */}
                <Card show={true} delay={0}>
                  <div className="card-hdr">
                    <div className="card-icon icon-blue">🔍</div>
                    <div className="card-title">Decoded</div>
                  </div>
                  <div className="decode-text">{result.decoded}</div>
                  {result.inference && (
                    <div className="inference-tag">◈ {result.inference}</div>
                  )}
                </Card>

                {/* CARD 2 — SCORE */}
                <Card show={true} delay={150}>
                  <div className="card-hdr">
                    <div className="card-icon icon-amber">📊</div>
                    <div className="card-title">Specificity Score</div>
                  </div>
                  <div className="score-row">
                    <ScoreRing key={runId} score={result.score} runId={runId} />
                    <div className="score-meta">
                      <div className={`score-lbl ${scoreCls}`}>{result.score_label} — {result.score}/10</div>
                      <div className="score-reason">{result.score_reason}</div>
                    </div>
                  </div>
                </Card>

                {/* CARD 3 — TASKS */}
                <Card show={true} delay={300}>
                  <div className="card-hdr">
                    <div className="card-icon icon-green">✅</div>
                    <div className="card-title">Action Tasks</div>
                  </div>
                  <div className="task-list">
                    {result.tasks?.map((t, i) => (
                      <div className="task-item" key={i}>
                        <div className="task-num">{String(i + 1).padStart(2, "0")}</div>
                        <div className="task-text">{t}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* CARD 4 — REPLY */}
                <Card show={true} delay={450}>
                  <div className="card-hdr">
                    <div className="card-icon icon-purple">✉️</div>
                    <div className="card-title">Reply Draft</div>
                  </div>
                  <div className="tone-row">
                    <div className="tone-lbl">Tone</div>
                    <select className="tone-sel" value={tone} onChange={e => setTone(e.target.value)}>
                      <option value="professional">Professional</option>
                      <option value="warm">Warm</option>
                      <option value="direct">Direct</option>
                    </select>
                    <button className="regen-btn" onClick={regenReply} disabled={regenLoading}>
                      {regenLoading ? "…" : "↻ Regen"}
                    </button>
                  </div>
                  {reply && (
                    <>
                      <div className="reply-text">{reply}</div>
                      <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(reply); showToast("Copied ✓"); }}>
                        ⎘ Copy reply
                      </button>
                    </>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
          {/* ══ FOOTER ══ */}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
    </>
  );
}

export default function FeedbackTranslator() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("feedback-translator");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <FeedbackTranslatorApp />
    </>
  );
}
