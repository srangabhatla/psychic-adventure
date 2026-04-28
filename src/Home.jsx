/**
 * Janardhan Labs — Portfolio Home v2
 * No Supabase. No auth. BYOK model.
 * Shows all 14 apps. Key status visible in nav.
 */
import { useState, useEffect } from "react";
import { getApiKey } from "./shared/lib/gemini-client";

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
}

const APPS = [
  { id: "visualmind",          name: "VisualMind",          tagline: "Turn notes into visual understanding",           path: "/visualmind",          icon: "🧠", tag: "Study"         },
  { id: "feedback-translator", name: "FeedbackTranslator",  tagline: "Decode what feedback actually means",            path: "/feedback-translator", icon: "💬", tag: "Communication"  },
  { id: "debate-coach",        name: "DebateCoach",         tagline: "Master both sides of any argument",              path: "/debate-coach",        icon: "⚔️", tag: "Thinking"      },
  { id: "gift-intelligence",   name: "GiftIntelligence",    tagline: "The perfect gift for every person",              path: "/gift-intelligence",   icon: "🎁", tag: "Personal"       },
  { id: "exam-simulator",      name: "ExamSimulator",       tagline: "Test yourself before the test tests you",        path: "/exam-simulator",      icon: "📝", tag: "Study"          },
  { id: "claim-lens",          name: "ClaimLens",           tagline: "Verify any claim with evidence",                 path: "/claim-lens",          icon: "🔍", tag: "Research"       },
  { id: "aperture",            name: "Aperture",            tagline: "See research papers through 6 lenses",           path: "/aperture",            icon: "📖", tag: "Research"       },
  { id: "style-mirror",        name: "StyleMirror",         tagline: "Extract your voice. Rewrite anything in it.",   path: "/style-mirror",        icon: "✍️", tag: "Writing"       },
  { id: "sprint-mind",         name: "SprintMind",          tagline: "PRD + JIRA hierarchy from one sentence",         path: "/sprint-mind",         icon: "🚀", tag: "Product"        },
  { id: "contract-scan",       name: "ContractScan",        tagline: "Know what you're signing before you sign it",    path: "/contract-scan",       icon: "📋", tag: "Legal"          },
  { id: "skinstack",           name: "SkinStack",           tagline: "Your skin, your stack, no guesswork",            path: "/skinstack",           icon: "✨", tag: "Personal"       },
  { id: "story-bible",         name: "StoryBibleBuilder",   tagline: "Five sacred steps. One complete world.",         path: "/story-bible",         icon: "📜", tag: "Writing"        },
  { id: "pm-studio",           name: "PM Studio",           tagline: "17 tools for every PM workflow",                 path: "/pm-studio",           icon: "⚡", tag: "Product"        },
  { id: "signal-post",         name: "SignalPost",          tagline: "Your work already happened. Now let it work.",   path: "/signal-post",         icon: "✦", tag: "Content"        },
];

const TAG_COLORS = {
  "Study":         { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  "Communication": { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
  "Thinking":      { bg: "#FDF4FF", color: "#9333EA", border: "#E9D5FF" },
  "Personal":      { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" },
  "Research":      { bg: "#F0FDFA", color: "#0D9488", border: "#99F6E4" },
  "Writing":       { bg: "#FAF5FF", color: "#7C3AED", border: "#DDD6FE" },
  "Product":       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "Legal":         { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  "Content":       { bg: "#FFF8E8", color: "#B45309", border: "#FDE68A" },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:       #F8F9FC;
    --surface:  #FFFFFF;
    --rule:     #E2E6F0;
    --ink:      #0F172A;
    --ink-mid:  #475569;
    --ink-dim:  #94A3B8;
    --amber:    #F5A623;
    --blue:     #2563EB;
    --blue-pale:#EFF6FF;
    --green:    #16A34A;
    --font:     'Instrument Sans', sans-serif;
    --mono:     'Fira Code', monospace;
  }
  html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font); }
  @keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .home { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── NAV ── */
  .nav {
    background: var(--surface); border-bottom: 2px solid var(--amber);
    padding: 0.85rem 2rem; display: flex; align-items: center;
    justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    position: sticky; top: 0; z-index: 100;
  }
  .nav-brand { display: flex; align-items: baseline; gap: 0.5rem; }
  .nav-name  { font-size: 1.15rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
  .nav-name span { color: var(--amber); }
  .nav-tag   { font-family: var(--mono); font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); }
  .nav-right { display: flex; align-items: center; gap: 0.75rem; }

  /* Key status pill */
  .key-pill {
    display: flex; align-items: center; gap: 0.4rem;
    font-family: var(--mono); font-size: 0.52rem; letter-spacing: 0.06em;
    padding: 0.28rem 0.75rem; border-radius: 100px;
    border: 1px solid var(--rule); cursor: pointer; transition: all 0.15s;
    color: var(--ink-dim); background: var(--surface);
  }
  .key-pill:hover { border-color: var(--amber); color: var(--amber); }
  .key-pill.active { border-color: rgba(22,163,74,0.4); color: var(--green); background: rgba(22,163,74,0.06); }
  .key-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  /* Key setup modal */
  .key-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px); z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .key-modal {
    background: var(--surface); border: 1px solid var(--rule);
    border-radius: 16px; padding: 2rem; width: 100%; max-width: 400px;
    box-shadow: 0 8px 48px rgba(0,0,0,0.12);
    animation: riseIn 0.3s ease;
  }
  .km-title { font-size: 1.3rem; font-weight: 700; color: var(--ink); margin-bottom: 0.25rem; }
  .km-sub   { font-size: 0.8rem; color: var(--ink-mid); line-height: 1.6; margin-bottom: 1.25rem; }
  .km-sub a { color: var(--amber); text-decoration: none; }
  .km-input {
    width: 100%; padding: 0.75rem 1rem; background: var(--bg);
    border: 1.5px solid var(--rule); border-radius: 8px;
    font-family: var(--mono); font-size: 0.82rem; color: var(--ink);
    outline: none; margin-bottom: 0.75rem; transition: border-color 0.2s;
  }
  .km-input:focus { border-color: var(--amber); }
  .km-input::placeholder { color: var(--ink-dim); font-style: italic; }
  .km-actions { display: flex; gap: 0.6rem; }
  .km-btn {
    flex: 1; padding: 0.7rem; background: var(--amber); color: #000;
    border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem;
    cursor: pointer; transition: all 0.15s;
  }
  .km-btn:hover:not(:disabled) { filter: brightness(1.08); }
  .km-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .km-btn-ghost {
    padding: 0.7rem 1rem; background: none; border: 1px solid var(--rule);
    border-radius: 8px; font-size: 0.85rem; color: var(--ink-mid);
    cursor: pointer; transition: all 0.15s;
  }
  .km-btn-ghost:hover { border-color: var(--ink-mid); color: var(--ink); }
  .km-error { font-size: 0.75rem; color: #EF4444; margin-bottom: 0.5rem; }

  /* ── HERO ── */
  .hero { padding: 4rem 2rem 2.5rem; max-width: 900px; margin: 0 auto; width: 100%; animation: fadeIn 0.5s ease; }
  .hero-eyebrow { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.85rem; }
  .hero-title { font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; color: var(--ink); letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 1rem; }
  .hero-title span { color: var(--amber); }
  .hero-sub { font-size: 1rem; color: var(--ink-mid); line-height: 1.65; max-width: 560px; margin-bottom: 2rem; }
  .hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; }
  .stat { display: flex; flex-direction: column; gap: 0.15rem; }
  .stat-num   { font-size: 1.5rem; font-weight: 700; color: var(--amber); line-height: 1; }
  .stat-label { font-family: var(--mono); font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); }

  /* ── FILTER ── */
  .filter-row { padding: 0 2rem 1.5rem; max-width: 900px; margin: 0 auto; width: 100%; display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .filter-chip {
    padding: 0.3rem 0.85rem; border: 1.5px solid var(--rule); border-radius: 100px;
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.05em;
    cursor: pointer; color: var(--ink-dim); background: var(--surface);
    transition: all 0.15s; user-select: none;
  }
  .filter-chip:hover { border-color: var(--amber); color: var(--amber); }
  .filter-chip.on { background: var(--amber); border-color: var(--amber); color: #000; }

  /* ── APP GRID ── */
  .app-grid {
    padding: 0 2rem 4rem; max-width: 900px; margin: 0 auto; width: 100%;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(265px, 1fr)); gap: 1rem;
  }
  .app-card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
    padding: 1.5rem; cursor: pointer; transition: all 0.2s;
    text-decoration: none; color: inherit; display: flex; flex-direction: column;
    gap: 0.85rem; animation: riseIn 0.4s ease both;
    box-shadow: 0 1px 4px rgba(15,23,42,0.04);
  }
  .app-card:hover {
    border-color: var(--amber); transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(245,166,35,0.12);
  }
  .app-card-top { display: flex; align-items: center; justify-content: space-between; }
  .app-icon { font-size: 1.75rem; line-height: 1; }
  .app-tag {
    font-family: var(--mono); font-size: 0.52rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.2rem 0.55rem; border-radius: 100px; border: 1px solid;
  }
  .app-name    { font-size: 1rem; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
  .app-tagline { font-size: 0.8rem; color: var(--ink-mid); line-height: 1.5; flex: 1; }
  .app-arrow {
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--amber); margin-top: auto;
    opacity: 0; transition: opacity 0.15s;
  }
  .app-card:hover .app-arrow { opacity: 1; }

  /* ── FOOTER ── */
  .home-footer {
    margin-top: auto; border-top: 1px solid var(--rule);
    padding: 1rem 2rem; display: flex; align-items: center;
    justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    background: var(--surface);
  }
  .home-footer-left  { font-family: var(--mono); font-size: 0.52rem; letter-spacing: 0.08em; color: var(--ink-dim); }
  .home-footer-left strong { color: var(--amber); }
  .home-footer-right { font-family: var(--mono); font-size: 0.52rem; letter-spacing: 0.08em; color: var(--ink-dim); }

  @media (max-width: 600px) {
    .hero { padding: 2.5rem 1.25rem 2rem; }
    .filter-row, .app-grid { padding-left: 1.25rem; padding-right: 1.25rem; }
    .hero-stats { gap: 1.25rem; }
    .nav { padding: 0.75rem 1.25rem; }
  }
`;

// ── Key setup modal (lightweight, home-specific) ───────────────────────────
function KeyModal({ onClose, onSaved }) {
  const [val, setVal]   = useState("");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const k = val.trim();
    if (!k) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${k}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
        }
      );
      if (res.status === 401 || res.status === 403) throw new Error("Invalid key — check aistudio.google.com/apikey");
      localStorage.setItem("jl-gemini-key", k);
      onSaved(k);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="key-modal-overlay" onClick={onClose}>
      <div className="key-modal" onClick={e => e.stopPropagation()}>
        <div className="km-title">Your Gemini API Key</div>
        <div className="km-sub">
          One key unlocks all 14 apps. Get yours free at{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/apikey
          </a>. Stored locally, never sent to our servers.
        </div>
        {err && <div className="km-error">{err}</div>}
        <input
          className="km-input" type="password" placeholder="AIza…"
          value={val} onChange={e => { setVal(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && !busy && save()}
          autoFocus autoComplete="off"
        />
        <div className="km-actions">
          <button className="km-btn" onClick={save} disabled={busy || !val.trim()}>
            {busy ? "Verifying…" : "Save & unlock →"}
          </button>
          <button className="km-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTag,  setActiveTag]  = useState("All");
  const [apiKey,     setApiKey]     = useState(() => {
    try { return localStorage.getItem("jl-gemini-key") || null; } catch { return null; }
  });
  const [showKeyModal, setShowKeyModal] = useState(false);

  const tags     = ["All", ...Array.from(new Set(APPS.map(a => a.tag)))];
  const filtered = activeTag === "All" ? APPS : APPS.filter(a => a.tag === activeTag);

  function handleKeySaved(k) { setApiKey(k); setShowKeyModal(false); }
  function handleRemoveKey() {
    try { localStorage.removeItem("jl-gemini-key"); } catch {}
    setApiKey(null);
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="home">
        {/* NAV */}
        <nav className="nav">
          <div className="nav-brand">
            <span className="nav-name">Janardhan <span>Labs</span></span>
            <span className="nav-tag">AI Utility Apps</span>
          </div>
          <div className="nav-right">
            {apiKey ? (
              <>
                <button
                  className="key-pill active"
                  onClick={() => setShowKeyModal(true)}
                  title="Click to manage key"
                >
                  <span className="key-dot" />
                  Key active
                </button>
                <button className="key-pill" onClick={handleRemoveKey} style={{ fontSize: "0.48rem" }}>
                  Remove
                </button>
              </>
            ) : (
              <button className="key-pill" onClick={() => setShowKeyModal(true)}>
                <span className="key-dot" style={{ background: "#94A3B8" }} />
                Add API key
              </button>
            )}
          </div>
        </nav>

        {/* HERO */}
        <div className="hero">
          <div className="hero-eyebrow">// Janardhan Labs v2 · BYOK Edition</div>
          <h1 className="hero-title">AI tools built with<br /><span>intent.</span></h1>
          <p className="hero-sub">
            14 production-grade AI utility apps — each solving a real problem,
            each designed for the person who actually has that problem.
            Your key, your usage, your privacy. Built by Sriharsha.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="stat-num">14</span><span className="stat-label">Apps</span></div>
            <div className="stat"><span className="stat-num">8</span><span className="stat-label">Categories</span></div>
            <div className="stat"><span className="stat-num">1</span><span className="stat-label">API key</span></div>
            <div className="stat"><span className="stat-num">0</span><span className="stat-label">Servers</span></div>
          </div>
        </div>

        {/* FILTER */}
        <div className="filter-row">
          {tags.map(t => (
            <button
              key={t}
              className={`filter-chip ${activeTag === t ? "on" : ""}`}
              onClick={() => setActiveTag(t)}
            >{t}</button>
          ))}
        </div>

        {/* APP GRID */}
        <div className="app-grid">
          {filtered.map((app, i) => {
            const tc = TAG_COLORS[app.tag] || { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
            return (
              <div
                key={app.id}
                className="app-card"
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => navigate(app.path)}
              >
                <div className="app-card-top">
                  <span className="app-icon">{app.icon}</span>
                  <span className="app-tag" style={{ background: tc.bg, color: tc.color, borderColor: tc.border }}>
                    {app.tag}
                  </span>
                </div>
                <div className="app-name">{app.name}</div>
                <div className="app-tagline">{app.tagline}</div>
                <div className="app-arrow">Open app →</div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <footer className="home-footer">
          <div className="home-footer-left">Made with intent by <strong>Sriharsha</strong></div>
          <div className="home-footer-right">Janardhan Labs © 2026</div>
        </footer>
      </div>

      {showKeyModal && (
        <KeyModal onClose={() => setShowKeyModal(false)} onSaved={handleKeySaved} />
      )}
    </>
  );
}
