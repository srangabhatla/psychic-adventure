/**
 * Janardhan Labs — KeyGate v3
 * 3-key setup per app. Live validation. Status dots. Cooling countdown.
 */
import { useState, useEffect, useCallback } from "react";
import { saveAppKeys, getAppKeys, getKeyStatuses, getCooldownRemaining, setAppContext, saveApiKey } from "../lib/gemini-client";
import { APP_THEMES, DEFAULT_THEME, hexToRgba } from "../lib/themes";

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

async function validateKey(k) {
  if (!k || !k.startsWith("AIza")) return false;
  try {
    const res = await fetch(MODEL_URL + "?key=" + k, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
    });
    return res.status !== 401 && res.status !== 403;
  } catch { return false; }
}

function buildStyles(t) {
  const glow = hexToRgba(t.accent, 0.08);
  const btnText = t.dark ? "#000" : "#fff";
  return `
    @import url('https://fonts.googleapis.com/css2?family=${t.gfont}&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: ${t.bg}; --surface: ${t.surface}; --accent: ${t.accent};
      --accent-pale: ${t.accentPale}; --rule: ${t.rule};
      --ink: ${t.ink}; --ink-mid: ${t.inkMid};
      --font-head: ${t.fontHead}; --font-mono: ${t.fontMono};
    }
    html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font-head); }
    .kg-wrap {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg); padding: 1.5rem; position: relative; overflow: hidden;
    }
    .kg-wrap::before {
      content: ''; position: fixed; top: -180px; right: -180px;
      width: 560px; height: 560px; border-radius: 50%;
      background: radial-gradient(circle, ${glow} 0%, transparent 65%); pointer-events: none;
    }
    .kg-card {
      background: var(--surface); border: 1px solid var(--rule); border-radius: 20px;
      padding: 2.5rem 2.25rem; width: 100%; max-width: 460px; position: relative; z-index: 1;
      box-shadow: 0 8px 48px ${hexToRgba(t.accent, t.dark ? 0.06 : 0.04)};
      animation: kgRise 0.4s ease;
    }
    @keyframes kgRise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes kgSpin  { to { transform: rotate(360deg); } }
    .kg-orb { font-size: 2.5rem; text-align: center; display: block; margin-bottom: 1rem; }
    .kg-eyebrow { font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); text-align: center; margin-bottom: 0.3rem; }
    .kg-appname { font-size: 1.75rem; font-weight: 700; color: var(--ink); text-align: center; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
    .kg-tagline { font-size: 0.8rem; color: var(--ink-mid); text-align: center; font-style: italic; margin-bottom: 0.5rem; line-height: 1.5; }
    .kg-divider { height: 1px; background: var(--rule); margin: 1.25rem 0; }
    .kg-section-label { font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); display: block; margin-bottom: 0.6rem; }
    .kg-hint { font-size: 0.76rem; color: var(--ink-mid); line-height: 1.6; margin-bottom: 1rem; }
    .kg-hint a { color: var(--accent); text-decoration: none; border-bottom: 1px solid ${hexToRgba(t.accent, 0.3)}; }
    .kg-hint strong { color: var(--ink); }

    /* Key slots */
    .kg-slots { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.25rem; }
    .kg-slot { display: flex; align-items: center; gap: 0.5rem; }
    .kg-slot-num { font-family: var(--font-mono); font-size: 0.52rem; color: var(--ink-mid); width: 14px; flex-shrink: 0; }
    .kg-slot-input-wrap { flex: 1; position: relative; }
    .kg-slot-input {
      width: 100%; padding: 0.65rem 2.5rem 0.65rem 0.85rem;
      background: var(--accent-pale); border: 1.5px solid var(--rule);
      border-radius: 8px; font-family: var(--font-mono); font-size: 0.78rem;
      color: var(--ink); outline: none; transition: border-color 0.2s;
    }
    .kg-slot-input:focus { border-color: var(--accent); }
    .kg-slot-input.valid   { border-color: #22c55e; }
    .kg-slot-input.invalid { border-color: #ef4444; }
    .kg-slot-input::placeholder { color: var(--ink-mid); font-style: italic; letter-spacing: 0; }
    .kg-slot-eye {
      position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--ink-mid); font-size: 0.85rem;
    }
    .kg-slot-status { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .kg-slot-status.empty   { background: var(--rule); }
    .kg-slot-status.validating { background: #f59e0b; animation: kgPulse 1s infinite; }
    .kg-slot-status.valid   { background: #22c55e; }
    .kg-slot-status.invalid { background: #ef4444; }
    @keyframes kgPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

    .kg-error { background: ${t.dark ? "rgba(239,68,68,0.1)" : "#FEF2F2"}; border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 0.65rem 1rem; font-size: 0.78rem; color: #ef4444; margin-bottom: 1rem; line-height: 1.5; }
    .kg-btn {
      width: 100%; padding: 0.85rem; background: var(--accent); color: ${btnText};
      border: none; border-radius: 100px; font-family: var(--font-head); font-size: 1rem;
      font-weight: 700; cursor: pointer; transition: all 0.2s;
      box-shadow: 0 2px 16px ${hexToRgba(t.accent, 0.28)};
    }
    .kg-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
    .kg-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    .kg-spinner { width:14px; height:14px; border-radius:50%; border:2px solid ${t.dark?"rgba(0,0,0,0.25)":"rgba(255,255,255,0.3)"}; border-top-color:${t.dark?"rgba(0,0,0,0.8)":"white"}; animation:kgSpin 0.7s linear infinite; display:inline-block; margin-right:0.4rem; vertical-align:middle; }
    .kg-footer { margin-top: 1.25rem; text-align: center; font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.1em; color: var(--ink-mid); }
    .kg-footer strong { color: var(--accent); }

    /* Banner */
    .kg-banner { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.4rem 1.5rem; background:var(--surface); border-bottom:1px solid var(--rule); font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.07em; color:var(--ink-mid); }
    .kg-banner-left { display:flex; align-items:center; gap:0.6rem; }
    .kg-banner-label { color:var(--accent); font-weight:600; }
    .kg-banner-dots { display:flex; gap:4px; align-items:center; }
    .kg-banner-dot { width:7px; height:7px; border-radius:50%; }
    .kg-banner-dot.ready   { background:#22c55e; }
    .kg-banner-dot.cooling { background:#f59e0b; }
    .kg-banner-dot.invalid { background:#ef4444; }
    .kg-banner-dot.empty   { background:var(--rule); }
    .kg-banner-right { display:flex; gap:0.5rem; align-items:center; }
    .kg-banner-btn { background:none; border:1px solid var(--rule); border-radius:100px; font-family:var(--font-mono); font-size:0.46rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-mid); padding:0.18rem 0.55rem; cursor:pointer; transition:all 0.15s; }
    .kg-banner-btn:hover { border-color:var(--accent); color:var(--accent); }
    .kg-banner-countdown { color:#f59e0b; }

    /* Cooldown overlay */
    .kg-cooldown {
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
      background:var(--surface); border:1px solid #f59e0b;
      border-radius:12px; padding:1rem 1.25rem; max-width:280px;
      font-family:var(--font-mono); font-size:0.6rem; line-height:1.7;
      box-shadow:0 4px 24px rgba(0,0,0,0.2);
      animation:kgRise 0.3s ease;
    }
    .kg-cooldown-title { color:#f59e0b; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:0.25rem; }
    .kg-cooldown-timer { font-size:1.4rem; font-weight:700; color:var(--ink); }
    .kg-cooldown-sub { color:var(--ink-mid); margin-top:0.25rem; }
  `;
}

// ── Cooldown overlay — shown when all keys are cooling ────────────────────
export function CooldownOverlay({ appId, onReady }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    function tick() {
      const remaining = getCooldownRemaining(appId);
      const max = Math.max(...remaining);
      setSecs(max);
      if (max <= 0 && onReady) onReady();
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appId, onReady]);

  if (secs <= 0) return null;

  return (
    <div className="kg-cooldown">
      <div className="kg-cooldown-title">⏳ Rate limit — auto-retrying</div>
      <div className="kg-cooldown-timer">{secs}s</div>
      <div className="kg-cooldown-sub">All keys cooling. Will retry automatically.</div>
    </div>
  );
}

// ── KeyGate full screen ────────────────────────────────────────────────────
function KeyGateScreen({ appId, onKeySet }) {
  const theme = APP_THEMES[appId] || DEFAULT_THEME;
  const [inputs, setInputs]   = useState(["", "", ""]);
  const [show,   setShow]     = useState([false, false, false]);
  const [status, setStatus]   = useState(["empty", "empty", "empty"]);
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState("");

  // Pre-fill from existing state
  useEffect(() => {
    const s = getAppKeys(appId);
    if (s && s.keys) {
      setInputs(s.keys.map(k => k || ""));
      setStatus(s.keys.map((k, i) => {
        if (!k) return "empty";
        return s.valid && s.valid[i] ? "valid" : "empty";
      }));
    }
  }, [appId]);

  async function handleKeyChange(i, val) {
    const newInputs = [...inputs];
    newInputs[i] = val;
    setInputs(newInputs);
    const newStatus = [...status];
    if (!val) { newStatus[i] = "empty"; setStatus(newStatus); return; }
    if (!val.startsWith("AIza")) { newStatus[i] = "invalid"; setStatus(newStatus); return; }
    newStatus[i] = "validating"; setStatus(newStatus);
    const ok = await validateKey(val);
    const updated = [...status];
    updated[i] = ok ? "valid" : "invalid";
    setStatus(updated);
  }

  async function handleSave() {
    const filled = inputs.filter(k => k.trim());
    if (!filled.length) { setError("Add at least one key."); return; }
    const validKeys = inputs.filter((k, i) => k && status[i] === "valid");
    if (!validKeys.length) { setError("No valid keys found. Check your keys at aistudio.google.com/apikey"); return; }
    setSaving(true);
    const valid = inputs.map((k, i) => k ? status[i] === "valid" : false);
    saveAppKeys(appId, inputs, valid);
    setAppContext(appId);
    onKeySet(validKeys[0]);
    setSaving(false);
  }

  const hasAtLeastOneValid = status.some((s, i) => s === "valid" && inputs[i]);

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

          <span className="kg-section-label">Gemini API Keys (up to 3)</span>
          <p className="kg-hint">
            Get free keys at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>.{" "}
            <strong>Use keys from different Google accounts</strong> for independent quotas and uninterrupted output.
          </p>

          {error && <div className="kg-error">{error}</div>}

          <div className="kg-slots">
            {[0, 1, 2].map(i => (
              <div key={i} className="kg-slot">
                <span className="kg-slot-num">{i + 1}</span>
                <div className="kg-slot-input-wrap">
                  <input
                    className={"kg-slot-input " + (status[i] === "valid" ? "valid" : status[i] === "invalid" ? "invalid" : "")}
                    type={show[i] ? "text" : "password"}
                    placeholder={i === 0 ? "AIza… (required)" : "AIza… (optional but recommended)"}
                    value={inputs[i]}
                    onChange={e => handleKeyChange(i, e.target.value)}
                    autoFocus={i === 0}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="kg-slot-eye" onClick={() => { const n=[...show]; n[i]=!n[i]; setShow(n); }} tabIndex={-1}>
                    {show[i] ? "🙈" : "👁"}
                  </button>
                </div>
                <div className={"kg-slot-status " + status[i]} title={status[i]} />
              </div>
            ))}
          </div>

          <button className="kg-btn" onClick={handleSave} disabled={saving || !hasAtLeastOneValid}>
            {saving ? <><span className="kg-spinner" />Saving…</> : `Unlock ${theme.name} →`}
          </button>

          <div className="kg-footer">
            Keys stored locally · Never sent to servers · <strong>Janardhan Labs</strong>
          </div>
        </div>
      </div>
    </>
  );
}

// ── KeyBanner ─────────────────────────────────────────────────────────────
function KeyBanner({ appId, onRevoke, onManage }) {
  const theme    = APP_THEMES[appId] || DEFAULT_THEME;
  const statuses = getKeyStatuses(appId);
  const cooldowns = getCooldownRemaining(appId);
  const minCool  = Math.max(...cooldowns.filter(c => c > 0), 0);

  return (
    <>
      <style>{buildStyles(theme)}</style>
      <div className="kg-banner">
        <div className="kg-banner-left">
          <span className="kg-banner-label">✓ Keys active</span>
          <div className="kg-banner-dots">
            {statuses.map((s, i) => (
              <div key={i} className={"kg-banner-dot " + s} title={"Key " + (i+1) + ": " + s} />
            ))}
          </div>
          {minCool > 0 && <span className="kg-banner-countdown">⏳ {minCool}s</span>}
        </div>
        <div className="kg-banner-right">
          <button className="kg-banner-btn" onClick={onManage}>Manage keys</button>
          <button className="kg-banner-btn" onClick={onRevoke} style={{borderColor:"rgba(239,68,68,0.3)",color:"#ef4444"}}>Clear</button>
        </div>
      </div>
    </>
  );
}

// ── useApiKey hook ─────────────────────────────────────────────────────────
export function useApiKey(appId) {
  const [isKeySet, setIsKeySet] = useState(() => {
    const s = getAppKeys(appId);
    return !!(s && s.keys && s.keys.some((k, i) => k && s.valid && s.valid[i]));
  });
  const [showManage, setShowManage] = useState(false);
  const [cooldown,   setCooldown]   = useState(0);

  useEffect(() => {
    setAppContext(appId);
  }, [appId]);

  // Live cooldown ticker for banner
  useEffect(() => {
    if (!isKeySet) return;
    const id = setInterval(() => {
      const remaining = getCooldownRemaining(appId);
      setCooldown(Math.max(...remaining, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [appId, isKeySet]);

  function handleKeySet() { setIsKeySet(true); setShowManage(false); }
  function handleRevoke() {
    const s = getAppKeys(appId);
    if (s) { s.keys = ["","",""]; s.valid = [false,false,false]; saveAppKeys(appId, s.keys, s.valid); }
    setIsKeySet(false);
  }

  const apiKey = (() => {
    const s = getAppKeys(appId);
    if (!s) return null;
    const idx = s.keys.findIndex((k, i) => k && s.valid && s.valid[i]);
    return idx >= 0 ? s.keys[idx] : null;
  })();

  return {
    apiKey,
    isKeySet,
    showManage,
    cooldown,
    appId,
    handleKeySet,
    handleRevoke,
    setShowManage,
    setCooldown,
  };
}

export default useApiKey;

// ── Standalone components used by apps ────────────────────────────────────
export function AppKeyGate({ hook }) {
  return <KeyGateScreen appId={hook.appId} onKeySet={hook.handleKeySet} />;
}

export function AppBanner({ hook }) {
  return (
    <>
      <KeyBanner appId={hook.appId} onRevoke={hook.handleRevoke} onManage={() => hook.setShowManage(true)} />
      {hook.showManage && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}
          onClick={() => hook.setShowManage(false)}>
          <div onClick={e => e.stopPropagation()}>
            <KeyGateScreen appId={hook.appId} onKeySet={hook.handleKeySet} />
          </div>
        </div>
      )}
      {hook.cooldown > 0 && <CooldownOverlay appId={hook.appId} onReady={() => hook.setCooldown(0)} />}
    </>
  );
}
