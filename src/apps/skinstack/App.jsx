import { callGemini, setAppContext } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useQualityGate } from "../../shared/components/QualityGate";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState } from "react";


// ── Copy hook ──
function useCopy() {
  const [key, setKey] = useState("");
  const copy = (text, k) => {
    navigator.clipboard.writeText(text).then(() => { setKey(k); setTimeout(() => setKey(""), 2000); }).catch(() => {});
  };
  return { copiedKey: key, copy };
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Vidaloka&family=Nunito:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; }

  :root {
    --bg:          #FDFAF6;
    --surface:     #FFFFFF;
    --surface2:    #FAF6F2;
    --surface3:    #F3EDE8;
    --rose:        #C084A0;
    --rose-dark:   #9B5F7A;
    --rose-pale:   #FDF0F5;
    --rose-mid:    #E8C0D4;
    --rose-glow:   rgba(192,132,160,0.12);
    --sage:        #7BA08C;
    --sage-dark:   #5A7A6A;
    --sage-pale:   #EFF5F1;
    --sage-glow:   rgba(123,160,140,0.12);
    --peach:       #E8A87C;
    --peach-pale:  #FEF5EE;
    --gold:        #C9A96E;
    --rule:        #EDE8E2;
    --rule2:       #DDD6CE;
    --ink:         #2C1F1A;
    --ink-mid:     #7A6058;
    --ink-dim:     #B8A89E;
    --font-disp:   'Vidaloka', Georgia, serif;
    --font-body:   'Nunito', sans-serif;
  }

  html, body { height:100%; }
  body { background:var(--bg); color:var(--ink); font-family:var(--font-body); }
  .app { min-height:100%; background:var(--bg); display:flex; flex-direction:column; }

  /* Soft petal texture — top right bloom */
  .app::before {
    content:''; position:fixed; top:-120px; right:-120px;
    width:480px; height:480px; border-radius:50%;
    background:radial-gradient(circle, rgba(192,132,160,0.08) 0%, rgba(232,168,124,0.04) 40%, transparent 70%);
    pointer-events:none; z-index:0;
  }
  /* Sage bloom — bottom left */
  .app::after {
    content:''; position:fixed; bottom:-100px; left:-100px;
    width:380px; height:380px; border-radius:50%;
    background:radial-gradient(circle, rgba(123,160,140,0.07) 0%, transparent 65%);
    pointer-events:none; z-index:0;
  }

  .page { position:relative; z-index:1; flex:1; display:flex; flex-direction:column; }

  /* ══ HEADER ══ */
  .site-header {
    background:var(--surface);
    border-bottom:1px solid var(--rule);
    padding:1rem 1.75rem;
    display:flex; align-items:center; justify-content:space-between;
    gap:1rem; flex-wrap:wrap;
    box-shadow:0 1px 0 rgba(192,132,160,0.08);
  }
  .header-brand { display:flex; flex-direction:column; gap:0.05rem; }
  .header-eyebrow { font-family:var(--font-body); font-size:0.5rem; font-weight:600; letter-spacing:0.22em; text-transform:uppercase; color:var(--rose); }
  .header-appname { font-family:var(--font-disp); font-size:1.6rem; color:var(--ink); line-height:1; letter-spacing:-0.01em; }
  .header-appname span { color:var(--rose); }
  .header-tagline { font-family:var(--font-body); font-size:0.72rem; color:var(--ink-dim); margin-top:0.1rem; font-style:italic; }
  @media(max-width:480px){ .header-tagline { display:none; } }

  /* ══ FOOTER ══ */
  .site-footer {
    border-top:1px solid var(--rule); padding:1rem 1.75rem;
    display:flex; align-items:center; justify-content:space-between;
    gap:0.75rem; flex-wrap:wrap; background:var(--surface);
  }
  .footer-left  { font-family:var(--font-body); font-size:0.6rem; letter-spacing:0.06em; color:var(--ink-dim); }
  .footer-left strong { color:var(--rose); font-weight:600; }
  .footer-right { font-family:var(--font-body); font-size:0.6rem; letter-spacing:0.06em; color:var(--ink-dim); }

  /* ── Main ── */
  .main { max-width:880px; margin:0 auto; padding:2rem 1.5rem 3rem; width:100%; flex:1; }

  /* ── Section heading ── */
  .section-hed {
    font-family:var(--font-body); font-size:0.58rem; font-weight:700;
    letter-spacing:0.2em; text-transform:uppercase; color:var(--ink-dim);
    display:flex; align-items:center; gap:0.75rem; margin-bottom:1.25rem;
  }
  .section-hed::after { content:''; flex:1; height:1px; background:var(--rule); }

  /* ── Input card ── */
  .input-card {
    background:var(--surface); border:1px solid var(--rule); border-radius:12px;
    overflow:hidden; box-shadow:0 2px 24px rgba(44,31,26,0.06), 0 1px 0 rgba(255,255,255,0.8) inset;
  }
  .input-card-head {
    padding:1.25rem 1.75rem; background:linear-gradient(135deg, var(--rose-pale) 0%, var(--surface) 100%);
    border-bottom:1px solid var(--rule);
    display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;
  }
  .input-card-title { font-family:var(--font-disp); font-size:1.15rem; color:var(--ink); }
  .input-card-sub { font-size:0.72rem; color:var(--ink-dim); font-style:italic; margin-top:0.15rem; }
  .input-card-body { padding:1.75rem; display:flex; flex-direction:column; gap:1.5rem; }

  .field { display:flex; flex-direction:column; gap:0.5rem; }
  .field-label { font-family:var(--font-body); font-size:0.58rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--rose); }
  .field-label .opt { color:var(--ink-dim); font-weight:400; text-transform:none; letter-spacing:0.04em; margin-left:0.35rem; }

  /* Skin type pills */
  .skin-types { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .skin-pill {
    padding:0.45rem 1.1rem; border:1.5px solid var(--rule2); border-radius:100px;
    font-family:var(--font-body); font-size:0.75rem; font-weight:500;
    cursor:pointer; color:var(--ink-mid); background:var(--surface2);
    transition:all 0.18s; user-select:none;
  }
  .skin-pill:hover { border-color:var(--rose-mid); color:var(--rose); }
  .skin-pill.on { background:var(--rose); border-color:var(--rose); color:white; box-shadow:0 2px 8px var(--rose-glow); }

  /* Concern chips — multi select */
  .concern-grid { display:flex; flex-wrap:wrap; gap:0.45rem; }
  .concern-chip {
    display:flex; align-items:center; gap:0.35rem;
    padding:0.35rem 0.85rem; border:1.5px solid var(--rule2); border-radius:8px;
    font-size:0.72rem; font-weight:500; cursor:pointer;
    color:var(--ink-mid); background:var(--surface2);
    transition:all 0.18s; user-select:none;
  }
  .concern-chip:not(.disabled):hover { border-color:var(--rose-mid); color:var(--rose); }
  .concern-chip.on { background:var(--rose-pale); border-color:var(--rose); color:var(--rose-dark); }
  .concern-chip.disabled { opacity:0.4; cursor:default; }
  .concern-dot { width:6px; height:6px; border-radius:50%; background:currentColor; opacity:0.6; flex-shrink:0; }

  /* Text area */
  .skin-ta {
    width:100%; min-height:90px; resize:vertical;
    background:var(--surface2); border:1.5px solid var(--rule2); border-radius:8px;
    padding:0.9rem 1rem; font-family:var(--font-body); font-size:0.9rem;
    color:var(--ink); line-height:1.65; outline:none;
    transition:border-color 0.2s, box-shadow 0.2s;
  }
  .skin-ta:focus { border-color:var(--rose); box-shadow:0 0 0 3px var(--rose-glow); }
  .skin-ta::placeholder { color:var(--ink-dim); font-style:italic; }

  /* Preference row */
  .pref-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  @media(max-width:600px){ .pref-row { grid-template-columns:1fr; } }

  .chip-group { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .chip {
    padding:0.3rem 0.7rem; border:1.5px solid var(--rule2); border-radius:100px;
    font-size:0.68rem; font-weight:500; cursor:pointer;
    color:var(--ink-mid); background:var(--surface2);
    transition:all 0.15s; user-select:none; white-space:nowrap;
  }
  .chip:hover { border-color:var(--sage); color:var(--sage-dark); }
  .chip.on { background:var(--sage-pale); border-color:var(--sage); color:var(--sage-dark); }

  /* Restriction toggles */
  .restriction-row { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .rest-chip {
    display:flex; align-items:center; gap:0.35rem;
    padding:0.3rem 0.75rem; border:1.5px solid var(--rule2); border-radius:100px;
    font-size:0.68rem; font-weight:500; cursor:pointer;
    color:var(--ink-mid); background:var(--surface2);
    transition:all 0.15s; user-select:none;
  }
  .rest-chip:hover { border-color:var(--peach); color:var(--peach); }
  .rest-chip.on { background:var(--peach-pale); border-color:var(--peach); color:var(--ink); }

  /* Brand toggle */
  .brand-toggle-row { display:flex; align-items:center; gap:0.85rem; padding:0.85rem 1rem; background:var(--surface2); border-radius:8px; border:1.5px solid var(--rule2); }
  .toggle-switch { position:relative; width:40px; height:22px; flex-shrink:0; }
  .toggle-switch input { opacity:0; width:0; height:0; position:absolute; }
  .toggle-track {
    position:absolute; inset:0; border-radius:100px; cursor:pointer;
    background:var(--rule2); transition:background 0.2s;
  }
  .toggle-switch input:checked ~ .toggle-track { background:var(--sage); }
  .toggle-track::after {
    content:''; position:absolute; left:2px; top:2px;
    width:18px; height:18px; border-radius:50%; background:white;
    transition:transform 0.2s; box-shadow:0 1px 4px rgba(0,0,0,0.15);
  }
  .toggle-switch input:checked ~ .toggle-track::after { transform:translateX(18px); }
  .toggle-label { font-size:0.8rem; font-weight:500; color:var(--ink); }
  .toggle-sub { font-size:0.65rem; color:var(--ink-dim); margin-top:0.1rem; font-style:italic; }

  /* Form footer */
  .form-footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding-top:0.75rem; border-top:1px solid var(--rule); }

  .analyse-btn {
    padding:0.8rem 2.25rem; background:var(--rose); color:white; border:none;
    border-radius:100px; font-family:var(--font-body); font-size:0.9rem; font-weight:700;
    cursor:pointer; transition:all 0.2s; white-space:nowrap; letter-spacing:0.01em;
    box-shadow:0 2px 12px var(--rose-glow);
  }
  .analyse-btn:hover:not(:disabled) { background:var(--rose-dark); transform:translateY(-1px); box-shadow:0 4px 20px var(--rose-glow); }
  .analyse-btn:active:not(:disabled) { transform:translateY(0); }
  .analyse-btn:disabled { background:var(--rule2); color:var(--ink-dim); cursor:not-allowed; transform:none; box-shadow:none; }
  @media(max-width:500px){ .analyse-btn { width:100%; text-align:center; } }

  /* ── Loading ── */
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }
  @keyframes riseIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

  .loading-state { text-align:center; padding:4rem 1rem; min-height:50vh; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .loading-orb {
    width:56px; height:56px; border-radius:50%; margin:0 auto 1.5rem;
    background:linear-gradient(135deg, var(--rose-pale) 0%, var(--rose-mid) 100%);
    display:flex; align-items:center; justify-content:center;
    animation:float 2.5s ease-in-out infinite;
    box-shadow:0 4px 20px var(--rose-glow);
    font-size:1.5rem; line-height:1;
  }
  .loading-txt { font-family:var(--font-disp); font-size:1.2rem; color:var(--ink); margin-bottom:0.3rem; }
  .loading-sub { font-size:0.72rem; color:var(--ink-dim); font-style:italic; }

  /* ── Results header ── */
  .results-bar {
    display:flex; align-items:flex-end; justify-content:space-between;
    gap:1rem; flex-wrap:wrap; margin-bottom:1.75rem;
    padding-bottom:1.25rem; border-bottom:1px solid var(--rule);
  }
  .results-headline { font-family:var(--font-disp); font-size:1.35rem; color:var(--ink); line-height:1.2; }
  .results-sub { font-size:0.72rem; color:var(--ink-dim); font-style:italic; margin-top:0.25rem; word-break:break-word; line-height:1.6; }
  .results-actions { display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; }
  @media(max-width:600px){ .results-actions { width:100%; } .results-actions .reset-btn { margin-left:auto; } }

  .ghost-btn {
    padding:0.4rem 0.9rem; background:var(--surface); border:1.5px solid var(--rule2);
    border-radius:100px; font-size:0.68rem; font-weight:600; letter-spacing:0.05em;
    cursor:pointer; color:var(--ink-mid); transition:all 0.15s; white-space:nowrap;
  }
  .ghost-btn:hover { border-color:var(--rose); color:var(--rose); }
  .ghost-btn.copied { border-color:var(--sage); color:var(--sage-dark); }
  .reset-btn { padding:0.4rem 0.9rem; background:none; border:1.5px solid var(--rule2); border-radius:100px; font-size:0.68rem; font-weight:500; cursor:pointer; color:var(--ink-dim); transition:all 0.15s; white-space:nowrap; }
  .reset-btn:hover { border-color:var(--rule2); color:var(--ink); }

  /* ── Result cards ── */
  .result-cards { display:flex; flex-direction:column; gap:1.25rem; }

  .result-card {
    background:var(--surface); border:1px solid var(--rule); border-radius:12px;
    overflow:hidden; box-shadow:0 2px 16px rgba(44,31,26,0.05);
    animation:riseIn 0.4s ease both;
  }
  .result-card:nth-child(1){ animation-delay:0.05s; }
  .result-card:nth-child(2){ animation-delay:0.1s; }
  .result-card:nth-child(3){ animation-delay:0.15s; }
  .result-card:nth-child(4){ animation-delay:0.2s; }

  .card-head {
    display:flex; align-items:center; justify-content:space-between;
    padding:0.9rem 1.4rem; background:var(--surface2);
    border-bottom:1px solid var(--rule); gap:0.75rem; flex-wrap:wrap;
  }
  .card-head-left { display:flex; align-items:center; gap:0.75rem; }
  .card-icon { font-size:1.1rem; line-height:1; flex-shrink:0; }
  .card-title { font-family:var(--font-body); font-size:0.65rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--rose); }
  .card-body { padding:1.25rem 1.4rem; }

  /* Routine section */
  .routine-block { margin-bottom:1.25rem; }
  .routine-block:last-child { margin-bottom:0; }
  .routine-label {
    font-size:0.62rem; font-weight:700; letter-spacing:0.16em; text-transform:uppercase;
    color:var(--sage-dark); margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem;
  }
  .routine-label::after { content:''; flex:1; height:1px; background:var(--rule); }

  .step-list { display:flex; flex-direction:column; gap:0.65rem; }
  .step-item {
    display:flex; align-items:flex-start; gap:0.9rem;
    padding:0.85rem 1rem; background:var(--surface2); border-radius:8px;
    border:1px solid var(--rule); transition:border-color 0.15s;
  }
  .step-item:hover { border-color:var(--rose-mid); }
  .step-num {
    font-family:var(--font-body); font-size:0.58rem; font-weight:700;
    color:white; background:var(--rose); border-radius:50%;
    width:20px; height:20px; display:flex; align-items:center; justify-content:center;
    flex-shrink:0; margin-top:0.05rem;
  }
  .step-body { flex:1; min-width:0; }
  .step-category { font-size:0.7rem; font-weight:700; color:var(--ink); margin-bottom:0.2rem; }
  .step-ingredient {
    font-size:0.68rem; font-weight:700; color:var(--rose-dark);
    background:var(--rose-pale); border:1px solid var(--rose-mid);
    border-radius:4px; padding:0.1rem 0.45rem; display:inline-block; margin-bottom:0.3rem;
  }
  .step-brand {
    font-size:0.68rem; font-weight:600; color:var(--sage-dark);
    background:var(--sage-pale); border:1px solid rgba(123,160,140,0.35);
    border-radius:4px; padding:0.1rem 0.45rem; display:inline-block; margin-left:0.3rem; margin-bottom:0.3rem;
  }
  .step-why { font-size:0.78rem; color:var(--ink-mid); line-height:1.55; }
  .step-price { font-size:0.65rem; color:var(--ink-dim); margin-top:0.2rem; }

  /* Conflict checker */
  .conflict-list { display:flex; flex-direction:column; gap:0.75rem; }
  .conflict-item { border-radius:8px; overflow:hidden; border:1.5px solid; }
  .conflict-item.danger  { border-color:rgba(232,168,124,0.6); background:var(--peach-pale); }
  .conflict-item.warning { border-color:rgba(192,132,160,0.35); background:var(--rose-pale); }
  .conflict-item.ok      { border-color:rgba(123,160,140,0.35); background:var(--sage-pale); }
  .conflict-head { display:flex; align-items:center; gap:0.6rem; padding:0.6rem 1rem; }
  .conflict-badge { font-size:0.55rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:0.15rem 0.5rem; border-radius:100px; }
  .conflict-item.danger  .conflict-badge { background:rgba(232,168,124,0.2); color:var(--peach); }
  .conflict-item.warning .conflict-badge { background:rgba(192,132,160,0.15); color:var(--rose-dark); }
  .conflict-item.ok      .conflict-badge { background:rgba(123,160,140,0.15); color:var(--sage-dark); }
  .conflict-products { font-size:0.7rem; font-weight:600; color:var(--ink); }
  .conflict-body { padding:0.5rem 1rem 0.75rem; }
  .conflict-explanation { font-size:0.8rem; color:var(--ink-mid); line-height:1.55; }
  .conflict-fix { font-size:0.75rem; color:var(--sage-dark); margin-top:0.35rem; font-style:italic; }

  .no-conflicts { display:flex; align-items:center; gap:0.6rem; font-size:0.85rem; color:var(--sage-dark); padding:0.25rem 0; }
  .no-conflicts-icon { font-size:1.1rem; }

  /* Ingredient decoder */
  .ingredient-list { display:flex; flex-direction:column; gap:0.65rem; }
  .ingredient-item { padding:0.85rem 1rem; background:var(--surface2); border-radius:8px; border:1px solid var(--rule); }
  .ingredient-name { font-size:0.82rem; font-weight:700; color:var(--ink); margin-bottom:0.25rem; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
  .ing-fit { font-size:0.6rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; padding:0.1rem 0.45rem; border-radius:100px; }
  .ing-fit.good { background:rgba(123,160,140,0.15); color:var(--sage-dark); }
  .ing-fit.caution { background:rgba(232,168,124,0.2); color:var(--peach); }
  .ing-fit.neutral { background:var(--rule); color:var(--ink-dim); }
  .ingredient-desc { font-size:0.78rem; color:var(--ink-mid); line-height:1.55; }

  /* Question / Next up */
  .answer-block { font-size:0.9rem; line-height:1.75; color:var(--ink-mid); }
  .answer-block p + p { margin-top:0.75rem; }

  /* Bottom CTA */
  .bottom-cta { display:flex; gap:0.75rem; margin-top:1.75rem; flex-wrap:wrap; }
  .bottom-cta .reset-btn { text-align:center; padding:0.65rem 1.25rem; }
  .bottom-cta .analyse-btn { flex:1; text-align:center; }
  @media(max-width:500px){ .bottom-cta { flex-direction:column; } .bottom-cta .analyse-btn,.bottom-cta .reset-btn { width:100%; } }

  /* ── Error ── */
  .error-box {
    background:var(--peach-pale); border:1.5px solid rgba(232,168,124,0.5); border-radius:8px;
    padding:1rem 1.25rem; color:var(--ink-mid); font-size:0.85rem; line-height:1.6;
    margin-top:1rem; display:flex; align-items:flex-start; justify-content:space-between;
    gap:1rem; flex-wrap:wrap; animation:riseIn 0.25s ease;
  }
  .error-close { font-size:0.6rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; background:none; border:1.5px solid rgba(232,168,124,0.5); border-radius:100px; color:var(--ink-dim); padding:0.25rem 0.6rem; cursor:pointer; white-space:nowrap; flex-shrink:0; }

  /* ── Concern count badge ── */
  .concern-count { font-size:0.62rem; color:var(--ink-dim); font-style:italic; display:inline; }
  .concern-count.maxed { color:var(--rose-dark); font-weight:700; }
`;

const SKIN_TYPES  = ["Dry","Oily","Combination","Sensitive","Normal"];
const CONCERNS    = ["Acne / Breakouts","Hyperpigmentation","Ageing / Fine lines","Dullness","Uneven texture","Dark circles","Redness / Rosacea","Dehydration","Oiliness / Shine","Pores"];
const BUDGETS     = ["Under ₹500","₹500–₹2,000","₹2,000–₹5,000","₹5,000+"];
const COMPLEXITIES = ["Minimal (2–3 steps)","Standard (4–6 steps)","Full routine (7+)"];
const RESTRICTIONS_LIST = ["Fragrance-free","Vegan","No retinoids","No acids","Alcohol-free","No essential oils"];
const MAX_CONCERNS = 4;

function SkinStackApp() {
  // ── Form state ──
  const [skinType, setSkinType]           = useState("");
  const [concerns, setConcerns]           = useState([]);
  const [currentProducts, setCurrentProducts] = useState("");
  const [budget, setBudget]               = useState("₹500–₹2,000");
  const [complexity, setComplexity]       = useState("Standard (4–6 steps)");
  const [restrictions, setRestrictions]   = useState([]);
  const [specificQ, setSpecificQ]         = useState("");
  const [showBrands, setShowBrands]       = useState(false);

  // ── App state ──
  const [loading, setLoading]   = useState(false);
  const qg = useQualityGate("skinstack");
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const { copiedKey, copy }     = useCopy();

  const canAnalyse = !!skinType && concerns.length > 0 && !loading;

  const toggleConcern = (c) => {
    setConcerns(prev => {
      if (prev.includes(c)) return prev.filter(x => x !== c);
      if (prev.length >= MAX_CONCERNS) return prev; // enforce max
      return [...prev, c];
    });
  };
  const toggleRestriction = (r) => setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const analyse = async () => {
    if (!canAnalyse) return;
    setLoading(true); setError(""); setResult(null);

    // Snapshot all inputs
    const snapType        = skinType;
    const snapConcerns    = [...concerns];
    const snapProducts    = currentProducts.trim();
    const snapBudget      = budget;
    const snapComplexity  = complexity;
    const snapRestrictions = [...restrictions];
    const snapQ           = specificQ.trim();
    const snapBrands      = showBrands;

    const prompt = `You are a certified dermatologist and skincare expert. Build a personalised skincare analysis.

Skin type: ${snapType}
Concerns (priority order): ${snapConcerns.join(", ")}
Budget: ${snapBudget}
Routine complexity: ${snapComplexity}
${snapRestrictions.length ? `Restrictions: ${snapRestrictions.join(", ")}` : ""}
${snapProducts ? `Currently using:\n${snapProducts}` : ""}
${snapQ ? `Specific question: ${snapQ}` : ""}
Show specific brand names: ${snapBrands ? "YES — name actual products available in India (e.g. Minimalist, Dot & Key, CeraVe, The Ordinary, Plum, Mamaearth, Kiehl's, etc.)" : "NO — ingredient-first only"}

Return ONLY valid JSON, no markdown:
{
  "morningRoutine": [
    {
      "step": 1,
      "category": "Cleanser",
      "keyIngredient": "Glycerin",
      "brand": null,
      "why": "why this suits this specific skin type and concerns",
      "priceTier": "₹300–₹500"
    }
  ],
  "nightRoutine": [
    {
      "step": 1,
      "category": "Oil Cleanser",
      "keyIngredient": "Jojoba Oil",
      "brand": null,
      "why": "why",
      "priceTier": "₹400–₹700"
    }
  ],
  "conflicts": [
    {
      "severity": "danger",
      "products": "Retinol + AHA",
      "explanation": "Using both in the same step causes over-exfoliation and barrier damage.",
      "fix": "Use AHA in the morning routine and retinol at night only."
    }
  ],
  "ingredients": [
    {
      "name": "Niacinamide",
      "fit": "good",
      "description": "Excellent for ${snapType} skin. Controls oil and fades hyperpigmentation."
    }
  ],
  "answerOrNext": "Answer to the specific question if asked, OR a recommendation for the single most impactful ingredient to add next and how to introduce it safely."
}

Rules:
- morningRoutine: ${snapComplexity === "Minimal (2–3 steps)" ? "2-3 steps" : snapComplexity === "Standard (4–6 steps)" ? "4-6 steps" : "6-8 steps"}
- nightRoutine: same step count as morning, different products
- why: maximum 1 sentence per step — be concise
- conflicts: ONLY include if currentProducts were provided AND there are genuine conflicts. Empty array [] if no conflicts or no products given.
- ingredients: ONLY include if currentProducts were provided. Extract top 4-5 active ingredients from those products. Empty array [] if no products given.
- brand: if showBrands=NO set brand to null for every step. If showBrands=YES set brand to a real specific product name + size/variant available in India
- fit: exactly "good", "caution", or "neutral"
- severity: exactly "danger", "warning", or "ok"
- priceTier: realistic India price range
- Tailor every recommendation specifically to ${snapType} skin with concerns: ${snapConcerns.join(", ")}
- Respect all restrictions: ${snapRestrictions.length ? snapRestrictions.join(", ") : "none"}`;

    try {
      const parsed = await callGemini(prompt, 6000);
      // Normalise all arrays
      parsed.morningRoutine = Array.isArray(parsed.morningRoutine) ? parsed.morningRoutine : [];
      parsed.nightRoutine   = Array.isArray(parsed.nightRoutine)   ? parsed.nightRoutine   : [];
      parsed.conflicts      = Array.isArray(parsed.conflicts)      ? parsed.conflicts.map(c => ({ ...c, severity: ["danger","warning","ok"].includes(c.severity) ? c.severity : "warning" })) : [];
      parsed.ingredients    = Array.isArray(parsed.ingredients)    ? parsed.ingredients.map(i => ({ ...i, fit: ["good","caution","neutral"].includes(i.fit) ? i.fit : "neutral" })) : [];
      parsed.answerOrNext   = typeof parsed.answerOrNext === "string" ? parsed.answerOrNext.trim() : "";
      // Snapshot metadata
      parsed._skinType    = snapType;
      parsed._concerns    = snapConcerns;
      parsed._showBrands  = snapBrands;
      parsed._hasProducts = !!snapProducts;
      parsed._hasQ        = !!snapQ;
      setResult(parsed);
      saveResult("skinstack", parsed);
    } catch (e) { if (!e.message.startsWith("__COOLDOWN__")) setError(e.message); }
    finally { setLoading(false); }
  };

  const reset     = () => { setResult(null); setError(""); };
  const fullReset = () => { setResult(null); setError(""); setSkinType(""); setConcerns([]); setCurrentProducts(""); setSpecificQ(""); setRestrictions([]); setBudget("₹500–₹2,000"); setComplexity("Standard (4–6 steps)"); setShowBrands(false); };

  // Build copy text for routine
  const routineText = (label, steps) => steps.length === 0 ? "" :
    `${label}\n\n${steps.map(s => `${s.step}. ${s.category} — ${s.keyIngredient}${s.brand ? ` (${s.brand})` : ""}\n   ${s.why}`).join("\n\n")}`;

  const allResultText = result ? [
    routineText("MORNING ROUTINE", result.morningRoutine),
    routineText("NIGHT ROUTINE", result.nightRoutine),
    result.conflicts.length ? `CONFLICTS\n\n${result.conflicts.map(c=>`[${c.severity.toUpperCase()}] ${c.products}: ${c.explanation} Fix: ${c.fix}`).join("\n\n")}` : "",
    result.ingredients.length ? `INGREDIENTS IN YOUR PRODUCTS\n\n${result.ingredients.map(i=>`${i.name} [${i.fit}]: ${i.description}`).join("\n\n")}` : "",
    result.answerOrNext ? `ANSWER / WHAT TO ADD NEXT\n\n${result.answerOrNext}` : "",
  ].filter(Boolean).join("\n\n---\n\n") : "";

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="page">

          {/* ══ HEADER ══ */}
          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname">Skin<span>Stack</span></h1>
              <p className="header-tagline">Your skin, your stack, no guesswork</p>
            </div>
          </header>

          <main className="main">

            {/* INPUT */}
            {!result && !loading && (
              <>
                <div className="section-hed">Tell us about your skin</div>
                <div className="input-card">
                  <div className="input-card-head">
                    <div>
                      <div className="input-card-title">Build your personalised stack</div>
                      <div className="input-card-sub">ingredient-first · conflict-aware · honest</div>
                    </div>
                  </div>
                  <div className="input-card-body">

                    {/* Skin type */}
                    <div className="field">
                      <label className="field-label">Skin type</label>
                      <div className="skin-types">
                        {SKIN_TYPES.map(t => (
                          <button key={t} className={`skin-pill ${skinType === t ? "on" : ""}`} onClick={() => setSkinType(t)}>{t}</button>
                        ))}
                      </div>
                    </div>

                    {/* Concerns */}
                    <div className="field">
                      <label className="field-label">
                        Primary concerns
                        <span className="opt">
                          &nbsp;—&nbsp;
                          <span className={`concern-count ${concerns.length >= MAX_CONCERNS ? "maxed" : ""}`}>
                            {concerns.length}/{MAX_CONCERNS} selected{concerns.length >= MAX_CONCERNS ? " (max)" : ""}
                          </span>
                        </span>
                      </label>
                      <div className="concern-grid">
                        {CONCERNS.map(c => {
                          const isOn = concerns.includes(c);
                          const isDisabled = !isOn && concerns.length >= MAX_CONCERNS;
                          return (
                            <div
                              key={c}
                              className={`concern-chip ${isOn ? "on" : ""} ${isDisabled ? "disabled" : ""}`}
                              onClick={() => !isDisabled && toggleConcern(c)}
                              role="checkbox" aria-checked={isOn}
                              title={isDisabled ? "Maximum 4 concerns" : ""}
                            >
                              {isOn && <span className="concern-dot" />}
                              {c}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current products */}
                    <div className="field">
                      <label className="field-label" htmlFor="products-ta">
                        Current products <span className="opt">(optional — enables conflict & ingredient analysis)</span>
                      </label>
                      <textarea id="products-ta" className="skin-ta"
                        placeholder="List what you're currently using — e.g. Minimalist 10% Niacinamide, The Ordinary Retinol 0.5%, CeraVe Moisturising Cream…"
                        value={currentProducts} onChange={e => setCurrentProducts(e.target.value)} />
                    </div>

                    {/* Preferences row */}
                    <div className="pref-row">
                      <div className="field">
                        <label className="field-label">Budget</label>
                        <div className="chip-group">
                          {BUDGETS.map(b => (
                            <button key={b} className={`chip ${budget === b ? "on" : ""}`} onClick={() => setBudget(b)}>{b}</button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label className="field-label">Routine complexity</label>
                        <div className="chip-group">
                          {COMPLEXITIES.map(c => (
                            <button key={c} className={`chip ${complexity === c ? "on" : ""}`} onClick={() => setComplexity(c)}>{c}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Restrictions */}
                    <div className="field">
                      <label className="field-label">Restrictions <span className="opt">(optional)</span></label>
                      <div className="restriction-row">
                        {RESTRICTIONS_LIST.map(r => (
                          <div key={r} className={`rest-chip ${restrictions.includes(r) ? "on" : ""}`} onClick={() => toggleRestriction(r)}>{r}</div>
                        ))}
                      </div>
                    </div>

                    {/* Specific question */}
                    <div className="field">
                      <label className="field-label" htmlFor="q-ta">
                        Specific question <span className="opt">(optional)</span>
                      </label>
                      <textarea id="q-ta" className="skin-ta" style={{ minHeight:"70px" }}
                        placeholder="e.g. Can I use Vitamin C and niacinamide together? Why does my skin feel tight after cleansing? What's causing my texture?"
                        value={specificQ} onChange={e => setSpecificQ(e.target.value)} />
                    </div>

                    {/* Brand toggle */}
                    <div className="brand-toggle-row">
                      <label className="toggle-switch">
                        <input type="checkbox" checked={showBrands} onChange={e => setShowBrands(e.target.checked)} />
                        <span className="toggle-track" />
                      </label>
                      <div>
                        <div className="toggle-label">Show specific product recommendations</div>
                        <div className="toggle-sub">Off = ingredient-first (unbiased). On = names actual products available in India.</div>
                      </div>
                    </div>

                    <div className="form-footer">
                      <div style={{ fontSize:"0.65rem", color:"var(--ink-dim)", fontStyle:"italic" }}>
                        {!skinType && "Select a skin type to begin"}
                        {skinType && concerns.length === 0 && "Select at least one concern"}
                        {skinType && concerns.length > 0 && `${skinType} skin · ${concerns.length} concern${concerns.length !== 1 ? "s" : ""} · ${complexity}`}
                      </div>
                      <button className="analyse-btn" onClick={analyse} disabled={!canAnalyse || qg.isBlocked}>
                        Build my stack →
                      </button>
                    </div>

                    {error && (
                      <div className="error-box" role="alert">
                        <span>{error}</span>
                        <button className="error-close" onClick={() => setError("")}>✕</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* LOADING */}
            {loading && (
              <div className="loading-state" aria-live="polite">
                <div className="loading-orb" aria-hidden="true">✨</div>
                <div className="loading-txt">Building your stack…</div>
                <div className="loading-sub">analysing skin profile · checking conflicts · building routine</div>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <>
                <div className="results-bar">
                  <div>
                    <div className="results-headline">{result._skinType} skin · Your personalised stack</div>
                    <div className="results-sub">{result._concerns.join(" · ")}</div>
                  </div>
                  <div className="results-actions">
                    <button className={`ghost-btn ${copiedKey === "all" ? "copied" : ""}`} onClick={() => copy(allResultText, "all")}>
                      {copiedKey === "all" ? "Copied ✓" : "Copy all"}
                    </button>
                    <button className="reset-btn" onClick={fullReset}>← Start over</button>
                  </div>
                </div>

                <div className="result-cards">

                  {/* Card 1 — Routine */}
                  <div className="result-card">
                    <div className="card-head">
                      <div className="card-head-left">
                        <span className="card-icon">🌿</span>
                        <span className="card-title">Your Recommended Stack</span>
                      </div>
                      <button className={`ghost-btn ${copiedKey === "routine" ? "copied" : ""}`} onClick={() => copy([routineText("MORNING", result.morningRoutine), routineText("NIGHT", result.nightRoutine)].join("\n\n---\n\n"), "routine")}>
                        {copiedKey === "routine" ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                    <div className="card-body">
                      {result.morningRoutine.length > 0 && (
                        <div className="routine-block">
                          <div className="routine-label">☀️ Morning Routine</div>
                          <div className="step-list">
                            {result.morningRoutine.map((s, i) => (
                              <div key={i} className="step-item">
                                <span className="step-num">{s.step}</span>
                                <div className="step-body">
                                  <div className="step-category">{s.category}</div>
                                  <div>
                                    <span className="step-ingredient">{s.keyIngredient}</span>
                                    {result._showBrands && s.brand && <span className="step-brand">{s.brand}</span>}
                                  </div>
                                  <div className="step-why">{s.why}</div>
                                  {s.priceTier && <div className="step-price">{s.priceTier}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.nightRoutine.length > 0 && (
                        <div className="routine-block">
                          <div className="routine-label">🌙 Night Routine</div>
                          <div className="step-list">
                            {result.nightRoutine.map((s, i) => (
                              <div key={i} className="step-item">
                                <span className="step-num">{s.step}</span>
                                <div className="step-body">
                                  <div className="step-category">{s.category}</div>
                                  <div>
                                    <span className="step-ingredient">{s.keyIngredient}</span>
                                    {result._showBrands && s.brand && <span className="step-brand">{s.brand}</span>}
                                  </div>
                                  <div className="step-why">{s.why}</div>
                                  {s.priceTier && <div className="step-price">{s.priceTier}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2 — Conflicts (only if products provided) */}
                  {result._hasProducts && (
                    <div className="result-card">
                      <div className="card-head">
                        <div className="card-head-left">
                          <span className="card-icon">⚡</span>
                          <span className="card-title">Ingredient Conflict Check</span>
                        </div>
                        <button className={`ghost-btn ${copiedKey === "conflicts" ? "copied" : ""}`} onClick={() => copy(result.conflicts.length ? `CONFLICTS\n\n${result.conflicts.map(c=>`[${c.severity.toUpperCase()}] ${c.products}: ${c.explanation}`).join("\n\n")}` : "No conflicts found in your current routine.", "conflicts")}>
                          {copiedKey === "conflicts" ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <div className="card-body">
                        {result.conflicts.length === 0 ? (
                          <div className="no-conflicts">
                            <span className="no-conflicts-icon">✓</span>
                            <span>No conflicts detected in your current routine. You're good.</span>
                          </div>
                        ) : (
                          <div className="conflict-list">
                            {result.conflicts.map((c, i) => (
                              <div key={i} className={`conflict-item ${c.severity}`}>
                                <div className="conflict-head">
                                  <span className="conflict-badge">{c.severity === "danger" ? "⚠ Avoid" : c.severity === "warning" ? "Caution" : "Fine"}</span>
                                  <span className="conflict-products">{c.products}</span>
                                </div>
                                <div className="conflict-body">
                                  <div className="conflict-explanation">{c.explanation}</div>
                                  {c.fix && <div className="conflict-fix">→ {c.fix}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card 3 — Ingredient decoder (only if products provided) */}
                  {result._hasProducts && result.ingredients.length > 0 && (
                    <div className="result-card">
                      <div className="card-head">
                        <div className="card-head-left">
                          <span className="card-icon">🔬</span>
                          <span className="card-title">Ingredient Decoder</span>
                        </div>
                        <button className={`ghost-btn ${copiedKey === "ingredients" ? "copied" : ""}`} onClick={() => copy(result.ingredients.map(i=>`${i.name} [${i.fit}]: ${i.description}`).join("\n\n"), "ingredients")}>
                          {copiedKey === "ingredients" ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <div className="card-body">
                        <div className="ingredient-list">
                          {result.ingredients.map((ing, i) => (
                            <div key={i} className="ingredient-item">
                              <div className="ingredient-name">
                                {ing.name}
                                <span className={`ing-fit ${ing.fit}`}>{ing.fit === "good" ? "✓ Great for you" : ing.fit === "caution" ? "⚠ Use carefully" : "Neutral"}</span>
                              </div>
                              <div className="ingredient-desc">{ing.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 4 — Answer or What to add next */}
                  {result.answerOrNext && (
                    <div className="result-card">
                      <div className="card-head">
                        <div className="card-head-left">
                          <span className="card-icon">{result._hasQ ? "💬" : "✨"}</span>
                          <span className="card-title">{result._hasQ ? "Your Question, Answered" : "What to Introduce Next"}</span>
                        </div>
                        <button className={`ghost-btn ${copiedKey === "answer" ? "copied" : ""}`} onClick={() => copy(result.answerOrNext, "answer")}>
                          {copiedKey === "answer" ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <div className="card-body">
                        <div className="answer-block">
                          {result.answerOrNext.split(/\n+/).map((p, i) => p.trim() ? <p key={i}>{p.trim()}</p> : null)}
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                <div className="bottom-cta">
                  <button className="reset-btn" onClick={reset}>Adjust skin profile</button>
                  <button className="analyse-btn" onClick={fullReset}>Build a new stack →</button>
                </div>
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

export default function SkinStack() {
  const { isKeySet, KeyGate, Banner } = useApiKey("skinstack");
  setAppContext("skinstack");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <SkinStackApp />
    </>
  );
}
