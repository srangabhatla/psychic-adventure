import { useApiKey } from "../../shared/components/KeyGate";
import { callGemini } from "../../shared/lib/gemini-client";
import { useState } from "react";


// FIX #11: Cabinet Grotesk is Fontshare-only (not Google Fonts) — replaced with
// Plus Jakarta Sans (geometric, bold, available on Google Fonts) which is visually very close
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Overpass+Mono:wght@300;400;500&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; }

  :root {
    --bg:#13131F; --surface:#1C1C2E; --surface2:#242438; --surface3:#2E2E48;
    --violet:#9B5DE5; --violet-dim:#5E3A8A; --violet-pale:#1E1530;
    --violet-glow:rgba(155,93,229,0.15);
    --gold:#F7B731; --gold-dim:#8A6510;
    --mint:#06D6A0; --mint-dim:#04836A; --mint-pale:#021A14;
    --rule:#2A2A40; --rule2:#363650;
    --ink:#E8E6F0; --ink-mid:#8A88A0; --ink-dim:#4A4860;
    --font-head:'Plus Jakarta Sans',sans-serif;
    --font-mono:'Overpass Mono',monospace;
  }

  html, body { height:100%; }
  body { background:var(--bg); color:var(--ink); font-family:var(--font-head); }
  .app { min-height:100%; background:var(--bg); display:flex; flex-direction:column; }
  .app::before {
    content:''; position:fixed; bottom:-150px; right:-150px;
    width:500px; height:500px; border-radius:50%;
    background:radial-gradient(circle,rgba(155,93,229,0.07) 0%,transparent 65%);
    pointer-events:none; z-index:0;
  }
  .page { position:relative; z-index:1; flex:1; display:flex; flex-direction:column; }

  /* FIX #13: keyframes defined first */
  @keyframes spin    { to { transform:rotate(360deg); } }
  @keyframes riseIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  /* ── HEADER ── */
  .site-header { background:var(--surface); border-bottom:1px solid var(--rule2); padding:1rem 1.75rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .header-brand { display:flex; flex-direction:column; gap:0.1rem; }
  .header-eyebrow { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--violet); }
  .header-appname { font-family:var(--font-head); font-size:1.5rem; font-weight:800; color:var(--ink); letter-spacing:-0.03em; line-height:1; }
  .header-appname span { color:var(--violet); }
  .header-tagline { font-family:var(--font-mono); font-size:0.52rem; color:var(--ink-dim); margin-top:0.15rem; letter-spacing:0.04em; }
  @media(max-width:480px) { .header-tagline { display:none; } }

  /* ── FOOTER ── */
  .site-footer { border-top:1px solid var(--rule); padding:1rem 1.75rem; display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap; background:var(--surface); }
  .footer-left  { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.08em; color:var(--ink-dim); }
  .footer-left strong { color:var(--violet); font-weight:500; }
  .footer-right { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.08em; color:var(--ink-dim); text-align:right; }

  /* ── MAIN ── */
  .main { max-width:960px; margin:0 auto; padding:2rem 1.5rem 2.5rem; width:100%; flex:1; }

  /* FIX #12: section-tag — gap between // and text was inconsistent.
     Put // as a separate span inside JSX so spacing is clean and explicit. */
  .section-tag { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--ink-dim); display:flex; align-items:center; gap:0.5rem; margin-bottom:1.25rem; }
  .section-tag-slash { color:var(--violet); font-weight:500; margin-right:0.15rem; letter-spacing:0; }
  .section-tag::after { content:''; flex:1; height:1px; background:var(--rule2); margin-left:0.25rem; }

  /* ── STEP BAR ── */
  .steps { display:flex; align-items:stretch; margin-bottom:2rem; background:var(--surface); border:1px solid var(--rule2); border-radius:4px; overflow:hidden; }
  .step { flex:1; padding:0.75rem 1rem; display:flex; align-items:center; gap:0.6rem; border-right:1px solid var(--rule2); transition:background 0.2s; }
  .step:last-child { border-right:none; }
  /* FIX #14: explicit pending state — dims future steps visually */
  .step.pending  { opacity:0.4; }
  .step.active   { background:var(--violet-pale); }
  .step.done     { background:var(--surface2); }
  .step-num { width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:0.55rem; font-weight:500; border:1.5px solid var(--rule2); color:var(--ink-dim); background:var(--surface2); }
  .step.active .step-num { border-color:var(--violet); color:var(--violet); background:var(--violet-pale); }
  .step.done   .step-num { border-color:var(--mint-dim); color:var(--mint); background:var(--mint-pale); }
  .step-label { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-dim); }
  .step.active .step-label { color:var(--violet); }
  .step.done   .step-label { color:var(--mint-dim); }
  @media(max-width:480px) { .step-label { display:none; } }

  /* ── PANELS ── */
  .panel { background:var(--surface); border:1px solid var(--rule2); border-radius:6px; overflow:hidden; margin-bottom:1.25rem; box-shadow:0 2px 24px rgba(0,0,0,0.2); }
  .panel-head { padding:0.9rem 1.5rem; background:var(--surface2); border-bottom:1px solid var(--rule2); display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .panel-title { font-size:0.9rem; font-weight:700; color:var(--ink); letter-spacing:-0.01em; }
  .panel-badge { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.12em; text-transform:uppercase; padding:0.2rem 0.6rem; border-radius:100px; background:var(--violet-pale); color:var(--violet); border:1px solid var(--violet-dim); }
  .panel-body { padding:1.5rem; }

  .field-row { margin-bottom:1.25rem; }
  .field-label { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--violet); margin-bottom:0.5rem; display:block; }
  .field-label .opt { color:var(--ink-dim); font-weight:300; letter-spacing:0.06em; margin-left:0.35rem; text-transform:none; }

  .mirror-ta { width:100%; resize:vertical; background:var(--surface2); border:1px solid var(--rule2); border-radius:4px; padding:0.9rem 1rem; font-family:var(--font-head); font-size:0.95rem; color:var(--ink); line-height:1.7; outline:none; transition:border-color 0.2s, box-shadow 0.2s; }
  .mirror-ta:focus { border-color:var(--violet-dim); box-shadow:0 0 0 3px var(--violet-glow); }
  .mirror-ta::placeholder { color:var(--ink-dim); }
  .mirror-ta.tall  { min-height:160px; }
  .mirror-ta.short { min-height:120px; }

  .field-hint { font-family:var(--font-mono); font-size:0.5rem; color:var(--ink-dim); text-align:right; margin-top:0.3rem; letter-spacing:0.05em; transition:color 0.2s; }
  .field-hint.warn { color:var(--gold); }
  .field-hint.ok   { color:var(--mint-dim); }

  .trait-chips { display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.3rem; }
  .trait-chip { padding:0.28rem 0.75rem; border:1px solid var(--rule2); border-radius:100px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.05em; cursor:pointer; color:var(--ink-mid); background:var(--surface2); transition:all 0.15s; user-select:none; }
  .trait-chip:hover { border-color:var(--violet-dim); color:var(--violet); }
  .trait-chip.on    { background:var(--violet-pale); border-color:var(--violet); color:var(--violet); }

  .chips-row { display:flex; gap:0.4rem; flex-wrap:wrap; }
  .chip { padding:0.3rem 0.8rem; border:1px solid var(--rule2); border-radius:3px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.06em; cursor:pointer; color:var(--ink-mid); background:var(--surface2); transition:all 0.15s; user-select:none; }
  .chip:hover { border-color:var(--violet-dim); color:var(--violet); }
  .chip.on    { background:var(--violet); border-color:var(--violet); color:white; }

  .controls-row { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-top:1.25rem; }
  .controls-left { display:flex; flex-direction:column; gap:0.4rem; }

  .primary-btn { padding:0.75rem 2rem; background:var(--violet); color:white; border:none; border-radius:4px; font-family:var(--font-head); font-size:0.95rem; font-weight:700; cursor:pointer; transition:all 0.2s; white-space:nowrap; letter-spacing:-0.01em; }
  .primary-btn:hover:not(:disabled)  { background:#B06AF5; transform:translateY(-1px); box-shadow:0 4px 20px var(--violet-glow); }
  .primary-btn:active:not(:disabled) { transform:translateY(0); }
  .primary-btn:disabled { background:var(--surface3); color:var(--ink-dim); cursor:not-allowed; transform:none; box-shadow:none; }
  @media(max-width:500px) { .primary-btn { width:100%; text-align:center; } }

  .ghost-btn { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-mid); background:none; border:1px solid var(--rule2); border-radius:3px; padding:0.4rem 0.85rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .ghost-btn:hover { border-color:var(--violet-dim); color:var(--violet); }

  /* ── LOADING ── */
  .loading-panel { background:var(--surface); border:1px solid var(--rule2); border-radius:6px; padding:3.5rem 2rem; text-align:center; box-shadow:0 2px 24px rgba(0,0,0,0.2); }
  .loading-ring  { width:48px; height:48px; border-radius:50%; border:2px solid var(--rule2); border-top-color:var(--violet); border-right-color:var(--violet-dim); animation:spin 0.9s linear infinite; margin:0 auto 1.25rem; }
  .loading-label { font-size:1rem; font-weight:700; color:var(--ink); margin-bottom:0.3rem; min-height:1.5rem; }
  .loading-sub   { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-dim); }

  /* ── VOICE CARD ── */
  .voice-card { background:var(--surface); border:1px solid var(--rule2); border-radius:6px; overflow:hidden; margin-bottom:1.25rem; box-shadow:0 2px 24px rgba(0,0,0,0.2); animation:riseIn 0.4s ease; }
  .voice-card-head { padding:1rem 1.5rem; background:var(--violet-pale); border-bottom:1px solid var(--violet-dim); display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .voice-card-title { font-size:1rem; font-weight:700; color:var(--ink); }
  .voice-card-body { padding:1.5rem; }
  .traits-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:0.85rem; margin-bottom:1.25rem; }
  @media(max-width:500px) { .traits-grid { grid-template-columns:1fr; } }
  .trait-card { background:var(--surface2); border:1px solid var(--rule2); border-radius:4px; padding:0.85rem 1rem; animation:riseIn 0.4s ease both; }
  .trait-card:nth-child(1){animation-delay:0.05s} .trait-card:nth-child(2){animation-delay:0.1s}
  .trait-card:nth-child(3){animation-delay:0.15s} .trait-card:nth-child(4){animation-delay:0.2s}
  .trait-card:nth-child(5){animation-delay:0.25s} .trait-card:nth-child(6){animation-delay:0.3s}
  .trait-name  { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--violet); margin-bottom:0.3rem; }
  .trait-value { font-size:0.88rem; line-height:1.55; color:var(--ink-mid); }
  .voice-summary { font-size:0.9rem; line-height:1.65; color:var(--ink-mid); padding:1rem 1.25rem; background:var(--surface2); border-radius:4px; border-left:3px solid var(--violet); }

  /* ── SPLIT VIEW ── */
  .split-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem; }
  @media(max-width:640px) { .split-grid { grid-template-columns:1fr; } }
  .split-panel { background:var(--surface); border:1px solid var(--rule2); border-radius:6px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.15); animation:riseIn 0.4s ease both; }
  .split-panel:nth-child(2) { animation-delay:0.1s; }
  .split-head  { padding:0.75rem 1.25rem; background:var(--surface2); border-bottom:1px solid var(--rule2); display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
  .split-head-left { display:flex; align-items:center; gap:0.6rem; }
  .split-dot   { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .split-dot.before { background:var(--gold-dim); }
  .split-dot.after  { background:var(--violet); }
  .split-title { font-family:var(--font-mono); font-size:0.55rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-mid); }
  .split-body  { padding:1.25rem; font-size:0.9rem; line-height:1.75; color:var(--ink-mid); white-space:pre-wrap; word-break:break-word; min-height:80px; }
  .split-body.rewritten { color:var(--ink); border-left:3px solid var(--violet); }
  .diff-row    { display:flex; flex-wrap:wrap; gap:0.4rem; padding:0.75rem 1.25rem; border-top:1px solid var(--rule2); }
  .diff-pill   { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.06em; padding:0.18rem 0.55rem; border-radius:100px; background:var(--violet-pale); color:var(--violet); border:1px solid var(--violet-dim); }

  /* FIX #10: copy button for rewritten output */
  .copy-btn { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.08em; text-transform:uppercase; background:var(--surface3); border:1px solid var(--rule2); border-radius:3px; color:var(--ink-mid); padding:0.25rem 0.65rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; flex-shrink:0; }
  .copy-btn:hover { border-color:var(--violet-dim); color:var(--violet); }
  .copy-btn.copied { border-color:var(--mint-dim); color:var(--mint); }

  /* ── ACTION ROW ── */
  .action-row { display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1rem; }
  .action-row .primary-btn, .action-row .ghost-btn { flex:1; min-width:120px; text-align:center; }
  @media(max-width:500px) {
    .action-row { flex-direction:column; }
    .action-row .primary-btn, .action-row .ghost-btn { width:100%; }
  }

  /* ── ERROR ── */
  .error-box { background:#1A0D24; border:1px solid #5E2080; border-radius:4px; padding:1rem 1.25rem; color:#C880FF; font-size:0.88rem; line-height:1.6; margin-top:1rem; display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; animation:riseIn 0.25s ease; }
  .error-close { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.1em; text-transform:uppercase; background:none; border:1px solid #5E2080; border-radius:3px; color:#C880FF; padding:0.25rem 0.6rem; cursor:pointer; white-space:nowrap; flex-shrink:0; transition:border-color 0.15s; }
  .error-close:hover { border-color:#9B5DE5; }
`;

const INTENSITY_OPTS   = ["Subtle", "Balanced", "Full"];
const ALL_TRAITS       = ["Sentence rhythm","Vocabulary register","Tone","Humour","Formality","Sentence length","Punctuation style","Paragraph structure"];
// FIX #4: default traits used as fallback when user deselects all
const DEFAULT_TRAITS   = ["Sentence rhythm", "Tone", "Vocabulary register"];

// Helper: section tag with clean slash prefix
function STag({ children }) {
  return (
    <div className="section-tag">
      <span className="section-tag-slash">//</span>
      {children}
    </div>
  );
}

function StyleMirrorApp() {
  const [stage, setStage]             = useState(1);
  const [sample, setSample]           = useState("");
  const [intensity, setIntensity]     = useState("Balanced");
  const [priorityTraits, setPriority] = useState([...DEFAULT_TRAITS]);
  const [voiceProfile, setVoice]      = useState(null);
  const [draft, setDraft]             = useState("");
  const [rewriteResult, setRewrite]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [loadingLabel, setLoadLbl]    = useState("");
  const [error, setError]             = useState("");
  // FIX #10: copy state
  const [copied, setCopied]           = useState(false);

  const toggleTrait = t => setPriority(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const sampleTrim  = sample.trim();
  const draftTrim   = draft.trim();
  const canExtract  = sampleTrim.length >= 80 && !loading;
  const canRewrite  = draftTrim.length  >= 30  && !loading;
  const sampleWords = sampleTrim ? sampleTrim.split(/\s+/).length : 0;
  const draftWords  = draftTrim  ? draftTrim.split(/\s+/).length  : 0;

  // FIX #10: copy to clipboard handler
  const copyRewrite = async () => {
    if (!rewriteResult?.rewritten) return;
    try {
      await navigator.clipboard.writeText(rewriteResult.rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked in some contexts — fail silently */ }
  };

  const extractVoice = async () => {
    if (!canExtract) return;
    // FIX #3: set label before loading so there's no blank flash
    setLoadLbl("Extracting your voice…");
    setLoading(true); setError("");

    // FIX #4: fallback to defaults if user deselected all traits
    const traits = priorityTraits.length > 0 ? priorityTraits : DEFAULT_TRAITS;

    const prompt = `Analyse this writing sample and extract the author's unique voice. Focus especially on: ${traits.join(", ")}.

Writing sample:
---
${sampleTrim}
---

Return ONLY valid JSON, no markdown:
{
  "traits": [
    {"name":"Sentence Rhythm","description":"specific concrete observation"},
    {"name":"Vocabulary Register","description":"..."},
    {"name":"Tone","description":"..."},
    {"name":"Sentence Length","description":"..."},
    {"name":"Punctuation Style","description":"..."},
    {"name":"Paragraph Structure","description":"..."}
  ],
  "summary": "2-3 sentence overall characterisation of this writer's voice"
}
Include 5-6 trait objects. Be specific — avoid vague labels like 'clear' or 'professional'.`;

    try {
      const p = await callGemini(prompt, 800);
      const extracted = Array.isArray(p.traits)
        ? p.traits.filter(t => t.name && t.description).slice(0, 6)
        : [];
      if (!extracted.length) throw new Error("Could not extract traits — try a longer writing sample");
      // FIX #3: set data and transition state before clearing label
      setVoice({ traits: extracted, summary: typeof p.summary === "string" ? p.summary.trim() : "" });
      setStage(2);
      setLoadLbl("");
    } catch (e) {
      setError(e.message);
      setLoadLbl("");
    } finally {
      setLoading(false);
    }
  };

  const rewriteDraft = async () => {
    if (!canRewrite || !voiceProfile) return;
    // FIX #5: snapshot draft text at call time to avoid stale closure
    const draftSnapshot = draftTrim;

    setLoadLbl("Rewriting in your voice…");
    setLoading(true); setError(""); setRewrite(null); setCopied(false);

    const traitLines = voiceProfile.traits.map(t => `- ${t.name}: ${t.description}`).join("\n");
    const intensityNote = intensity === "Subtle"
      ? "Minimal changes — adjust phrasing and word choice only, preserve structure."
      : intensity === "Full"
      ? "Full transformation — restructure sentences and paragraphs to deeply match the voice."
      : "Balanced — integrate the voice naturally while keeping the original message clear.";

    const prompt = `Rewrite the draft below to match this writer's voice exactly.
Intensity: ${intensity}. ${intensityNote}

Voice profile:
${traitLines}
Overall: ${voiceProfile.summary}

Draft to rewrite:
---
${draftSnapshot}
---

Return ONLY valid JSON, no markdown:
{
  "rewritten": "the complete rewritten text",
  "changes": ["change label 1","change label 2","change label 3"]
}
3-5 short change labels describing what was changed (e.g. "Shortened sentences").
Preserve the meaning and all factual content exactly. Only change the style.`;

    try {
      const p = await callGemini(prompt, 1000);
      const rewritten = typeof p.rewritten === "string" ? p.rewritten.trim() : "";
      if (!rewritten) throw new Error("No rewrite returned — please try again");
      setRewrite({
        rewritten,
        changes: Array.isArray(p.changes) ? p.changes.slice(0, 5) : [],
        // FIX #5: store the snapshot so split view always shows the correct original
        originalDraft: draftSnapshot,
      });
      setLoadLbl("");
    } catch (e) {
      setError(e.message);
      setLoadLbl("");
    } finally {
      setLoading(false);
    }
  };

  // FIX #6: backToS1 no longer clears draft — user keeps their draft when re-capturing voice
  const backToS1   = () => { setStage(1); setVoice(null); setRewrite(null); setError(""); setCopied(false); };
  const resetWrite = () => { setRewrite(null); setError(""); setCopied(false); };
  const fullReset  = () => { setStage(1); setVoice(null); setSample(""); setDraft(""); setRewrite(null); setError(""); setCopied(false); };

  // FIX #1 + #7: explicit "pending" state for future steps, "active"/"done" for current/past
  // stepState values: "pending" | "active" | "done"
  const getStepState = (stepIdx) => {
    if (stepIdx === 0) return stage === 1 ? "active" : "done";
    if (stepIdx === 1) {
      if (stage === 1) return "pending";
      if (stage === 2 && !rewriteResult) return "active";
      return "done";
    }
    if (stepIdx === 2) {
      if (!rewriteResult) return "pending";
      return "active";
    }
    return "pending";
  };

  const STEPS = [
    { n: "01", label: "Capture voice" },
    { n: "02", label: "Paste draft"   },
    { n: "03", label: "See rewrite"   },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="page">

          {/* ══ HEADER ══ */}
          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname">Style<span>Mirror</span></h1>
              <p className="header-tagline">Extract your voice. Rewrite anything in it.</p>
            </div>
          </header>

          <main className="main">

            {/* Step bar */}
            <div className="steps" role="progressbar" aria-label="Progress">
              {STEPS.map((s, i) => {
                const st = getStepState(i);
                return (
                  <div key={i} className={`step ${st}`}>
                    {/* FIX #14: pending steps show dimmed number, done shows ✓ */}
                    <span className="step-num">{st === "done" ? "✓" : s.n}</span>
                    <span className="step-label">{s.label}</span>
                  </div>
                );
              })}
            </div>

            {/* ── STAGE 1 ── */}
            {stage === 1 && !loading && (
              <>
                <STag>Your writing sample</STag>
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">Paste 2–3 paragraphs you've written</span>
                    <span className="panel-badge">Stage 01</span>
                  </div>
                  <div className="panel-body">
                    <div className="field-row">
                      <label className="field-label" htmlFor="sample-ta">Your writing</label>
                      <textarea
                        id="sample-ta" className="mirror-ta tall"
                        placeholder="Paste something you've written — an email, blog post, LinkedIn update. The more natural and authentic, the better…"
                        value={sample} onChange={e => setSample(e.target.value)}
                      />
                      {sample.length > 0 && (
                        <div className={`field-hint ${sample.length < 80 ? "warn" : "ok"}`}>
                          {sample.length < 80 ? `${80 - sample.length} more chars needed` : `${sampleWords} words`}
                        </div>
                      )}
                    </div>

                    <div className="field-row">
                      <label className="field-label">
                        Prioritise these traits <span className="opt">(pick what matters most)</span>
                      </label>
                      <div className="trait-chips">
                        {ALL_TRAITS.map(t => (
                          <button key={t} className={`trait-chip ${priorityTraits.includes(t) ? "on" : ""}`} onClick={() => toggleTrait(t)}>{t}</button>
                        ))}
                      </div>
                    </div>

                    <div className="controls-row">
                      <div className="controls-left">
                        <label className="field-label">Rewrite intensity (set now)</label>
                        <div className="chips-row">
                          {INTENSITY_OPTS.map(o => (
                            <button key={o} className={`chip ${intensity === o ? "on" : ""}`} onClick={() => setIntensity(o)}>{o}</button>
                          ))}
                        </div>
                      </div>
                      <button className="primary-btn" onClick={extractVoice} disabled={!canExtract}>
                        Extract voice →
                      </button>
                    </div>

                    {error && (
                      <div className="error-box" role="alert">
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
                <div className="loading-ring" aria-hidden="true" />
                {/* FIX #3: label always set before loading=true so no blank flash */}
                <div className="loading-label">{loadingLabel}</div>
                <div className="loading-sub">this takes a few seconds</div>
              </div>
            )}

            {/* ── STAGE 2 ── */}
            {stage === 2 && voiceProfile && !loading && (
              <>
                <STag>Your voice profile</STag>
                <div className="voice-card">
                  <div className="voice-card-head">
                    <span className="voice-card-title">Voice extracted</span>
                    {/* FIX #6: re-capture keeps draft intact */}
                    <button className="ghost-btn" onClick={backToS1}>← Re-capture voice</button>
                  </div>
                  <div className="voice-card-body">
                    <div className="traits-grid">
                      {voiceProfile.traits.map((t, i) => (
                        <div key={i} className="trait-card">
                          <div className="trait-name">{t.name}</div>
                          <div className="trait-value">{t.description}</div>
                        </div>
                      ))}
                    </div>
                    {voiceProfile.summary && (
                      <div className="voice-summary">{voiceProfile.summary}</div>
                    )}
                  </div>
                </div>

                {/* Draft input */}
                {!rewriteResult && (
                  <>
                    <STag>Paste the draft to rewrite</STag>
                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">AI-generated or generic draft</span>
                        <span className="panel-badge">Stage 02</span>
                      </div>
                      <div className="panel-body">
                        <div className="field-row">
                          <label className="field-label" htmlFor="draft-ta">Draft text</label>
                          <textarea
                            id="draft-ta" className="mirror-ta short"
                            placeholder="Paste any draft — AI-written text, a generic email, a bland bio — we'll rewrite it to sound like you…"
                            value={draft} onChange={e => setDraft(e.target.value)}
                          />
                          {draft.length > 0 && (
                            <div className={`field-hint ${draft.length < 30 ? "warn" : "ok"}`}>
                              {draft.length < 30 ? `${30 - draft.length} more chars needed` : `${draftWords} words`}
                            </div>
                          )}
                        </div>
                        <div className="controls-row">
                          <div className="controls-left">
                            <label className="field-label">Rewrite intensity</label>
                            <div className="chips-row">
                              {INTENSITY_OPTS.map(o => (
                                <button key={o} className={`chip ${intensity === o ? "on" : ""}`} onClick={() => setIntensity(o)}>{o}</button>
                              ))}
                            </div>
                          </div>
                          <button className="primary-btn" onClick={rewriteDraft} disabled={!canRewrite}>
                            Rewrite in my voice →
                          </button>
                        </div>
                        {error && (
                          <div className="error-box" role="alert">
                            <span>{error}</span>
                            <button className="error-close" onClick={() => setError("")}>Close</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Split result */}
                {rewriteResult && (
                  <>
                    <STag>Before / After</STag>
                    <div className="split-grid">
                      {/* Before */}
                      <div className="split-panel">
                        <div className="split-head">
                          <div className="split-head-left">
                            <span className="split-dot before" />
                            <span className="split-title">Original draft</span>
                          </div>
                        </div>
                        {/* FIX #5: use stored snapshot, not live draftTrim */}
                        <div className="split-body">{rewriteResult.originalDraft}</div>
                      </div>
                      {/* After */}
                      <div className="split-panel">
                        <div className="split-head">
                          <div className="split-head-left">
                            <span className="split-dot after" />
                            <span className="split-title">Rewritten in your voice</span>
                          </div>
                          {/* FIX #10: copy button on rewrite output */}
                          <button
                            className={`copy-btn ${copied ? "copied" : ""}`}
                            onClick={copyRewrite}
                          >{copied ? "Copied ✓" : "Copy"}</button>
                        </div>
                        <div className="split-body rewritten">{rewriteResult.rewritten}</div>
                        {rewriteResult.changes.length > 0 && (
                          <div className="diff-row">
                            {rewriteResult.changes.map((c, i) => (
                              <span key={i} className="diff-pill">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="action-row">
                      <button className="ghost-btn" onClick={resetWrite}>Try different draft</button>
                      <button className="ghost-btn" onClick={backToS1}>Re-capture voice</button>
                      <button className="primary-btn" onClick={fullReset}>Start over →</button>
                    </div>

                    {error && (
                      <div className="error-box" role="alert">
                        <span>{error}</span>
                        <button className="error-close" onClick={() => setError("")}>Close</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>

          {/* ══ FOOTER ══ */}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>

        </div>
      </div>
    </>
  );
}

export default function StyleMirror() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("style-mirror");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <StyleMirrorApp />
    </>
  );
}
