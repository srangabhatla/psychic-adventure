import { callGemini, setAppContext } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState } from "react";

// ── API helper — anthropic-version + 55s timeout ──

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400&family=Recursive:slnt,wght@0,300;0,400;0,500;-15,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --linen:        #F4F1EC;
    --linen-dark:   #EDE9E1;
    --linen-deep:   #E4DFD5;
    --forest:       #3D6B4F;
    --forest-mid:   #2E5040;
    --forest-light: #6A9E7A;
    --forest-pale:  #EBF2ED;
    --forest-glow:  rgba(61,107,79,0.10);
    --brown:        #7A4F2E;
    --brown-pale:   #F5EDE5;
    --sienna:       #B86A28;
    --rule:         #D8D2C8;
    --rule-light:   #EAE5DC;
    --ink:          #2A2420;
    --ink-mid:      #6A5E54;
    --ink-dim:      #A89E94;
    --paper:        #FDFBF8;
    --font-serif:   'Fraunces', Georgia, serif;
    --font-mono:    'Recursive', monospace;
  }

  body { background: var(--linen); color: var(--ink); font-family: var(--font-serif); }

  /* FIX: min-height on html+body so footer always stays at bottom even on short content */
  html, body, #root { height: 100%; }
  .app { min-height: 100%; background: var(--linen); display: flex; flex-direction: column; }

  /* warm ambient light — top-left spill */
  .app::after {
    content: ''; position: fixed; top: -100px; left: -100px;
    width: 420px; height: 420px; border-radius: 50%;
    background: radial-gradient(circle, rgba(184,106,40,0.05) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }

  .page { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }

  /* ══════════════════════════════════════
     CONSISTENT HEADER SHELL
  ══════════════════════════════════════ */
  .site-header {
    background: var(--paper);
    border-bottom: 2px solid var(--forest);
    padding: 1rem 1.75rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }
  .header-brand { display: flex; flex-direction: column; gap: 0.1rem; }
  .header-eyebrow {
    font-family: var(--font-mono); font-size: 0.5rem; font-weight: 500;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--forest);
  }
  .header-appname {
    font-family: var(--font-serif); font-size: 1.5rem; font-weight: 600;
    color: var(--ink); letter-spacing: -0.02em; line-height: 1;
  }
  .header-appname em { font-style: italic; color: var(--forest); }
  .header-tagline {
    font-family: var(--font-serif); font-size: 0.75rem; font-style: italic;
    color: var(--ink-dim); margin-top: 0.15rem;
  }
  @media(max-width:480px){ .header-tagline { display: none; } }

  /* ══════════════════════════════════════
     CONSISTENT FOOTER SHELL
  ══════════════════════════════════════ */
  .site-footer {
    border-top: 1px solid var(--rule);
    padding: 1rem 1.75rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; flex-wrap: wrap;
    background: var(--paper);
    /* FIX: removed margin-top:auto — footer sticks to bottom via flex on .page */
  }
  .footer-left {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em; color: var(--ink-dim);
  }
  .footer-left strong { color: var(--forest); font-weight: 500; }
  .footer-right {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em;
    color: var(--ink-dim); text-align: right;
  }

  /* ── Main ── */
  /* FIX: flex:1 on main so it expands and pushes footer to bottom */
  .main { max-width: 820px; margin: 0 auto; padding: 2rem 1.5rem 2.5rem; width: 100%; flex: 1; }

  .section-label {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 500;
    letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim);
    display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

  /* ── Input card ── */
  .input-card {
    background: var(--paper); border: 1px solid var(--rule); border-radius: 3px;
    box-shadow: 0 2px 16px rgba(42,36,32,0.06); overflow: hidden;
  }
  .input-card-top {
    padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--rule-light); background: var(--linen);
  }
  .input-card-title { font-size: 1.1rem; font-weight: 400; font-style: italic; color: var(--ink); }
  .input-card-sub {
    font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--forest); margin-top: 0.3rem;
  }
  .input-card-body { padding: 1.75rem; }

  .field-block { margin-bottom: 1.25rem; }
  .field-label {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 500;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--forest);
    margin-bottom: 0.45rem; display: block;
  }
  .field-label .opt { color: var(--ink-dim); font-weight: 300; letter-spacing: 0.06em; margin-left: 0.35rem; }

  .paper-textarea {
    width: 100%; min-height: 150px; resize: vertical;
    background: var(--linen); border: 1px solid var(--rule); border-radius: 2px;
    padding: 1rem 1.1rem; font-family: var(--font-serif); font-size: 0.92rem;
    color: var(--ink); line-height: 1.7; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .paper-textarea:focus { border-color: var(--forest); box-shadow: 0 0 0 3px var(--forest-glow); }
  .paper-textarea::placeholder { color: var(--ink-dim); font-style: italic; }

  .field-hint {
    font-family: var(--font-mono); font-size: 0.5rem; color: var(--ink-dim);
    text-align: right; margin-top: 0.3rem; letter-spacing: 0.06em; transition: color 0.2s;
  }
  .field-hint.warn { color: var(--sienna); }
  .field-hint.ok   { color: var(--forest-light); }

  .field-select {
    width: 100%; padding: 0.6rem 0.9rem; background: var(--linen);
    border: 1px solid var(--rule); border-radius: 2px;
    font-family: var(--font-serif); font-size: 0.9rem; color: var(--ink);
    outline: none; cursor: pointer; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236A5E54' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.9rem center; padding-right: 2.5rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .field-select:focus { border-color: var(--forest); box-shadow: 0 0 0 3px var(--forest-glow); }

  /* lens grid */
  .lenses-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.5rem; }
  @media(max-width:520px){ .lenses-grid { grid-template-columns: repeat(2,1fr); } }

  .lens-toggle {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.7rem; border: 1px solid var(--rule); border-radius: 2px;
    background: var(--linen); cursor: pointer; transition: all 0.15s; user-select: none;
  }
  .lens-toggle:hover { border-color: var(--forest); background: var(--forest-pale); }
  .lens-toggle.on    { border-color: var(--forest); background: var(--forest-pale); }
  .lens-check {
    width: 14px; height: 14px; border-radius: 2px; border: 1.5px solid var(--rule);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; background: white; transition: all 0.15s;
  }
  .lens-toggle.on .lens-check { background: var(--forest); border-color: var(--forest); }
  .lens-check-icon { color: white; font-size: 0.6rem; line-height: 1; }
  .lens-label { font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.04em; color: var(--ink-mid); }
  .lens-toggle.on .lens-label { color: var(--forest-mid); font-weight: 500; }
  /* FIX: at-least-one guard — last active toggle visually indicates it can't be deselected */
  .lens-toggle.on.sole { border-style: dashed; opacity: 0.7; cursor: default; }

  /* controls */
  .controls-row {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap; margin-top: 1.25rem;
  }
  .level-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .chips-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .chip {
    padding: 0.3rem 0.8rem; border: 1px solid var(--rule); border-radius: 2px;
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.06em;
    cursor: pointer; color: var(--ink-mid); background: var(--linen);
    transition: all 0.15s; user-select: none;
  }
  .chip:hover { border-color: var(--forest); color: var(--forest); }
  .chip.on { background: var(--forest); border-color: var(--forest); color: white; }

  .decode-btn {
    padding: 0.75rem 2rem; background: var(--forest); color: white;
    border: none; border-radius: 2px; font-family: var(--font-serif);
    font-size: 1rem; font-style: italic; cursor: pointer;
    transition: all 0.2s; white-space: nowrap;
  }
  .decode-btn:hover:not(:disabled) { background: var(--forest-mid); transform: translateY(-1px); box-shadow: 0 4px 14px var(--forest-glow); }
  .decode-btn:active:not(:disabled) { transform: translateY(0); }
  .decode-btn:disabled { background: var(--rule); color: var(--ink-dim); cursor: not-allowed; transform: none; box-shadow: none; }
  @media(max-width:500px){ .decode-btn { width: 100%; text-align: center; } }

  /* loading */
  .loading-state { text-align: center; padding: 4rem 1rem; }
  .loading-book { font-size: 2.5rem; display: block; margin: 0 auto 1.25rem; animation: sway 1.8s ease-in-out infinite; }
  @keyframes sway { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
  .loading-text { font-size: 1.1rem; font-style: italic; color: var(--ink-mid); }
  .loading-sub { font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); margin-top: 0.5rem; }

  /* results */
  .results-bar {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;
  }
  .results-title { font-size: 1.2rem; font-weight: 400; font-style: italic; color: var(--ink); }
  .results-meta { font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-top: 0.2rem; }

  .ghost-btn {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-dim); background: none;
    border: 1px solid var(--rule); border-radius: 2px;
    padding: 0.35rem 0.75rem; cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .ghost-btn:hover { border-color: var(--forest); color: var(--forest); }

  /* lens cards */
  .lenses-output { display: flex; flex-direction: column; gap: 0.85rem; }

  .lens-card {
    background: var(--paper); border: 1px solid var(--rule); border-radius: 3px;
    overflow: hidden; box-shadow: 0 1px 6px rgba(42,36,32,0.04);
    animation: riseIn 0.4s ease both;
  }
  .lens-card:nth-child(1){animation-delay:0.04s} .lens-card:nth-child(2){animation-delay:0.09s}
  .lens-card:nth-child(3){animation-delay:0.14s} .lens-card:nth-child(4){animation-delay:0.19s}
  .lens-card:nth-child(5){animation-delay:0.24s} .lens-card:nth-child(6){animation-delay:0.29s}
  @keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

  .lens-card-head {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 0.85rem 1.25rem; background: var(--linen);
    cursor: pointer; user-select: none; transition: background 0.15s;
  }
  .lens-card-head:hover { background: var(--linen-dark); }
  /* FIX: border-bottom only when card is CLOSED — avoids double-rule when open */
  .lens-card:not(.open) .lens-card-head { border-bottom: 1px solid var(--rule-light); }

  .lens-num {
    font-family: var(--font-mono); font-size: 0.52rem; font-weight: 500;
    color: var(--forest); background: var(--forest-pale);
    border: 1px solid rgba(61,107,79,0.2); border-radius: 2px;
    padding: 0.12rem 0.4rem; flex-shrink: 0;
  }
  .lens-card-title {
    font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); flex: 1;
  }
  .lens-chevron { color: var(--ink-dim); font-size: 0.65rem; transition: transform 0.2s; flex-shrink: 0; }
  .lens-card.open .lens-chevron { transform: rotate(180deg); }

  .lens-card-body {
    padding: 1.25rem 1.5rem; font-size: 0.93rem; line-height: 1.8; color: var(--ink-mid);
    border-top: 1px solid var(--rule-light);
  }
  .lens-card-body p + p { margin-top: 0.65rem; }
  /* FIX: use height/overflow instead of display:none so chevron transition doesn't get cut */
  .lens-card-body.hidden { display: none; }

  /* footer actions */
  /* FIX: mobile — both buttons full width, stacked */
  .footer-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
  .footer-actions .ghost-btn { flex: 1; min-width: 140px; text-align: center; padding: 0.65rem 1rem; }
  .footer-actions .decode-btn { flex: 1; min-width: 140px; text-align: center; }
  @media(max-width:500px){
    .footer-actions { flex-direction: column; }
    .footer-actions .ghost-btn,
    .footer-actions .decode-btn { width: 100%; }
  }

  /* error */
  .error-box {
    background: var(--brown-pale); border: 1px solid rgba(122,79,46,0.25); border-radius: 2px;
    padding: 1rem 1.25rem; color: var(--brown); font-size: 0.88rem; line-height: 1.6;
    margin-top: 1rem; display: flex; align-items: flex-start;
    justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  }
  .error-dismiss {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase;
    background: none; border: 1px solid rgba(122,79,46,0.35); border-radius: 2px;
    color: var(--brown); padding: 0.25rem 0.6rem; cursor: pointer; white-space: nowrap;
    flex-shrink: 0; transition: border-color 0.15s;
  }
  .error-dismiss:hover { border-color: var(--brown); }
`;

const LENS_DEFS = [
  { id: "studied",     label: "What they studied",   icon: "🔬" },
  { id: "method",      label: "How they studied it", icon: "⚙️"  },
  { id: "found",       label: "What they found",     icon: "💡" },
  { id: "matters",     label: "Why it matters",      icon: "🌍" },
  { id: "limitations", label: "Limitations",         icon: "⚠️"  },
  { id: "next",        label: "What to read next",   icon: "📚" },
];

const FIELDS = [
  "General","Biology","Medicine","Psychology","Computer Science",
  "Physics","Chemistry","Economics","Sociology","Neuroscience",
  "Environmental Science","Mathematics",
];

const LEVELS = ["ELI5", "Undergrad", "Expert"];

function ApertureApp() {
  const [text, setText]   = useState("");
  const [field, setField] = useState("General");
  const [level, setLevel] = useState("Undergrad");
  // FIX: store activeLenses as array in state (Set is not re-render safe on mutation)
  const [activeLenses, setActiveLenses] = useState(LENS_DEFS.map(l => l.id));
  const [openCards, setOpenCards]       = useState(new Set());
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState("");

  // FIX: min 1 lens enforced — last remaining lens cannot be deselected
  const toggleLens = (id) => {
    setActiveLenses(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // block deselecting last
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const toggleCard = (id) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // FIX: wordCount guard — only computed when text is non-empty
  const trimmed   = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = text.length;
  const canDecode = charCount >= 80 && !loading;

  const charHintText = charCount === 0 ? ""
    : charCount < 80 ? `${80 - charCount} more characters needed`
    : `${wordCount} words`;
  const charHintCls = charCount > 0 && charCount < 80 ? "warn" : charCount >= 80 ? "ok" : "";

  const decode = async () => {
    if (!canDecode) return;
    setLoading(true); setError(""); setResult(null);

    // FIX: snapshot activeLenses at call time — not captured from closure
    const requestedIds = [...activeLenses];
    const requested    = LENS_DEFS.filter(l => requestedIds.includes(l.id));

    const levelNote = level === "ELI5"
      ? "Explain as if to a curious 12-year-old. Zero jargon whatsoever."
      : level === "Expert"
      ? "Write for a domain expert. Technical terminology is fine."
      : "Write for an intelligent undergraduate with no prior knowledge of this specific topic.";

    const lensKeys = requested.map(l => `"${l.id}"`).join(", ");

    const prompt = `You are an expert academic explainer. Analyse the following research paper at a ${level} reading level.
${levelNote}
${field !== "General" ? `Field of study: ${field}` : ""}

Paper:
---
${trimmed}
---

Return ONLY valid JSON with exactly these keys: ${lensKeys}
No markdown fences, no extra keys, no explanation outside the JSON.

Write 2-4 clear sentences per key at the specified reading level:
- "studied": what research question or problem did they investigate?
- "method": how did they design the study / collect data?
- "found": what were the key results or discoveries?
- "matters": why does this finding matter to the world or to practitioners?
- "limitations": what are weaknesses, caveats, or things to be cautious about?
- "next": what specific papers, authors, or topics should the reader explore next?`;

    try {
      const parsed = await callGemini(prompt, 2500);

      // FIX: normalise all requested lens values to strings; fallback for missing keys
      const safe = {};
      requested.forEach(l => {
        const val = parsed[l.id];
        safe[l.id] = typeof val === "string" && val.trim()
          ? val.trim()
          : "Not available for this paper.";
      });

      // FIX: store snapshot of settings in result so re-render with different settings doesn't corrupt display
      setResult({
        lenses: safe,
        level,
        field,
        count: requested.length,
        lensIds: requestedIds,
      });
      saveResult("aperture", { lenses: safe, level, field });
      setOpenCards(new Set(requested.map(l => l.id)));
    } catch (e) {
      if (!e.message.startsWith("__COOLDOWN__")) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // FIX: "Adjust lenses" only resets result — keeps text, field, level, activeLenses intact
  const adjustReset = () => { setResult(null); setError(""); };
  // FIX: "Decode another" clears everything
  const fullReset   = () => { setResult(null); setError(""); setText(""); setField("General"); setLevel("Undergrad"); setActiveLenses(LENS_DEFS.map(l => l.id)); };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="page">

          {/* ══ HEADER — consistent shell ══ */}
          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname"><em>Aperture</em></h1>
              <p className="header-tagline">Open any research paper in six lenses</p>
            </div>
          </header>

          <main className="main">

            {/* INPUT */}
            {!result && !loading && (
              <>
                <div className="section-label">Paste your paper</div>
                <div className="input-card">
                  <div className="input-card-top">
                    <div className="input-card-title">Which paper do you want to open?</div>
                    <div className="input-card-sub">abstract · introduction · full paper · any section</div>
                  </div>
                  <div className="input-card-body">

                    <div className="field-block">
                      <label className="field-label" htmlFor="paper-ta">Paper text</label>
                      <textarea
                        id="paper-ta"
                        className="paper-textarea"
                        placeholder="Paste the abstract, introduction, or any section of the paper here…"
                        value={text}
                        onChange={e => setText(e.target.value)}
                      />
                      {charCount > 0 && (
                        <div className={`field-hint ${charHintCls}`}>{charHintText}</div>
                      )}
                    </div>

                    <div className="field-block">
                      <label className="field-label" htmlFor="field-sel">
                        Field of study <span className="opt">(helps calibration)</span>
                      </label>
                      <select
                        id="field-sel"
                        className="field-select"
                        value={field}
                        onChange={e => setField(e.target.value)}
                      >
                        {FIELDS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>

                    <div className="field-block">
                      <label className="field-label">
                        Which lenses to generate
                        <span className="opt">(minimum one)</span>
                      </label>
                      <div className="lenses-grid">
                        {LENS_DEFS.map(l => {
                          const isOn   = activeLenses.includes(l.id);
                          const isSole = isOn && activeLenses.length === 1;
                          return (
                            <div
                              key={l.id}
                              className={`lens-toggle ${isOn ? "on" : ""} ${isSole ? "sole" : ""}`}
                              onClick={() => toggleLens(l.id)}
                              role="checkbox"
                              aria-checked={isOn}
                              title={isSole ? "At least one lens must be selected" : ""}
                            >
                              <div className="lens-check">
                                {isOn && <span className="lens-check-icon">✓</span>}
                              </div>
                              <span className="lens-label">{l.icon} {l.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="controls-row">
                      <div className="level-group">
                        <label className="field-label">Reading level</label>
                        <div className="chips-row">
                          {LEVELS.map(lvl => (
                            <button
                              key={lvl}
                              className={`chip ${level === lvl ? "on" : ""}`}
                              onClick={() => setLevel(lvl)}
                            >{lvl}</button>
                          ))}
                        </div>
                      </div>
                      <button className="decode-btn" onClick={decode} disabled={!canDecode}>
                        Open paper →
                      </button>
                    </div>

                    {error && (
                      <div className="error-box" role="alert">
                        <span>{error}</span>
                        <button className="error-dismiss" onClick={() => setError("")}>Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* LOADING */}
            {loading && (
              <div className="loading-state" aria-live="polite">
                <span className="loading-book" aria-hidden="true">📖</span>
                <p className="loading-text">Opening the paper…</p>
                <p className="loading-sub">
                  {activeLenses.length} lens{activeLenses.length !== 1 ? "es" : ""} · {level} level
                </p>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <>
                <div className="results-bar">
                  <div>
                    <div className="results-title">Paper opened</div>
                    <div className="results-meta">
                      {result.count} lens{result.count !== 1 ? "es" : ""} · {result.level} level
                      {result.field !== "General" ? ` · ${result.field}` : ""}
                    </div>
                  </div>
                  <button className="ghost-btn" onClick={fullReset}>← Open another</button>
                </div>

                <div className="lenses-output">
                  {LENS_DEFS
                    // FIX: filter using result.lensIds snapshot, not live activeLenses
                    .filter(l => result.lensIds.includes(l.id) && result.lenses[l.id])
                    .map((l, i) => (
                      <div key={l.id} className={`lens-card ${openCards.has(l.id) ? "open" : ""}`}>
                        <div className="lens-card-head" onClick={() => toggleCard(l.id)}>
                          <span className="lens-num">{String(i + 1).padStart(2, "0")}</span>
                          <span className="lens-card-title">{l.icon}  {l.label}</span>
                          <span className="lens-chevron">▾</span>
                        </div>
                        <div className={`lens-card-body ${openCards.has(l.id) ? "" : "hidden"}`}>
                          {result.lenses[l.id].split(/\n+/).map((para, pi) =>
                            para.trim() ? <p key={pi}>{para.trim()}</p> : null
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>

                <div className="footer-actions">
                  <button className="ghost-btn" onClick={adjustReset}>Adjust lenses / level</button>
                  <button className="decode-btn" onClick={fullReset}>Open another paper →</button>
                </div>
              </>
            )}

          </main>

          {/* ══ FOOTER — consistent shell ══ */}
          <footer className="site-footer">
            <div className="footer-left">
              Made with intent by <strong>Sriharsha</strong>
            </div>
            <div className="footer-right">
              Janardhan Labs © 2026
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}

export default function Aperture() {
  const { isKeySet, KeyGate, Banner } = useApiKey("aperture");
  setAppContext("aperture");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <ApertureApp />
    </>
  );
}
