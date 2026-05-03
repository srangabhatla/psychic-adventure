import { callGemini, setAppContext } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState, useEffect } from "react";


const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Fira+Code:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:         #08111C;
    --surface:    #0D1A27;
    --surface2:   #132030;
    --surface3:   #1A2A3A;
    --teal:       #00C9A7;
    --teal-dim:   #007A66;
    --teal-pale:  #00150F;
    --teal-glow:  rgba(0,201,167,0.12);
    --teal-glow2: rgba(0,201,167,0.06);
    --coral:      #FF6B6B;
    --coral-dim:  #8B2A2A;
    --coral-pale: #1A0808;
    --gold:       #FFD166;
    --gold-dim:   #8A6A20;
    --gold-pale:  #1A1200;
    --slate:      #4A6580;
    --rule:       #162030;
    --rule2:      #1E2E40;
    --ink:        #D8E8F0;
    --ink-mid:    #7A9AB0;
    --ink-dim:    #3A5468;
    --font-head:  'Syne', sans-serif;
    --font-mono:  'Fira Code', monospace;
  }

  body { background: var(--bg); color: var(--ink); font-family: var(--font-head); }
  .app { min-height: 100vh; background: var(--bg); position: relative; overflow-x: hidden; }

  /* ── Scanline texture overlay ── */
  .app::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.08) 2px,
      rgba(0,0,0,0.08) 4px
    );
  }

  /* ── Corner glow ── */
  .app::after {
    content: '';
    position: fixed; top: -200px; right: -200px;
    width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,201,167,0.06) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }

  .content { position: relative; z-index: 1; }

  /* ── Header ── */
  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--rule2);
    padding: 1.25rem 2rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }

  .logo-area { display: flex; align-items: center; gap: 1rem; }

  .logo-badge {
    width: 36px; height: 36px; border-radius: 6px;
    background: var(--teal); display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .logo-badge-inner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--bg);
    position: relative;
  }
  .logo-badge-inner::after {
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--bg);
  }

  .logo-text { display: flex; flex-direction: column; gap: 0.1rem; }
  .logo-name {
    font-family: var(--font-head); font-size: 1.1rem; font-weight: 800;
    color: var(--ink); letter-spacing: -0.02em; line-height: 1;
  }
  .logo-name span { color: var(--teal); }
  .logo-sub {
    font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-dim);
  }

  .header-right { display: flex; align-items: center; gap: 0.75rem; }
  .status-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--teal);
    animation: statusPulse 2.5s ease-in-out infinite; flex-shrink: 0;
  }
  @keyframes statusPulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 var(--teal-glow)} 50%{opacity:0.7;box-shadow:0 0 0 4px transparent} }
  .status-label {
    font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ink-dim);
  }
  @media(max-width:440px){ .header-right { display: none; } }

  /* ── Main ── */
  .main { max-width: 840px; margin: 0 auto; padding: 2rem 1.5rem 5rem; }

  /* ── Section label ── */
  .section-tag {
    font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--teal-dim);
    display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;
  }
  .section-tag::before { content: '//'; color: var(--teal); font-weight: 500; }
  .section-tag::after { content: ''; flex: 1; height: 1px; background: var(--rule2); }

  /* ── Input panel ── */
  .input-panel {
    background: var(--surface);
    border: 1px solid var(--rule2);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .panel-bar {
    background: var(--surface2);
    padding: 0.65rem 1.25rem;
    display: flex; align-items: center; gap: 0.75rem;
    border-bottom: 1px solid var(--rule2);
  }
  .panel-dot { width: 8px; height: 8px; border-radius: 50%; }
  .panel-dot.r { background: var(--coral-dim); }
  .panel-dot.y { background: var(--gold-dim); }
  .panel-dot.g { background: var(--teal-dim); }
  .panel-bar-title {
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.1em;
    color: var(--ink-dim); margin-left: 0.25rem;
  }

  .panel-body { padding: 1.5rem; }

  .field-row { margin-bottom: 1.25rem; }
  .field-label {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--teal); margin-bottom: 0.5rem; display: block;
  }
  .field-label .optional {
    color: var(--ink-dim); font-weight: 300; letter-spacing: 0.06em; margin-left: 0.4rem;
  }

  .claim-textarea {
    width: 100%; min-height: 100px; resize: vertical;
    background: var(--surface2); border: 1px solid var(--rule2);
    border-radius: 4px; padding: 0.9rem 1rem;
    font-family: var(--font-head); font-size: 0.95rem; font-weight: 400;
    color: var(--ink); line-height: 1.65; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .claim-textarea:focus {
    border-color: var(--teal-dim);
    box-shadow: 0 0 0 3px var(--teal-glow);
  }
  .claim-textarea::placeholder { color: var(--ink-dim); font-weight: 400; }

  .char-hint {
    font-family: var(--font-mono); font-size: 0.5rem; color: var(--ink-dim);
    text-align: right; margin-top: 0.3rem; letter-spacing: 0.06em;
    transition: color 0.2s;
  }
  .char-hint.warn { color: var(--gold); }
  .char-hint.ok   { color: var(--teal-dim); }

  .context-input {
    width: 100%; padding: 0.65rem 1rem;
    background: var(--surface2); border: 1px solid var(--rule2); border-radius: 4px;
    font-family: var(--font-head); font-size: 0.88rem; color: var(--ink);
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .context-input:focus {
    border-color: var(--teal-dim);
    box-shadow: 0 0 0 3px var(--teal-glow);
  }
  .context-input::placeholder { color: var(--ink-dim); }

  .controls-row {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }

  .mode-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .chips-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .chip {
    padding: 0.3rem 0.8rem; border: 1px solid var(--rule2); border-radius: 3px;
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.06em;
    cursor: pointer; color: var(--ink-mid); background: var(--surface3);
    transition: all 0.15s; user-select: none;
  }
  .chip:hover { border-color: var(--teal-dim); color: var(--teal); }
  .chip.active {
    background: var(--teal-pale); border-color: var(--teal); color: var(--teal);
    box-shadow: inset 0 0 0 1px var(--teal-glow);
  }

  .run-btn {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.7rem 1.5rem;
    background: var(--teal); color: var(--bg);
    border: none; border-radius: 4px;
    font-family: var(--font-mono); font-size: 0.65rem; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .run-btn:hover:not(:disabled) {
    background: #00E0BB;
    box-shadow: 0 0 20px rgba(0,201,167,0.4);
    transform: translateY(-1px);
  }
  .run-btn:active:not(:disabled) { transform: translateY(0); }
  .run-btn:disabled { background: var(--surface3); color: var(--ink-dim); cursor: not-allowed; box-shadow: none; transform: none; }
  .run-btn-icon { font-size: 0.8rem; }
  @media(max-width:500px){ .run-btn { width: 100%; justify-content: center; } }

  /* ── Loading ── */
  .loading-panel {
    background: var(--surface); border: 1px solid var(--rule2); border-radius: 6px;
    padding: 4rem 2rem; text-align: center;
  }
  .scan-ring {
    width: 52px; height: 52px; border-radius: 50%;
    border: 2px solid var(--rule2);
    border-top-color: var(--teal);
    border-right-color: var(--teal-dim);
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-label {
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--teal); margin-bottom: 0.5rem;
  }
  .loading-sub {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em;
    color: var(--ink-dim); text-transform: uppercase;
  }

  /* ── Results ── */
  .claim-echo {
    font-family: var(--font-head); font-size: 1rem; font-weight: 500;
    color: var(--ink); line-height: 1.55; word-break: break-word;
    overflow-wrap: anywhere; margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
    background: var(--surface); border: 1px solid var(--rule2); border-radius: 4px;
    border-left: 3px solid var(--teal);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  }
  .claim-echo-text { flex: 1; min-width: 0; }
  .claim-echo-text::before { content: '"'; color: var(--teal); margin-right: 0.2rem; }
  .claim-echo-text::after  { content: '"'; color: var(--teal); margin-left:  0.2rem; }
  .reset-btn {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-dim); background: none;
    border: 1px solid var(--rule2); border-radius: 3px;
    padding: 0.3rem 0.65rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .reset-btn:hover { border-color: var(--teal-dim); color: var(--teal); }

  /* ── Verdict block ── */
  .verdict-block {
    border-radius: 6px; border: 1px solid transparent;
    padding: 1.25rem 1.5rem;
    display: flex; gap: 1.25rem; align-items: flex-start;
    margin-bottom: 1rem; animation: riseIn 0.35s ease;
  }
  @keyframes riseIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .verdict-block.verified     { background: linear-gradient(135deg, var(--teal-pale), var(--surface)); border-color: var(--teal-dim); }
  .verdict-block.disputed     { background: linear-gradient(135deg, var(--coral-pale), var(--surface)); border-color: var(--coral-dim); }
  .verdict-block.unverifiable { background: linear-gradient(135deg, var(--gold-pale),  var(--surface)); border-color: var(--gold-dim); }
  .verdict-block.opinion      { background: var(--surface); border-color: var(--rule2); }
  .verdict-block.unknown      { background: var(--surface); border-color: var(--rule2); }

  .verdict-icon-wrap {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-family: var(--font-mono); font-size: 1rem; font-weight: 700;
  }
  .verdict-block.verified     .verdict-icon-wrap { background: var(--teal-pale); color: var(--teal); border: 1px solid var(--teal-dim); }
  .verdict-block.disputed     .verdict-icon-wrap { background: var(--coral-pale); color: var(--coral); border: 1px solid var(--coral-dim); }
  .verdict-block.unverifiable .verdict-icon-wrap { background: var(--gold-pale);  color: var(--gold);  border: 1px solid var(--gold-dim); }
  .verdict-block.opinion      .verdict-icon-wrap { background: var(--surface2); color: var(--ink-mid); border: 1px solid var(--rule2); }
  .verdict-block.unknown      .verdict-icon-wrap { background: var(--surface2); color: var(--ink-mid); border: 1px solid var(--rule2); }

  .verdict-content {}
  .verdict-tag {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.2em;
    text-transform: uppercase; margin-bottom: 0.4rem;
  }
  .verdict-block.verified     .verdict-tag { color: var(--teal); }
  .verdict-block.disputed     .verdict-tag { color: var(--coral); }
  .verdict-block.unverifiable .verdict-tag { color: var(--gold); }
  .verdict-block.opinion      .verdict-tag { color: var(--ink-mid); }
  .verdict-block.unknown      .verdict-tag { color: var(--ink-dim); }
  .verdict-text { font-size: 0.9rem; line-height: 1.65; color: var(--ink); }

  /* ── Confidence ── */
  .conf-strip {
    background: var(--surface); border: 1px solid var(--rule2); border-radius: 4px;
    padding: 0.85rem 1.25rem;
    display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;
    animation: riseIn 0.4s ease; flex-wrap: wrap;
  }
  .conf-label { font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-dim); white-space: nowrap; }
  .conf-bar-track { flex: 1; min-width: 60px; height: 4px; background: var(--rule2); border-radius: 2px; overflow: hidden; }
  .conf-bar-fill { height: 100%; border-radius: 2px; width: var(--w, 0%); transition: width 0.9s ease 0.1s; }
  .conf-num { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 500; white-space: nowrap; min-width: 3rem; text-align: right; }

  /* ── Data grid ── */
  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
  @media(max-width:560px){ .data-grid { grid-template-columns: 1fr; } }

  .data-card {
    background: var(--surface); border: 1px solid var(--rule2); border-radius: 6px;
    padding: 1rem 1.1rem; animation: riseIn 0.5s ease both;
  }
  .data-card:nth-child(1){ animation-delay: 0.06s; }
  .data-card:nth-child(2){ animation-delay: 0.12s; }
  .data-card:nth-child(3){ animation-delay: 0.18s; }
  .data-card.span2 { grid-column: 1 / -1; }

  .card-header {
    font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--teal-dim);
    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
  }
  .card-header::before { content: ''; width: 8px; height: 2px; background: var(--teal); flex-shrink: 0; }

  /* Claim type */
  .type-pill {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.3rem 0.75rem; border-radius: 100px; border: 1px solid;
    font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em;
    text-transform: capitalize; margin-bottom: 0.6rem;
  }
  .type-pill.empirical   { background: var(--teal-pale);  color: var(--teal);    border-color: var(--teal-dim); }
  .type-pill.opinion     { background: var(--surface2);   color: var(--ink-mid); border-color: var(--rule2); }
  .type-pill.statistical { background: var(--gold-pale);  color: var(--gold);    border-color: var(--gold-dim); }
  .type-pill.causal      { background: var(--coral-pale); color: var(--coral);   border-color: var(--coral-dim); }
  .type-pill.mixed       { background: var(--surface2);   color: var(--ink-mid); border-color: var(--rule2); }
  .type-pill.fallback    { background: var(--surface2);   color: var(--ink-dim); border-color: var(--rule2); }
  .type-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.7; }
  .type-expl { font-size: 0.84rem; line-height: 1.55; color: var(--ink-mid); }

  /* Evidence */
  .ev-legend-row { display: flex; gap: 0.85rem; flex-wrap: wrap; margin-bottom: 0.65rem; }
  .ev-legend-item { display: flex; align-items: center; gap: 0.3rem; font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); }
  .ev-pip { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .ev-pip.s { background: var(--teal); }
  .ev-pip.r { background: var(--coral); }
  .ev-pip.m { background: transparent; border: 1.5px solid var(--ink-dim); }

  .ev-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .ev-item { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.84rem; line-height: 1.5; color: var(--ink-mid); }
  .ev-item .ev-pip { margin-top: 0.3rem; flex-shrink: 0; }
  .ev-item.missing-item { color: var(--ink-dim); font-style: italic; }

  /* Search */
  .search-rows { display: flex; flex-direction: column; }
  .search-row {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.55rem 0; border-bottom: 1px solid var(--rule2);
    font-family: var(--font-mono); font-size: 0.65rem; color: var(--ink-mid); line-height: 1.5;
  }
  .search-row:last-child { border-bottom: none; padding-bottom: 0; }
  .search-idx { color: var(--teal-dim); flex-shrink: 0; width: 1.2rem; }

  /* ── Footer actions ── */
  .footer-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.25rem; }
  .ghost-btn {
    flex: 1; min-width: 130px; padding: 0.75rem 1rem; border-radius: 4px;
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.1em;
    text-transform: uppercase; cursor: pointer; transition: all 0.15s;
    text-align: center; border: 1px solid var(--rule2); color: var(--ink-mid); background: var(--surface);
  }
  .ghost-btn:hover { border-color: var(--teal-dim); color: var(--teal); }
  .ghost-btn.primary { background: var(--teal); border-color: var(--teal); color: var(--bg); }
  .ghost-btn.primary:hover { background: #00E0BB; box-shadow: 0 0 16px rgba(0,201,167,0.3); }

  /* ── Error ── */
  .error-strip {
    background: var(--coral-pale); border: 1px solid var(--coral-dim); border-radius: 4px;
    padding: 0.9rem 1.1rem; color: var(--coral); font-size: 0.86rem; line-height: 1.6;
    margin-top: 1rem; display: flex; align-items: flex-start;
    justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    animation: riseIn 0.25s ease;
  }
  .error-close {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase;
    background: none; border: 1px solid var(--coral-dim); border-radius: 3px;
    color: var(--coral); padding: 0.25rem 0.6rem; cursor: pointer; white-space: nowrap;
    flex-shrink: 0; transition: border-color 0.15s;
  }
  .error-close:hover { border-color: var(--coral); }

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

const MODES = ["Strict", "Balanced", "Devil's Advocate"];

const VERDICT_META = {
  verified:      { icon: "✓", tag: "Likely Accurate",       cls: "verified" },
  disputed:      { icon: "✗", tag: "Disputed / Misleading", cls: "disputed" },
  unverifiable:  { icon: "?", tag: "Unverifiable",          cls: "unverifiable" },
  opinion:       { icon: "◈", tag: "Opinion / Subjective",  cls: "opinion" },
  unknown:       { icon: "—", tag: "Could Not Determine",   cls: "unknown" },
};

const VALID_TYPES = ["empirical", "opinion", "statistical", "causal", "mixed"];

function ConfBar({ score, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), 80);
    return () => clearTimeout(t);
  }, [score]);
  return <div className="conf-bar-fill" style={{ "--w": `${w}%`, background: color }} />;
}

function ClaimLensApp() {
  const [claim, setClaim]   = useState("");
  const [ctx, setCtx]       = useState("");
  const [mode, setMode]     = useState("Balanced");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");

  const charCount  = claim.length;
  const canRun     = charCount >= 15 && !loading;
  const charHint   = charCount === 0 ? "" : charCount < 15 ? `${15 - charCount} more to go` : `${charCount} chars`;
  const charHintCls = charCount > 0 && charCount < 15 ? "warn" : charCount >= 15 ? "ok" : "";

  const run = async () => {
    if (!canRun) return;
    setLoading(true); setError(""); setResult(null);

    const prompt = `You are an expert fact-checker and epistemologist. Analyse the following claim rigorously.

Claim: "${claim.trim()}"
${ctx.trim() ? `Context: ${ctx.trim()}` : ""}
Analysis mode: ${mode}
${mode === "Strict" ? "Apply strict standards. Only return 'verified' if strong corroborating evidence clearly exists." : ""}
${mode === "Devil's Advocate" ? "Steelman the opposing view. Surface weaknesses even in claims that appear true." : ""}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "claimType": "empirical",
  "claimTypeExplanation": "one sentence explaining the category",
  "verdict": "disputed",
  "verdictSummary": "2-3 plain-English sentences explaining your ruling",
  "confidenceScore": 72,
  "evidence": {
    "supports": ["point supporting the claim"],
    "refutes": ["point refuting or complicating the claim"],
    "missing": ["key evidence that is absent or unverifiable"]
  },
  "searchSuggestions": ["specific query 1", "specific query 2", "specific query 3"]
}

Rules:
- claimType must be exactly one of: empirical, opinion, statistical, causal, mixed
- verdict must be exactly one of: verified, disputed, unverifiable, opinion
- confidenceScore is 0-100 reflecting how certain the verdict is (not whether claim is true)
- All evidence arrays may be empty []
- searchSuggestions must be exactly 3 specific queries`;

    try {
      const parsed = await callGemini(prompt, 1000);
      if (parsed.verdict)   parsed.verdict   = String(parsed.verdict).toLowerCase().trim();
      if (parsed.claimType) parsed.claimType = String(parsed.claimType).toLowerCase().trim();
      parsed.confidenceScore = typeof parsed.confidenceScore === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidenceScore)))
        : 50;
      setResult(parsed);
      saveResult("claim-lens", parsed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(""); setClaim(""); setCtx(""); };

  // Derived
  const vKey  = VERDICT_META[result?.verdict] ? result.verdict : "unknown";
  const vm    = VERDICT_META[vKey];
  const tKey  = VALID_TYPES.includes(result?.claimType) ? result.claimType : "fallback";
  const conf  = result?.confidenceScore ?? 50;
  const confColor = conf >= 70 ? "var(--teal)" : conf >= 40 ? "var(--gold)" : "var(--coral)";

  const evS = Array.isArray(result?.evidence?.supports) ? result.evidence.supports : [];
  const evR = Array.isArray(result?.evidence?.refutes)  ? result.evidence.refutes  : [];
  const evM = Array.isArray(result?.evidence?.missing)  ? result.evidence.missing  : [];
  const hasEv = evS.length + evR.length + evM.length > 0;
  const searches = Array.isArray(result?.searchSuggestions) ? result.searchSuggestions : [];

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="content">

          {/* ── HEADER ── */}
          <header className="header">
            <div className="logo-area">
              <div className="logo-badge"><div className="logo-badge-inner" /></div>
              <div className="logo-text">
                <div className="logo-name">Claim<span>Lens</span></div>
                <div className="logo-sub">Janardhan Labs · Claim Intelligence</div>
              </div>
            </div>
            <div className="header-right">
              <div className="status-dot" />
              <span className="status-label">System ready</span>
            </div>
          </header>

          <main className="main">

            {/* ── INPUT ── */}
            {!result && !loading && (
              <>
                <div className="section-tag">New analysis</div>

                <div className="input-panel">
                  <div className="panel-bar">
                    <div className="panel-dot r" /><div className="panel-dot y" /><div className="panel-dot g" />
                    <span className="panel-bar-title">claim_input.txt</span>
                  </div>
                  <div className="panel-body">
                    <div className="field-row">
                      <label className="field-label" htmlFor="claim-ta">Claim to analyse</label>
                      <textarea
                        id="claim-ta"
                        className="claim-textarea"
                        placeholder="Paste any claim, headline, statistic, or statement you want to investigate…"
                        value={claim}
                        onChange={e => setClaim(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                      />
                      <div className={`char-hint ${charHintCls}`}>{charHint}</div>
                    </div>

                    <div className="field-row">
                      <label className="field-label" htmlFor="ctx-in">
                        Context <span className="optional">(optional)</span>
                      </label>
                      <input
                        id="ctx-in"
                        className="context-input"
                        type="text"
                        placeholder="Source, publication, date, or where you saw this…"
                        value={ctx}
                        onChange={e => setCtx(e.target.value)}
                      />
                    </div>

                    <div className="controls-row">
                      <div className="mode-group">
                        <label className="field-label">Analysis mode</label>
                        <div className="chips-row">
                          {MODES.map(m => (
                            <button key={m} className={`chip ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>{m}</button>
                          ))}
                        </div>
                      </div>
                      <button className="run-btn" onClick={run} disabled={!canRun}>
                        <span className="run-btn-icon">⟳</span>
                        Run analysis
                      </button>
                    </div>

                    {error && (
                      <div className="error-strip" role="alert">
                        <span>{error}</span>
                        <button className="error-close" onClick={() => setError("")}>Close</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── LOADING ── */}
            {loading && (
              <div className="loading-panel" aria-live="polite">
                <div className="scan-ring" aria-hidden="true" />
                <div className="loading-label">Analysing claim</div>
                <div className="loading-sub">weighing evidence · cross-referencing · forming verdict</div>
              </div>
            )}

            {/* ── RESULTS ── */}
            {result && !loading && (
              <>
                <div className="section-tag">Analysis result</div>

                {/* Claim echo */}
                <div className="claim-echo">
                  <span className="claim-echo-text">{claim.trim()}</span>
                  <button className="reset-btn" onClick={reset}>← New claim</button>
                </div>

                {/* Verdict */}
                <div className={`verdict-block ${vm.cls}`} role="status">
                  <div className="verdict-icon-wrap">{vm.icon}</div>
                  <div className="verdict-content">
                    <div className="verdict-tag">{vm.tag}</div>
                    <div className="verdict-text">{result.verdictSummary}</div>
                  </div>
                </div>

                {/* Confidence */}
                <div className="conf-strip">
                  <span className="conf-label">Confidence</span>
                  <div className="conf-bar-track">
                    <ConfBar score={conf} color={confColor} />
                  </div>
                  <span className="conf-num" style={{ color: confColor }}>{conf}/100</span>
                </div>

                {/* Data cards */}
                <div className="data-grid">

                  {/* Claim type */}
                  <div className="data-card">
                    <div className="card-header">Claim type</div>
                    <div className={`type-pill ${tKey}`}>
                      <span className="type-dot" />
                      {result.claimType || "Unknown"}
                    </div>
                    <p className="type-expl">{result.claimTypeExplanation || "—"}</p>
                  </div>

                  {/* Evidence map */}
                  <div className="data-card">
                    <div className="card-header">Evidence map</div>
                    {hasEv && (
                      <div className="ev-legend-row">
                        {evS.length > 0 && <span className="ev-legend-item"><span className="ev-pip s" />Supports</span>}
                        {evR.length > 0 && <span className="ev-legend-item"><span className="ev-pip r" />Refutes</span>}
                        {evM.length > 0 && <span className="ev-legend-item"><span className="ev-pip m" />Missing</span>}
                      </div>
                    )}
                    <div className="ev-list">
                      {evS.map((e, i) => (
                        <div key={`s${i}`} className="ev-item"><span className="ev-pip s" /><span>{e}</span></div>
                      ))}
                      {evR.map((e, i) => (
                        <div key={`r${i}`} className="ev-item"><span className="ev-pip r" /><span>{e}</span></div>
                      ))}
                      {evM.map((e, i) => (
                        <div key={`m${i}`} className="ev-item missing-item"><span className="ev-pip m" /><span>{e}</span></div>
                      ))}
                      {!hasEv && (
                        <div className="ev-item missing-item"><span className="ev-pip m" /><span>No specific evidence mapped</span></div>
                      )}
                    </div>
                  </div>

                  {/* Search suggestions */}
                  {searches.length > 0 && (
                    <div className="data-card span2">
                      <div className="card-header">Search queries to verify yourself</div>
                      <div className="search-rows">
                        {searches.map((s, i) => (
                          <div key={i} className="search-row">
                            <span className="search-idx">0{i + 1}</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="footer-actions">
                  <button className="ghost-btn" onClick={() => { setResult(null); setError(""); }}>Refine this claim</button>
                  <button className="ghost-btn primary" onClick={reset}>New analysis →</button>
                </div>
              </>
            )}

          </main>
        </div>
      </div>
          {/* ══ FOOTER ══ */}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
    </>
  );
}

export default function ClaimLens() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("claim-lens");
  if (isKeySet) setAppContext("claim-lens");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <ClaimLensApp />
    </>
  );
}
