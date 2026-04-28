/**
 * Janardhan Labs — KeyGate
 * Themed per-app API key setup. Replaces AuthWrapper entirely.
 *
 * Usage:
 *   import { useApiKey, KeyGateBanner } from "../../shared/components/KeyGate";
 *
 *   function MyApp() {
 *     const { apiKey, isKeySet, KeyBanner } = useApiKey("gift-intelligence");
 *     if (!isKeySet) return <KeyBanner />;
 *     return <TheRealApp apiKey={apiKey} />;
 *   }
 *
 * The hook reads the shared "jl-gemini-key" from localStorage.
 * Setting the key here makes it available instantly to all other apps.
 */

import { useState, useEffect } from "react";
import { getApiKey, saveApiKey, clearApiKey } from "../lib/gemini-client";
import { APP_THEMES, DEFAULT_THEME, hexToRgba } from "../lib/themes";

// ── Style builder — uses per-app theme ────────────────────────────────────
function buildStyles(t) {
  const glow = hexToRgba(t.accent, 0.08);
  const glowStrong = hexToRgba(t.accent, 0.18);
  const btnText = t.dark ? "#000" : "#fff";

  return `
    @import url('https://fonts.googleapis.com/css2?family=${t.gfont}&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:          ${t.bg};
      --surface:     ${t.surface};
      --accent:      ${t.accent};
      --accent-pale: ${t.accentPale};
      --accent-text: ${t.accentText};
      --rule:        ${t.rule};
      --ink:         ${t.ink};
      --ink-mid:     ${t.inkMid};
      --font-head:   ${t.fontHead};
      --font-mono:   ${t.fontMono};
    }
    html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font-head); }

    .kg-wrap {
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: var(--bg); padding: 1.5rem; position: relative; overflow: hidden;
    }
    /* Ambient orbs */
    .kg-wrap::before {
      content: ''; position: fixed; top: -180px; right: -180px;
      width: 560px; height: 560px; border-radius: 50%;
      background: radial-gradient(circle, ${glow} 0%, transparent 65%);
      pointer-events: none;
    }
    .kg-wrap::after {
      content: ''; position: fixed; bottom: -140px; left: -140px;
      width: 420px; height: 420px; border-radius: 50%;
      background: radial-gradient(circle, ${hexToRgba(t.accent, 0.05)} 0%, transparent 65%);
      pointer-events: none;
    }

    .kg-card {
      background: var(--surface); border: 1px solid var(--rule);
      border-radius: 20px; padding: 2.75rem 2.25rem;
      width: 100%; max-width: 440px; position: relative; z-index: 1;
      box-shadow: 0 8px 48px ${hexToRgba(t.accent, t.dark ? 0.06 : 0.04)};
      animation: kgRise 0.4s ease;
    }
    @keyframes kgRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes kgSpin { to { transform: rotate(360deg); } }

    .kg-orb {
      font-size: 2.75rem; text-align: center; display: block;
      margin-bottom: 1.25rem; line-height: 1;
      animation: kgRise 0.5s ease 0.1s both;
    }
    .kg-eyebrow {
      font-family: var(--font-mono); font-size: 0.52rem;
      letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--accent); text-align: center; margin-bottom: 0.3rem;
    }
    .kg-appname {
      font-size: 1.85rem; font-weight: 700; color: var(--ink);
      text-align: center; line-height: 1.1; letter-spacing: -0.02em;
      margin-bottom: 0.3rem;
    }
    .kg-tagline {
      font-size: 0.82rem; color: var(--ink-mid); text-align: center;
      font-style: italic; margin-bottom: 0.5rem; line-height: 1.5;
    }

    /* Divider */
    .kg-divider {
      height: 1px; background: var(--rule); margin: 1.5rem 0;
    }

    /* Key prompt section */
    .kg-prompt {
      font-family: var(--font-mono); font-size: 0.6rem;
      letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--accent); display: block; margin-bottom: 0.5rem;
    }
    .kg-desc {
      font-size: 0.82rem; color: var(--ink-mid); line-height: 1.65;
      margin-bottom: 1.25rem;
    }
    .kg-desc a {
      color: var(--accent); text-decoration: none; border-bottom: 1px solid ${hexToRgba(t.accent, 0.3)};
      transition: border-color 0.15s;
    }
    .kg-desc a:hover { border-color: var(--accent); }

    .kg-input-wrap { position: relative; margin-bottom: 1rem; }
    .kg-input {
      width: 100%; padding: 0.85rem 3rem 0.85rem 1rem;
      background: var(--accent-pale); border: 1.5px solid var(--rule);
      border-radius: 10px; font-family: var(--font-mono); font-size: 0.85rem;
      color: var(--ink); outline: none; transition: border-color 0.2s, box-shadow 0.2s;
      letter-spacing: 0.04em;
    }
    .kg-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px ${hexToRgba(t.accent, 0.12)};
    }
    .kg-input::placeholder { color: var(--ink-mid); font-style: italic; letter-spacing: 0; }
    .kg-toggle {
      position: absolute; right: 0.85rem; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--ink-mid);
      font-size: 0.9rem; padding: 0.2rem; transition: color 0.15s;
    }
    .kg-toggle:hover { color: var(--accent); }

    .kg-btn {
      width: 100%; padding: 0.9rem;
      background: var(--accent); color: ${btnText};
      border: none; border-radius: 100px;
      font-family: var(--font-head); font-size: 1rem; font-weight: 700;
      cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em;
      box-shadow: 0 2px 16px ${hexToRgba(t.accent, 0.28)};
    }
    .kg-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 24px ${hexToRgba(t.accent, 0.4)};
      filter: brightness(1.06);
    }
    .kg-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

    .kg-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid ${t.dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.3)"};
      border-top-color: ${t.dark ? "rgba(0,0,0,0.8)" : "white"};
      animation: kgSpin 0.7s linear infinite;
      display: inline-block; margin-right: 0.5rem; vertical-align: middle;
    }

    .kg-error {
      background: ${t.dark ? "rgba(239,68,68,0.1)" : "#FEF2F2"};
      border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
      padding: 0.75rem 1rem; font-size: 0.8rem; color: #EF4444;
      margin-bottom: 1rem; line-height: 1.5;
    }

    .kg-footer {
      margin-top: 1.5rem; text-align: center;
      font-family: var(--font-mono); font-size: 0.5rem;
      letter-spacing: 0.1em; color: var(--ink-mid);
    }
    .kg-footer strong { color: var(--accent); }

    /* Key already set — compact banner shown at top of app */
    .kg-banner {
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.75rem; padding: 0.4rem 1.5rem;
      background: var(--surface); border-bottom: 1px solid var(--rule);
      font-family: var(--font-mono); font-size: 0.5rem;
      letter-spacing: 0.07em; color: var(--ink-mid);
    }
    .kg-banner-key { color: var(--accent); font-weight: 600; }
    .kg-banner-right { display: flex; gap: 0.5rem; align-items: center; }
    .kg-banner-btn {
      background: none; border: 1px solid var(--rule); border-radius: 100px;
      font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--ink-mid); padding: 0.18rem 0.55rem;
      cursor: pointer; transition: all 0.15s;
    }
    .kg-banner-btn:hover { border-color: var(--accent); color: var(--accent); }
    .kg-banner-btn.danger:hover { border-color: #EF4444; color: #EF4444; }
  `;
}

// ── KeyGate screen — shown when no key is set ─────────────────────────────
function KeyGateScreen({ appId, onKeySet }) {
  const theme = APP_THEMES[appId] || DEFAULT_THEME;
  const [keyInput, setKeyInput]   = useState("");
  const [showKey, setShowKey]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSave() {
    const k = keyInput.trim();
    if (!k || !k.startsWith("AIza")) {
      setError("That doesn't look like a valid Gemini key. Keys start with 'AIza'.");
      return;
    }
    setLoading(true); setError("");
    // Quick validation — ping Gemini with 1 token
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${k}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "hi" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }
      );
      if (res.status === 401 || res.status === 403) {
        throw new Error("Invalid key — check it at aistudio.google.com/apikey");
      }
      if (!res.ok && res.status !== 429) {
        // 429 = rate limit but key is valid
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || "Could not verify key");
      }
      saveApiKey(k);
      onKeySet(k);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{buildStyles(theme)}</style>
      <div className="kg-wrap">
        <div className="kg-card">
          <span className="kg-orb">{theme.orb}</span>
          <div className="kg-eyebrow">Janardhan Labs</div>
          <div className="kg-appname">{theme.name}</div>
          <div className="kg-tagline">{theme.tagline}</div>
          <div className="kg-divider" />

          <span className="kg-prompt">Your Gemini API Key</span>
          <p className="kg-desc">
            This app runs on your own key — your usage, your quota, fully private.
            Get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com/apikey
            </a>
            . One key unlocks all 14 Janardhan Labs apps.
          </p>

          {error && <div className="kg-error">{error}</div>}

          <div className="kg-input-wrap">
            <input
              className="kg-input"
              type={showKey ? "text" : "password"}
              placeholder="AIza…"
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && !loading && keyInput.trim() && handleSave()}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <button className="kg-toggle" onClick={() => setShowKey(s => !s)} tabIndex={-1}>
              {showKey ? "🙈" : "👁"}
            </button>
          </div>

          <button className="kg-btn" onClick={handleSave} disabled={loading || !keyInput.trim()}>
            {loading ? <><span className="kg-spinner" />Verifying…</> : `Unlock ${theme.name} →`}
          </button>

          <div className="kg-footer">
            Key stored locally in your browser · Never sent to our servers<br />
            Part of <strong>Janardhan Labs</strong> · Built by Sriharsha
          </div>
        </div>
      </div>
    </>
  );
}

// ── KeyBanner — compact bar shown at top of app once key is set ───────────
function KeyBanner({ appId, apiKey, onRevoke }) {
  const theme  = APP_THEMES[appId] || DEFAULT_THEME;
  const masked = apiKey ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : "";
  return (
    <>
      <style>{buildStyles(theme)}</style>
      <div className="kg-banner">
        <span>
          <span className="kg-banner-key">✓ Gemini key active</span>
          {" "}· {masked}
        </span>
        <div className="kg-banner-right">
          <button className="kg-banner-btn danger" onClick={onRevoke}>Remove key</button>
        </div>
      </div>
    </>
  );
}

// ── useApiKey hook ─────────────────────────────────────────────────────────
export function useApiKey(appId) {
  const [apiKey, setApiKey] = useState(() => getApiKey());

  const handleKeySet = (k) => setApiKey(k);

  const handleRevoke = () => {
    clearApiKey();
    setApiKey(null);
  };

  const isKeySet = !!apiKey;

  // KeyGate: full screen shown when no key
  const KeyGate = () => (
    <KeyGateScreen appId={appId} onKeySet={handleKeySet} />
  );

  // Banner: compact bar shown at top of app
  const Banner = () => (
    <KeyBanner appId={appId} apiKey={apiKey} onRevoke={handleRevoke} />
  );

  return { apiKey, isKeySet, KeyGate, Banner };
}

// ── Default export for simple usage ───────────────────────────────────────
export default useApiKey;
