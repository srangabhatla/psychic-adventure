/**
 * Janardhan Labs — Gemini Client v4
 * Per-app 3-key rotation. appId passed explicitly. No module-level state.
 */

const MODEL    = "gemini-1.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";
const TIMEOUT  = 55000;
const COOL_MS  = 65000;
const MIN_GAP  = 2000;

const GLOBAL_KEY = "jl-gemini-key";

function stateKey(appId) { return "jl-ks-" + (appId || "global"); }

function loadState(appId) {
  try {
    const raw = localStorage.getItem(stateKey(appId));
    if (raw) {
      const s = JSON.parse(raw);
      // Clear stale cooling on load
      const now = Date.now();
      s.coolingUntil = (s.coolingUntil || [0,0,0]).map(t => (t && t < now) ? 0 : (t || 0));
      return s;
    }
  } catch {}
  return { keys: ["","",""], lastUsed: [0,0,0], coolingUntil: [0,0,0], valid: [false,false,false] };
}

function saveState(appId, state) {
  try { localStorage.setItem(stateKey(appId), JSON.stringify(state)); } catch {}
}

function pickBestKey(appId) {
  const s = loadState(appId);
  const now = Date.now();
  const candidates = s.keys
    .map((k, i) => ({ k, i, lastUsed: s.lastUsed[i] || 0 }))
    .filter(({ k, i }) => k && s.valid[i] && !(s.coolingUntil[i] > now));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.lastUsed - b.lastUsed);
  return { key: candidates[0].k, index: candidates[0].i, lastUsed: candidates[0].lastUsed };
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

function markInvalid(appId, index) {
  const s = loadState(appId);
  s.valid[index] = false;
  saveState(appId, s);
}

export function getApiKey() {
  try { return localStorage.getItem(GLOBAL_KEY) || null; } catch { return null; }
}
export function saveApiKey(k) {
  try { localStorage.setItem(GLOBAL_KEY, k.trim()); } catch {}
}
export function clearApiKey() {
  try { localStorage.removeItem(GLOBAL_KEY); } catch {}
}

export function getAppKeys(appId) { return loadState(appId); }

export function saveAppKeys(appId, keys, valid) {
  const s = loadState(appId);
  s.keys  = keys;
  s.valid = valid;
  s.coolingUntil = [0,0,0];
  s.lastUsed = [0,0,0];
  saveState(appId, s);
  const first = keys.find((k,i) => k && valid[i]);
  if (first) saveApiKey(first);
}

export function getKeyStatuses(appId) {
  const s = loadState(appId);
  const now = Date.now();
  return s.keys.map((k,i) => {
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

// No module-level appId — passed explicitly every call
async function _fetch(contents, maxTokens, mimeType, appId, attempt) {
  attempt = attempt || 0;
  if (attempt >= 3) {
    const s = loadState(appId);
    const now = Date.now();
    const times = s.coolingUntil.filter(t => t > now);
    const secs = times.length ? Math.ceil((Math.min(...times) - now) / 1000) : 60;
    throw new Error("__COOLDOWN__:" + secs);
  }

  const best = pickBestKey(appId);
  if (!best) {
    const s = loadState(appId);
    const now = Date.now();
    const times = s.coolingUntil.filter(t => t > now);
    const secs = times.length ? Math.ceil((Math.min(...times) - now) / 1000) : 60;
    throw new Error("__COOLDOWN__:" + secs);
  }

  // Enforce minimum gap between reusing same key
  const elapsed = Date.now() - best.lastUsed;
  if (best.lastUsed > 0 && elapsed < MIN_GAP) {
    await new Promise(r => setTimeout(r, MIN_GAP - elapsed));
  }

  markUsed(appId, best.index);

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
      markCooling(appId, best.index);
      await new Promise(r => setTimeout(r, 1500));
      return _fetch(contents, maxTokens, mimeType, appId, attempt + 1);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        markInvalid(appId, best.index);
        return _fetch(contents, maxTokens, mimeType, appId, attempt + 1);
      }
      throw new Error((err && err.error && err.error.message) || "Gemini error " + res.status);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      const reason = data?.candidates?.[0]?.finishReason || "UNKNOWN";
      if (reason === "SAFETY")     throw new Error("Blocked by safety filters — rephrase.");
      if (reason === "RECITATION") throw new Error("Blocked due to recitation — rephrase.");
      throw new Error("Empty response — try again.");
    }
    return raw;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Request timed out.");
    throw e;
  }
}

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
    const m = (obj && arr) ? (clean.indexOf("{") < clean.indexOf("[") ? obj : arr) : (obj||arr);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error("Could not parse response — try again.");
  }
}

// appId is now read from localStorage key "jl-current-app" set by each app
function getCurrentAppId() {
  try { return localStorage.getItem("jl-current-app") || "global"; } catch { return "global"; }
}

export function setAppContext(appId) {
  try { localStorage.setItem("jl-current-app", appId); } catch {}
}

export async function callGemini(a, b, c) {
  const appId = getCurrentAppId();
  const args = resolveArgs(a, b, c);
  const raw = await _fetch(args.contents, args.maxTokens, "application/json", appId);
  return parseJSON(raw);
}

export async function callGeminiRaw(a, b, c) {
  const appId = getCurrentAppId();
  const args = resolveArgs(a, b, c);
  return _fetch(args.contents, args.maxTokens, "text/plain", appId);
}

export async function callGeminiWithQuality(qualityContext, userInput, generatePrompt, maxTokens) {
  const appId = getCurrentAppId();
  const bundled = "STEP 1 — INPUT QUALITY CHECK\nContext: " + qualityContext + "\nInput: \"" + userInput + "\"\n\nIf too vague respond ONLY: {\"__quality\":\"red\",\"message\":\"[what is missing]\"}\n\nSTEP 2 — GENERATE\n" + generatePrompt;
  const contents = [{ role: "user", parts: [{ text: preprocessInput(bundled) }] }];
  const raw = await _fetch(contents, maxTokens, "application/json", appId);
  return parseJSON(raw);
}
