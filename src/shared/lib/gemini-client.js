/**
 * Janardhan Labs — Gemini Client v3
 * 3-key rotation per app. Smart selection. Cooling tracker. Min-gap enforcement.
 */

const MODEL    = "gemini-2.0-flash-lite";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";
const TIMEOUT  = 55000;
const COOL_MS  = 65000; // 65s cooling after 429
const MIN_GAP  = 4500;  // min ms between reusing same key

// ── Global key storage key ─────────────────────────────────────────────────
const GLOBAL_KEY = "jl-gemini-key";

function stateKey(appId) { return "jl-ks-" + (appId || "global"); }

// ── Key state helpers ──────────────────────────────────────────────────────
function loadState(appId) {
  try {
    const raw = localStorage.getItem(stateKey(appId));
    if (raw) return JSON.parse(raw);
  } catch {}
  // Default: pull global key into slot 0
  const gk = localStorage.getItem(GLOBAL_KEY) || "";
  return { keys: [gk, "", ""], lastUsed: [0, 0, 0], coolingUntil: [0, 0, 0], valid: [!!gk, false, false] };
}

function saveState(appId, state) {
  try { localStorage.setItem(stateKey(appId), JSON.stringify(state)); } catch {}
}

// ── Pick best available key ────────────────────────────────────────────────
// Returns { key, index } or null if all cooling
function pickBestKey(appId) {
  const s = loadState(appId);
  const now = Date.now();

  // Clear stale cooling states
  s.coolingUntil = s.coolingUntil.map(t => (t && t < now) ? 0 : t);

  const candidates = s.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => k && s.valid[i] && !s.coolingUntil[i]);

  if (!candidates.length) return null;

  // Pick key idle longest — but enforce MIN_GAP
  candidates.sort((a, b) => (s.lastUsed[a.i] || 0) - (s.lastUsed[b.i] || 0));
  return { key: candidates[0].k, index: candidates[0].i, lastUsed: s.lastUsed[candidates[0].i] || 0 };
}

function markUsed(appId, index) {
  const s = loadState(appId);
  s.lastUsed[index] = Date.now();
  saveState(appId, s);
}

function markCooling(appId, index) {
  const s = loadState(appId);
  s.coolingUntil[index] = Date.now() + COOL_MS;
  saveState(appId, s);
}

// ── Earliest recovery time across all cooling keys ─────────────────────────
function earliestRecovery(appId) {
  const s = loadState(appId);
  const now = Date.now();
  const times = s.coolingUntil.filter(t => t > now);
  return times.length ? Math.min(...times) : 0;
}

// ── Export key management for KeyGate ─────────────────────────────────────
export function getApiKey() {
  try { return localStorage.getItem(GLOBAL_KEY) || null; } catch { return null; }
}
export function saveApiKey(k) {
  try { localStorage.setItem(GLOBAL_KEY, k.trim()); } catch {}
}
export function clearApiKey() {
  try { localStorage.removeItem(GLOBAL_KEY); } catch {}
}

export function getAppKeys(appId) {
  return loadState(appId);
}

export function saveAppKeys(appId, keys, valid) {
  const s = loadState(appId);
  s.keys  = keys;
  s.valid = valid;
  // Reset cooling/lastUsed for newly added keys
  keys.forEach((k, i) => {
    if (k && k !== s.keys[i]) {
      s.coolingUntil[i] = 0;
      s.lastUsed[i]     = 0;
    }
  });
  saveState(appId, s);
  // Persist first valid key as global fallback
  const first = keys.find((k, i) => k && valid[i]);
  if (first) saveApiKey(first);
}

export function getKeyStatuses(appId) {
  const s = loadState(appId);
  const now = Date.now();
  return s.keys.map((k, i) => {
    if (!k) return "empty";
    if (!s.valid[i]) return "invalid";
    if (s.coolingUntil[i] > now) return "cooling";
    return "ready";
  });
}

export function getCooldownRemaining(appId) {
  const s = loadState(appId);
  const now = Date.now();
  return s.coolingUntil.map(t => t > now ? Math.ceil((t - now) / 1000) : 0);
}

// ── Core fetch ─────────────────────────────────────────────────────────────
async function _fetch(contents, maxTokens, mimeType, appId, attempt) {
  attempt = attempt || 0;

  const best = pickBestKey(appId || "global");

  if (!best) {
    const rec = earliestRecovery(appId || "global");
    const secs = rec ? Math.ceil((rec - Date.now()) / 1000) : 60;
    throw new Error("__COOLDOWN__:" + secs);
  }

  // Enforce min gap
  const elapsed = Date.now() - best.lastUsed;
  if (best.lastUsed && elapsed < MIN_GAP) {
    await new Promise(r => setTimeout(r, MIN_GAP - elapsed));
  }

  markUsed(appId || "global", best.index);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(BASE_URL + "?key=" + best.key, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 1000,
          responseMimeType: mimeType || "application/json",
          temperature: 0.7,
        },
      }),
    });

    clearTimeout(timer);

    if (res.status === 429) {
      markCooling(appId || "global", best.index);
      // Retry immediately with next key
      return _fetch(contents, maxTokens, mimeType, appId, attempt + 1);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err && err.error && err.error.message) || ("Gemini error " + res.status);
      if (res.status === 401 || res.status === 403) {
        // Mark key invalid
        const s = loadState(appId || "global");
        s.valid[best.index] = false;
        saveState(appId || "global", s);
        throw new Error("Invalid API key — verify at aistudio.google.com/apikey");
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw  = (data.candidates &&
                  data.candidates[0] &&
                  data.candidates[0].content &&
                  data.candidates[0].content.parts &&
                  data.candidates[0].content.parts[0] &&
                  data.candidates[0].content.parts[0].text) || "";

    if (!raw) {
      const reason = (data.candidates && data.candidates[0] && data.candidates[0].finishReason) || "UNKNOWN";
      if (reason === "SAFETY")     throw new Error("Blocked by safety filters — rephrase input.");
      if (reason === "RECITATION") throw new Error("Blocked due to recitation — rephrase input.");
      throw new Error("Empty response (" + reason + ") — try again.");
    }

    return raw;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Request timed out — check connection.");
    throw e;
  }
}

// ── Input preprocessor ─────────────────────────────────────────────────────
function preprocessInput(text) {
  if (typeof text !== "string" || text.length < 100) return text;
  let clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const unique = sentences.filter(s => {
    const key = s.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  clean = unique.join(". ");
  if (clean.length > 3200) clean = clean.slice(0, 3200) + "...";
  return clean;
}

// ── Message normaliser ─────────────────────────────────────────────────────
function normalise(v) {
  if (Array.isArray(v)) {
    return v.map(msg => {
      const role = msg.role === "assistant" ? "model" : "user";
      if (typeof msg.content === "string") return { role, parts: [{ text: preprocessInput(msg.content) }] };
      if (msg.parts) return { role, parts: msg.parts };
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map(b => {
          if (b.type === "text")     return { text: preprocessInput(b.text) };
          if (b.type === "image")    return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
          if (b.type === "document") return { inlineData: { mimeType: "application/pdf", data: b.source.data } };
          return { text: b.text || "" };
        });
        return { role, parts };
      }
      return { role, parts: [{ text: preprocessInput(String(msg.content || "")) }] };
    });
  }
  return [{ role: "user", parts: [{ text: preprocessInput(String(v)) }] }];
}

function resolveArgs(a, b, c) {
  if (c !== undefined) {
    return { contents: [{ role: "user", parts: [{ text: preprocessInput(a + "\n\n" + b) }] }], maxTokens: c };
  }
  return { contents: normalise(a), maxTokens: b };
}

function parseJSON(raw) {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(clean); } catch {
    const obj = clean.match(/\{[\s\S]*\}/);
    const arr = clean.match(/\[[\s\S]*\]/);
    const m = (obj && arr) ? (clean.indexOf("{") < clean.indexOf("[") ? obj : arr) : (obj || arr);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error("Could not parse response — try again.");
  }
}

// ── App-ID context for all apps ────────────────────────────────────────────
// Each app passes its appId so key rotation is per-app
let _currentAppId = "global";
export function setAppContext(appId) { _currentAppId = appId; }

export async function callGemini(a, b, c) {
  const args = resolveArgs(a, b, c);
  const raw = await _fetch(args.contents, args.maxTokens, "application/json", _currentAppId);
  return parseJSON(raw);
}

export async function callGeminiRaw(a, b, c) {
  const args = resolveArgs(a, b, c);
  return _fetch(args.contents, args.maxTokens, "text/plain", _currentAppId);
}

export async function callGeminiWithQuality(qualityContext, userInput, generatePrompt, maxTokens) {
  const bundled = "STEP 1 — INPUT QUALITY CHECK\nContext: " + qualityContext + "\nInput: \"" + userInput + "\"\n\n" +
    "If too vague, respond ONLY: {\"__quality\":\"red\",\"message\":\"[what is missing]\"}\n\nSTEP 2 — GENERATE\n" + generatePrompt;
  const contents = [{ role: "user", parts: [{ text: preprocessInput(bundled) }] }];
  const raw = await _fetch(contents, maxTokens, "application/json", _currentAppId);
  return parseJSON(raw);
}
