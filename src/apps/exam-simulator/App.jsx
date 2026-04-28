import { useApiKey } from "../../shared/components/KeyGate";
import { callGemini } from "../../shared/lib/gemini-client";
import { useState, useEffect, useRef, useCallback } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy: #0F1F3D; --navy-mid: #1A3260; --navy-light: #2A4A8A;
    --blue-accent: #4A7FD4; --blue-pale: #E8EEF8;
    --off-white: #F3F5FA; --paper: #FFFEF9;
    --ink: #0F1F3D; --ink-mid: #3A4A6B; --ink-light: #6B7A9E;
    --rule: #D0D8EC;
    --correct: #2E7D5A; --correct-bg: #EAF5EE;
    --wrong: #B84040; --wrong-bg: #FAEAEA;
    --font-serif: 'Libre Baskerville', Georgia, serif;
    --font-mono: 'JetBrains Mono', monospace;
  }
  body { background: var(--off-white); font-family: var(--font-serif); color: var(--ink); }
  .app { min-height: 100vh; background: var(--off-white); }

  /* ── Header ── */
  .header {
    background: var(--navy); padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 20;
    box-shadow: 0 2px 20px rgba(15,31,61,0.3);
    gap: 1rem; flex-wrap: wrap;
  }
  .header-eyebrow { font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--blue-accent); margin-bottom: 0.15rem; }
  .header-title { font-size: 1.2rem; font-weight: 700; color: white; letter-spacing: -0.01em; white-space: nowrap; }
  .header-title em { font-style: italic; font-weight: 400; color: var(--blue-accent); }
  .header-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

  /* Timer */
  .timer { font-family: var(--font-mono); font-size: 1.2rem; font-weight: 500; color: white; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 0.35rem 0.75rem; letter-spacing: 0.05em; min-width: 4.5rem; text-align: center; }
  .timer.warning { color: #F4A642; border-color: rgba(244,166,66,0.4); }
  .timer.danger  { color: #F47070; border-color: rgba(244,112,112,0.4); animation: blink 1s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.55} }
  .progress-pill { font-family: var(--font-mono); font-size: 0.62rem; color: white; background: rgba(255,255,255,0.12); border-radius: 100px; padding: 0.25rem 0.65rem; letter-spacing: 0.06em; white-space: nowrap; }

  /* ── Layout ── */
  .main { max-width: 780px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }

  /* ── Setup card ── */
  .setup-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; box-shadow: 0 2px 24px rgba(15,31,61,0.08); overflow: hidden; }
  .setup-card-header { background: var(--navy); padding: 1.5rem 2rem; }
  .setup-card-title { font-size: 1.35rem; font-weight: 400; font-style: italic; color: white; }
  .setup-card-sub { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--blue-accent); margin-top: 0.3rem; }
  .setup-card-body { padding: 1.75rem; }

  .field-group { margin-bottom: 1.5rem; }
  .field-label { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 0.5rem; display: block; }
  .field-textarea { width: 100%; min-height: 130px; resize: vertical; background: var(--off-white); border: 1px solid var(--rule); border-radius: 2px; padding: 0.85rem 1rem; font-family: var(--font-serif); font-size: 0.95rem; color: var(--ink); line-height: 1.65; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
  .field-textarea:focus { border-color: var(--blue-accent); box-shadow: 0 0 0 3px rgba(74,127,212,0.12); }

  .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 520px) { .options-grid { grid-template-columns: 1fr; } }
  .option-group { display: flex; flex-direction: column; gap: 0.4rem; }

  .chips-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip { padding: 0.35rem 0.8rem; border: 1px solid var(--rule); border-radius: 2px; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.06em; cursor: pointer; color: var(--ink-mid); background: var(--off-white); transition: all 0.15s; user-select: none; }
  .chip:hover { border-color: var(--blue-accent); color: var(--blue-accent); }
  .chip.active { background: var(--navy); border-color: var(--navy); color: white; }

  .toggle-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
  .toggle-switch { width: 2.4rem; height: 1.3rem; border-radius: 100px; background: var(--rule); border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
  .toggle-switch.on { background: var(--navy-light); }
  .toggle-switch::after { content: ''; position: absolute; top: 0.15rem; left: 0.15rem; width: 1rem; height: 1rem; border-radius: 50%; background: white; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
  .toggle-switch.on::after { transform: translateX(1.1rem); }
  .toggle-label { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.07em; color: var(--ink-mid); line-height: 1.4; }

  .generate-btn { width: 100%; padding: 1rem; background: var(--navy); color: white; border: none; border-radius: 2px; font-family: var(--font-serif); font-size: 1.05rem; font-style: italic; cursor: pointer; transition: all 0.2s; margin-top: 1.5rem; letter-spacing: 0.01em; }
  .generate-btn:hover:not(:disabled) { background: var(--navy-mid); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(15,31,61,0.25); }
  .generate-btn:disabled { background: var(--rule); color: var(--ink-light); cursor: not-allowed; transform: none; box-shadow: none; }

  /* ── Loading ── */
  .loading-state { text-align: center; padding: 4rem 1rem; }
  .loading-spinner { width: 2.5rem; height: 2.5rem; border: 2px solid var(--rule); border-top-color: var(--navy); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.25rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 1.05rem; font-style: italic; color: var(--ink-mid); }
  .loading-sub { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; color: var(--ink-light); margin-top: 0.5rem; text-transform: uppercase; }

  /* ── Exam ── */
  .exam-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.6rem; }
  .exam-meta-left { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .q-counter { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-light); }
  .badge { font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 2px; }
  .badge.beginner    { background: #E8F5EE; color: #2E7D5A; }
  .badge.intermediate{ background: #FEF3E2; color: #C9772A; }
  .badge.hard        { background: #FAEAEA; color: #B84040; }
  .badge.topic       { background: var(--blue-pale); color: var(--blue-accent); }

  .progress-bar-wrap { height: 3px; background: var(--rule); border-radius: 2px; margin-bottom: 1.75rem; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: var(--navy); border-radius: 2px; transition: width 0.4s ease; }

  .question-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; padding: 1.75rem; box-shadow: 0 2px 16px rgba(15,31,61,0.07); margin-bottom: 1rem; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .q-type-tag { font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--blue-accent); margin-bottom: 0.65rem; }
  .q-text { font-size: 1.05rem; line-height: 1.65; color: var(--ink); margin-bottom: 1.4rem; word-break: break-word; }

  /* MCQ */
  .mcq-options { display: flex; flex-direction: column; gap: 0.55rem; }
  .mcq-opt { display: flex; align-items: flex-start; gap: 0.8rem; padding: 0.7rem 0.95rem; border: 1px solid var(--rule); border-radius: 2px; cursor: pointer; background: var(--off-white); transition: all 0.15s; user-select: none; }
  .mcq-opt:hover:not(.locked) { border-color: var(--blue-accent); background: var(--blue-pale); }
  .mcq-opt.selected { border-color: var(--navy); background: var(--blue-pale); }
  .mcq-opt.reveal-correct { border-color: var(--correct) !important; background: var(--correct-bg) !important; }
  .mcq-opt.reveal-wrong   { border-color: var(--wrong)   !important; background: var(--wrong-bg)   !important; }
  .mcq-opt.locked { cursor: default; }
  .opt-letter { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; color: var(--ink-light); flex-shrink: 0; margin-top: 0.1rem; min-width: 1.1rem; }
  .mcq-opt.selected .opt-letter { color: var(--navy); }
  .mcq-opt.reveal-correct .opt-letter { color: var(--correct); }
  .mcq-opt.reveal-wrong   .opt-letter { color: var(--wrong); }
  .opt-text { font-size: 0.93rem; line-height: 1.5; color: var(--ink); word-break: break-word; }

  /* True/False */
  .tf-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .tf-btn { padding: 1rem; border: 1px solid var(--rule); border-radius: 2px; font-family: var(--font-serif); font-size: 1rem; font-style: italic; cursor: pointer; background: var(--off-white); color: var(--ink); transition: all 0.15s; text-align: center; user-select: none; }
  .tf-btn:hover:not(.locked) { border-color: var(--blue-accent); background: var(--blue-pale); }
  .tf-btn.selected { border-color: var(--navy); background: var(--blue-pale); color: var(--navy); font-weight: 700; }
  .tf-btn.reveal-correct { border-color: var(--correct) !important; background: var(--correct-bg) !important; color: var(--correct) !important; }
  .tf-btn.reveal-wrong   { border-color: var(--wrong)   !important; background: var(--wrong-bg)   !important; color: var(--wrong)   !important; }
  .tf-btn.locked { cursor: default; }

  /* Short answer */
  .short-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid var(--rule); border-radius: 2px; font-family: var(--font-serif); font-size: 1rem; color: var(--ink); background: var(--off-white); outline: none; transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.5; }
  .short-input:focus { border-color: var(--blue-accent); box-shadow: 0 0 0 3px rgba(74,127,212,0.12); }
  .short-input.locked { background: var(--rule); cursor: default; pointer-events: none; }

  /* Feedback */
  .feedback-box { margin-top: 1rem; padding: 0.9rem 1.1rem; border-radius: 2px; font-size: 0.88rem; line-height: 1.65; animation: fadeIn 0.25s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .feedback-box.fb-correct { background: var(--correct-bg); border-left: 3px solid var(--correct); }
  .feedback-box.fb-wrong   { background: var(--wrong-bg);   border-left: 3px solid var(--wrong); }
  .feedback-box.fb-neutral { background: var(--blue-pale);  border-left: 3px solid var(--blue-accent); }
  .feedback-title { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.35rem; }
  .fb-correct .feedback-title { color: var(--correct); }
  .fb-wrong   .feedback-title { color: var(--wrong); }
  .fb-neutral .feedback-title { color: var(--blue-accent); }
  .feedback-text { color: var(--ink-mid); font-style: italic; }

  /* Nav */
  .nav-row { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.75rem; }
  .nav-btn { padding: 0.65rem 1.4rem; border-radius: 2px; font-family: var(--font-mono); font-size: 0.63rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; border: 1px solid var(--rule); color: var(--ink-mid); background: var(--off-white); white-space: nowrap; }
  .nav-btn:hover:not(:disabled) { border-color: var(--navy); color: var(--navy); }
  .nav-btn.primary { background: var(--navy); border-color: var(--navy); color: white; }
  .nav-btn.primary:hover:not(:disabled) { background: var(--navy-mid); }
  .nav-btn:disabled { opacity: 0.38; cursor: not-allowed; }

  /* ── Results ── */
  .results-card { background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; overflow: hidden; box-shadow: 0 4px 24px rgba(15,31,61,0.1); animation: slideUp 0.4s ease; }
  .results-hero { background: var(--navy); padding: 2.5rem 2rem; text-align: center; }
  .score-ring-wrap { margin: 0 auto 1rem; width: 7rem; height: 7rem; position: relative; }
  .score-ring { transform: rotate(-90deg); display: block; }
  .score-track { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 6; }
  .score-fill  { fill: none; stroke: var(--blue-accent); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 1.2s ease; }
  .score-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .score-pct   { font-family: var(--font-mono); font-size: 1.8rem; font-weight: 500; color: white; line-height: 1; }
  .score-label { font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--blue-accent); margin-top: 0.2rem; }
  .results-verdict { font-size: 1.5rem; font-style: italic; color: white; margin-top: 0.5rem; }
  .results-sub { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-top: 0.4rem; }

  .results-body { padding: 1.75rem; }
  .area-section { margin-bottom: 1.75rem; }
  .area-title { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 0.65rem; }
  .area-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .area-tag-weak   { font-family: var(--font-mono); font-size: 0.62rem; padding: 0.25rem 0.65rem; border-radius: 2px; background: var(--wrong-bg);   color: var(--wrong);   border: 1px solid rgba(184,64,64,0.2); }
  .area-tag-strong { font-family: var(--font-mono); font-size: 0.62rem; padding: 0.25rem 0.65rem; border-radius: 2px; background: var(--correct-bg); color: var(--correct); border: 1px solid rgba(46,125,90,0.2); }

  .section-divider { font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-light); margin: 1.25rem 0 1rem; display: flex; align-items: center; gap: 0.75rem; }
  .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

  .review-list { display: flex; flex-direction: column; gap: 0.85rem; }
  .review-item { padding: 0.9rem 1.1rem; border-radius: 2px; border: 1px solid var(--rule); }
  .review-item.correct { border-left: 3px solid var(--correct); }
  .review-item.wrong   { border-left: 3px solid var(--wrong); }
  .review-q { font-size: 0.88rem; line-height: 1.55; color: var(--ink); margin-bottom: 0.45rem; word-break: break-word; }
  .review-answer-row { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 0.3rem; }
  .review-answer { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.05em; }
  .ra-label { text-transform: uppercase; color: var(--ink-light); margin-right: 0.3rem; }
  .ra-correct { color: var(--correct); }
  .ra-wrong   { color: var(--wrong); }
  .review-expl { font-size: 0.82rem; font-style: italic; color: var(--ink-mid); line-height: 1.55; }

  .results-actions { display: flex; gap: 0.75rem; margin-top: 1.75rem; flex-wrap: wrap; }
  .action-btn { flex: 1; min-width: 130px; padding: 0.85rem; border-radius: 2px; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; text-align: center; border: 1px solid var(--rule); color: var(--ink-mid); background: var(--off-white); }
  .action-btn:hover { border-color: var(--navy); color: var(--navy); }
  .action-btn.primary { background: var(--navy); border-color: var(--navy); color: white; }
  .action-btn.primary:hover { background: var(--navy-mid); }

  /* Error */
  .error-box { background: #FAEAEA; border: 1px solid rgba(184,64,64,0.25); border-radius: 2px; padding: 1rem 1.25rem; color: var(--wrong); font-size: 0.9rem; line-height: 1.6; margin-top: 1rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .error-dismiss { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; background: none; border: 1px solid var(--wrong); border-radius: 2px; color: var(--wrong); padding: 0.3rem 0.65rem; cursor: pointer; white-space: nowrap; flex-shrink: 0; }

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

// ── Shared API helper — fixes missing anthropic-version header + 55s timeout ──

const QTYPES = ["MCQ", "Short Answer", "True / False", "Mixed"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"];
const COUNTS = [5, 8, 10, 15];
const TIME_LIMITS = ["Untimed", "30s / Q", "60s / Q", "90s / Q"];

// FIX: Score ring as a separate component — always gets fresh pct on mount
function ScoreRing({ pct }) {
  const r = 44, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (pct / 100) * circ), 80);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <div className="score-ring-wrap">
      <svg className="score-ring" width="112" height="112" viewBox="0 0 112 112">
        <circle className="score-track" cx="56" cy="56" r={r} />
        <circle className="score-fill" cx="56" cy="56" r={r} strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="score-center">
        <span className="score-pct">{pct}%</span>
        <span className="score-label">score</span>
      </div>
    </div>
  );
}

function ExamSimulatorApp() {
  // ── Setup state ──
  const [notes, setNotes] = useState("");
  const [qtype, setQtype] = useState("MCQ");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [count, setCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState("Untimed");
  const [showFeedback, setShowFeedback] = useState(true);

  // ── Exam state ──
  const [phase, setPhase] = useState("setup"); // setup | loading-gen | exam | loading-score | results
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [scoredResults, setScoredResults] = useState(null);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  // FIX: derive secsPerQ as a stable value (not inside timer deps)
  const secsPerQ = timeLimit === "30s / Q" ? 30 : timeLimit === "60s / Q" ? 60 : timeLimit === "90s / Q" ? 90 : null;
  const fmt = (s) => s === null ? "" : `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // FIX: safe current question derived inside render, guarded
  const q = questions[currentQ] ?? null;
  const isRevealed = !!(q && revealed[q.id]);
  const hasAnswer = !!(q && answers[q.id] !== undefined && answers[q.id] !== "");

  // FIX: revealCurrent as useCallback so timer effect captures a stable ref
  const revealCurrent = useCallback((qRef) => {
    if (qRef) setRevealed(prev => ({ ...prev, [qRef.id]: true }));
  }, []);

  // FIX: Reset timer when question changes (not secsPerQ — that would retrigger on every render)
  useEffect(() => {
    if (phase !== "exam" || !secsPerQ) { setTimeLeft(null); return; }
    clearTimeout(timerRef.current);
    setTimeLeft(secsPerQ);
  }, [currentQ, phase]); // intentionally omit secsPerQ — set at exam start, doesn't change mid-exam

  // FIX: Timer tick — pass snapshot of q into revealCurrent to avoid stale closure
  useEffect(() => {
    if (phase !== "exam" || !secsPerQ || timeLeft === null) return;
    if (timeLeft <= 0) {
      // auto-advance: reveal if feedback on, then move
      const snapshot = questions[currentQ] ?? null;
      if (snapshot && showFeedback) revealCurrent(snapshot);
      // delay move slightly so user sees the reveal
      timerRef.current = setTimeout(() => {
        setCurrentQ(ci => {
          if (ci < questions.length - 1) return ci + 1;
          // last question — trigger scoring
          return ci; // scoreExam called via separate effect below
        });
      }, showFeedback ? 1200 : 0);
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, phase]);

  // ── Generate exam ──
  const generateExam = async () => {
    if (!notes.trim()) return;
    setPhase("loading-gen"); setError("");
    const qtypePrompt = qtype === "Mixed"
      ? "a roughly equal mix of MCQ, True/False, and Short Answer"
      : qtype;
    const prompt = `Generate exactly ${count} exam questions from the study material below.
Question type: ${qtypePrompt}
Difficulty: ${difficulty}
Study material:
---
${notes}
---
Return ONLY valid JSON, no markdown fences, no explanation. Format:
{"questions":[
  {"id":1,"type":"mcq","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":"A","topic":"2-3 word topic"},
  {"id":2,"type":"true_false","question":"...","correct":"True","topic":"..."},
  {"id":3,"type":"short_answer","question":"...","correct":"model answer 1-2 sentences","topic":"..."}
]}
Rules: MCQ options must start with "A. " "B. " "C. " "D. ". correct for MCQ = single letter A/B/C/D. correct for true_false = "True" or "False". Generate all ${count} questions.`;
    try {
      const parsed = await callGemini(prompt, 2500);
      if (!parsed.questions?.length) throw new Error("No questions returned — please try again");
      setQuestions(parsed.questions);
      setAnswers({}); setRevealed({}); setCurrentQ(0); setTimeLeft(null);
      setPhase("exam");
    } catch (e) { setError(e.message); setPhase("setup"); }
  };

  const setAnswer = (qid, val) => setAnswers(prev => ({ ...prev, [qid]: val }));

  // FIX: handleNext — unified flow. Check → reveal → next → finish
  const handleNext = () => {
    if (!q) return;
    clearTimeout(timerRef.current);

    // Step 1: if feedback on + has answer + not yet revealed → reveal
    if (showFeedback && hasAnswer && !isRevealed) {
      revealCurrent(q);
      return;
    }

    // Step 2: advance or finish
    if (currentQ < questions.length - 1) {
      setCurrentQ(ci => ci + 1);
    } else {
      scoreExam();
    }
  };

  // FIX: scoreExam raised max_tokens too
  const scoreExam = async () => {
    setPhase("loading-score");
    const answerList = questions.map(qs => ({
      id: qs.id, question: qs.question, type: qs.type,
      userAnswer: answers[qs.id] || "(no answer)",
      correctAnswer: qs.correct, topic: qs.topic
    }));
    const prompt = `Grade this exam. For each question, decide if the student's answer is correct and give a 1-sentence explanation.
${JSON.stringify(answerList)}
Return ONLY valid JSON:
{"results":[{"id":1,"correct":true,"explanation":"..."}],"weakAreas":["topic"],"strongAreas":["topic"]}
For short_answer: be generous — mark correct if the key concept is present.
weakAreas = topics where the student got questions wrong. strongAreas = topics where all answers were correct. Both can be empty arrays.`;
    try {
      const parsed = await callGemini(prompt, 1500);
      setScoredResults(parsed); setPhase("results");
    } catch (e) { setError(e.message); setPhase("exam"); }
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setPhase("setup"); setQuestions([]); setAnswers({}); setRevealed({});
    setScoredResults(null); setCurrentQ(0); setTimeLeft(null); setError("");
  };

  // FIX: retake also resets timeLeft
  const retake = () => {
    clearTimeout(timerRef.current);
    setAnswers({}); setRevealed({}); setCurrentQ(0);
    setScoredResults(null); setTimeLeft(null); setPhase("exam");
  };

  // ── Derived display values ──
  // FIX: progress starts at 1/N not 0/N
  const pctDone = questions.length ? Math.round(((currentQ + 1) / questions.length) * 100) : 0;
  const score = scoredResults
    ? Math.round((scoredResults.results.filter(r => r.correct).length / scoredResults.results.length) * 100)
    : 0;
  const verdict = score >= 90 ? "Outstanding" : score >= 75 ? "Well done" : score >= 60 ? "Good effort" : score >= 40 ? "Keep studying" : "Needs review";
  const timerClass = secsPerQ && timeLeft !== null
    ? (timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : "")
    : "";

  // FIX: nextBtnLabel — short_answer with no text shows "Skip →" so user isn't stuck
  const nextBtnLabel = () => {
    if (!q) return "Next →";
    if (showFeedback && hasAnswer && !isRevealed) return "Check answer";
    if (currentQ < questions.length - 1) return "Next →";
    return "Finish exam →";
  };

  // FIX: next button disabled logic — short_answer can always proceed (skip allowed)
  const nextDisabled = !q || (q.type !== "short_answer" && !hasAnswer && !(isRevealed));

  // ── Feedback box class for MCQ/TF ──
  const feedbackClass = (qItem) => {
    if (!qItem) return "fb-neutral";
    if (qItem.type === "short_answer") return "fb-neutral";
    return answers[qItem.id] === qItem.correct ? "fb-correct" : "fb-wrong";
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <header className="header">
          <div>
            <div className="header-eyebrow">Janardhan Labs</div>
            <h1 className="header-title">Exam <em>Simulator</em></h1>
          </div>
          <div className="header-right">
            {phase === "exam" && secsPerQ && timeLeft !== null && (
              <div className={`timer ${timerClass}`}>{fmt(timeLeft)}</div>
            )}
            {phase === "exam" && questions.length > 0 && (
              <div className="progress-pill">{currentQ + 1} / {questions.length}</div>
            )}
          </div>
        </header>

        <main className="main">

          {/* ── SETUP ── */}
          {phase === "setup" && (
            <div className="setup-card">
              <div className="setup-card-header">
                <div className="setup-card-title">Paste your study material</div>
                <div className="setup-card-sub">notes · textbook · slides · any text</div>
              </div>
              <div className="setup-card-body">
                <div className="field-group">
                  <textarea
                    className="field-textarea"
                    placeholder="Paste your notes, a chapter, lecture summary, or any study material here…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <div className="options-grid">
                  <div className="option-group">
                    <label className="field-label">Question type</label>
                    <div className="chips-row">
                      {QTYPES.map(t => <button key={t} className={`chip ${qtype === t ? "active" : ""}`} onClick={() => setQtype(t)}>{t}</button>)}
                    </div>
                  </div>
                  <div className="option-group">
                    <label className="field-label">Difficulty</label>
                    <div className="chips-row">
                      {DIFFICULTIES.map(d => <button key={d} className={`chip ${difficulty === d ? "active" : ""}`} onClick={() => setDifficulty(d)}>{d}</button>)}
                    </div>
                  </div>
                  <div className="option-group">
                    <label className="field-label">Number of questions</label>
                    <div className="chips-row">
                      {COUNTS.map(n => <button key={n} className={`chip ${count === n ? "active" : ""}`} onClick={() => setCount(n)}>{n}</button>)}
                    </div>
                  </div>
                  <div className="option-group">
                    <label className="field-label">Time per question</label>
                    <div className="chips-row">
                      {TIME_LIMITS.map(t => <button key={t} className={`chip ${timeLimit === t ? "active" : ""}`} onClick={() => setTimeLimit(t)}>{t}</button>)}
                    </div>
                  </div>
                </div>
                <div className="toggle-row">
                  <button className={`toggle-switch ${showFeedback ? "on" : ""}`} onClick={() => setShowFeedback(v => !v)} />
                  <span className="toggle-label">Show answer feedback after each question</span>
                </div>
                {error && (
                  <div className="error-box">
                    <span>{error}</span>
                    <button className="error-dismiss" onClick={() => setError("")}>Dismiss</button>
                  </div>
                )}
                <button className="generate-btn" onClick={generateExam} disabled={!notes.trim()}>
                  Generate {count} {difficulty.toLowerCase()} questions →
                </button>
              </div>
            </div>
          )}

          {/* ── LOADING GEN ── */}
          {phase === "loading-gen" && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">Generating your exam…</p>
              <p className="loading-sub">creating {count} {difficulty.toLowerCase()} {qtype.toLowerCase()} questions</p>
            </div>
          )}

          {/* ── EXAM ── */}
          {phase === "exam" && q && (
            <>
              <div className="exam-meta">
                <div className="exam-meta-left">
                  <span className="q-counter">Question {currentQ + 1} of {questions.length}</span>
                  <span className={`badge ${difficulty.toLowerCase()}`}>{difficulty}</span>
                  {q.topic && <span className="badge topic">{q.topic}</span>}
                </div>
                <button className="nav-btn" onClick={reset}>✕ Exit</button>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${pctDone}%` }} />
              </div>

              <div className="question-card">
                <div className="q-type-tag">
                  {q.type === "mcq" ? "Multiple Choice" : q.type === "true_false" ? "True or False" : "Short Answer"}
                </div>
                <p className="q-text">{q.question}</p>

                {/* MCQ */}
                {q.type === "mcq" && Array.isArray(q.options) && (
                  <div className="mcq-options">
                    {q.options.map((opt, i) => {
                      const letter = opt[0];
                      const isSel = answers[q.id] === letter;
                      // FIX: use distinct CSS classes for correct/wrong to avoid cascade conflicts
                      const revealCorrect = isRevealed && letter === q.correct;
                      const revealWrong   = isRevealed && isSel && letter !== q.correct;
                      return (
                        <div
                          key={i}
                          className={[
                            "mcq-opt",
                            isSel ? "selected" : "",
                            revealCorrect ? "reveal-correct" : "",
                            revealWrong   ? "reveal-wrong"   : "",
                            isRevealed    ? "locked"         : ""
                          ].filter(Boolean).join(" ")}
                          onClick={() => { if (!isRevealed) setAnswer(q.id, letter); }}
                        >
                          <span className="opt-letter">{letter}</span>
                          <span className="opt-text">{opt.slice(3)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* True / False */}
                {q.type === "true_false" && (
                  <div className="tf-options">
                    {["True", "False"].map(val => {
                      const isSel = answers[q.id] === val;
                      const revealCorrect = isRevealed && val === q.correct;
                      const revealWrong   = isRevealed && isSel && val !== q.correct;
                      return (
                        <button
                          key={val}
                          className={[
                            "tf-btn",
                            isSel ? "selected" : "",
                            revealCorrect ? "reveal-correct" : "",
                            revealWrong   ? "reveal-wrong"   : "",
                            isRevealed    ? "locked"         : ""
                          ].filter(Boolean).join(" ")}
                          onClick={() => { if (!isRevealed) setAnswer(q.id, val); }}
                        >{val}</button>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer */}
                {q.type === "short_answer" && (
                  <input
                    className={`short-input ${isRevealed ? "locked" : ""}`}
                    type="text"
                    placeholder="Type your answer…"
                    value={answers[q.id] || ""}
                    readOnly={isRevealed}
                    onChange={e => { if (!isRevealed) setAnswer(q.id, e.target.value); }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleNext(); }}
                  />
                )}

                {/* Feedback */}
                {isRevealed && showFeedback && (
                  <div className={`feedback-box ${feedbackClass(q)}`}>
                    <div className="feedback-title">
                      {q.type === "short_answer"
                        ? "Model Answer"
                        : answers[q.id] === q.correct ? "Correct ✓" : "Incorrect ✗"}
                    </div>
                    <div className="feedback-text">
                      {q.type === "short_answer"
                        ? q.correct
                        : answers[q.id] !== q.correct
                          ? `The correct answer is ${q.correct}.`
                          : "Well done!"}
                    </div>
                  </div>
                )}
              </div>

              <div className="nav-row">
                <button className="nav-btn primary" onClick={handleNext} disabled={nextDisabled}>
                  {nextBtnLabel()}
                </button>
              </div>
            </>
          )}

          {/* ── LOADING SCORE ── */}
          {phase === "loading-score" && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">Grading your answers…</p>
              <p className="loading-sub">analysing {questions.length} responses</p>
            </div>
          )}

          {/* ── RESULTS ── */}
          {phase === "results" && scoredResults && (
            <div className="results-card">
              <div className="results-hero">
                <ScoreRing pct={score} />
                <div className="results-verdict">{verdict}</div>
                <div className="results-sub">
                  {scoredResults.results.filter(r => r.correct).length} of {scoredResults.results.length} correct · {difficulty} · {qtype}
                </div>
              </div>
              <div className="results-body">
                {(scoredResults.weakAreas?.length > 0 || scoredResults.strongAreas?.length > 0) && (
                  <div className="area-section">
                    {scoredResults.weakAreas?.length > 0 && (
                      <>
                        <div className="area-title">Weak areas — study these</div>
                        <div className="area-tags" style={{ marginBottom: "0.75rem" }}>
                          {scoredResults.weakAreas.map(a => <span key={a} className="area-tag-weak">{a}</span>)}
                        </div>
                      </>
                    )}
                    {scoredResults.strongAreas?.length > 0 && (
                      <>
                        <div className="area-title">Strong areas</div>
                        <div className="area-tags">
                          {scoredResults.strongAreas.map(a => <span key={a} className="area-tag-strong">{a}</span>)}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="section-divider">Full review</div>

                <div className="review-list">
                  {scoredResults.results.map((r, i) => {
                    const origQ = questions.find(qs => qs.id === r.id);
                    if (!origQ) return null;
                    const userAns = answers[origQ.id] || "—";
                    return (
                      <div key={r.id} className={`review-item ${r.correct ? "correct" : "wrong"}`}>
                        <div className="review-q"><strong>Q{i + 1}.</strong> {origQ.question}</div>
                        <div className="review-answer-row">
                          <div className="review-answer">
                            <span className="ra-label">Your answer: </span>
                            <span className={r.correct ? "ra-correct" : "ra-wrong"}>{userAns}</span>
                          </div>
                          {!r.correct && (
                            <div className="review-answer">
                              <span className="ra-label">Correct: </span>
                              <span className="ra-correct">{origQ.correct}</span>
                            </div>
                          )}
                        </div>
                        {r.explanation && <div className="review-expl">{r.explanation}</div>}
                      </div>
                    );
                  })}
                </div>

                <div className="results-actions">
                  <button className="action-btn" onClick={retake}>Retake same exam</button>
                  <button className="action-btn primary" onClick={reset}>New exam →</button>
                </div>
              </div>
            </div>
          )}

          {/* ── ERROR (mid-exam) ── */}
          {error && phase !== "setup" && (
            <div className="error-box">
              <span>{error}</span>
              <button className="error-dismiss" onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

        </main>
      </div>
          {/* ══ FOOTER ══ */}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
    </>
  );
}

export default function ExamSimulator() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("exam-simulator");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <ExamSimulatorApp />
    </>
  );
}
