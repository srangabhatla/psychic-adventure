/**
 * Janardhan Labs — Gemini Client
 * Direct browser → Gemini API calls. No proxy. No server. No auth.
 *
 * API key is read from localStorage under the key "jl-gemini-key".
 * Set once from any app's KeyGate — shared across the entire portfolio.
 *
 * Exports:
 *   callGemini(prompt, maxTokens)           — returns parsed JSON object
 *   callGeminiRaw(prompt, maxTokens)        — returns plain string
 *   getApiKey()                             — returns key or null
 *   saveApiKey(key)                         — persists to localStorage
 *   clearApiKey()                           — removes from localStorage
 */

const LS_KEY    = "jl-gemini-key";
const MODEL     = "gemini-2.0-flash-lite";
const BASE_URL  = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 55_000;

// ── Key management ─────────────────────────────────────────────────────────
export function getApiKey() {
  try { return localStorage.getItem(LS_KEY) || null; }
  catch { return null; }
}

export function saveApiKey(key) {
  try { localStorage.setItem(LS_KEY, key.trim()); }
  catch {}
}

export function clearApiKey() {
  try { localStorage.removeItem(LS_KEY); }
  catch {}
}

// ── Message normalisation ──────────────────────────────────────────────────
// Accepts the same call patterns the old api-client.js supported:
//   callGemini(promptString, maxTokens)
//   callGemini(messagesArray, maxTokens)   — for contract-scan multimodal
//   callGemini(system, user, maxTokens)    — 3-arg form for debate-coach etc.
function normaliseToGeminiContents(promptOrMessages) {
  // Already a Gemini-shape array
  if (Array.isArray(promptOrMessages)) {
    return promptOrMessages.map(msg => {
      const role = msg.role === "assistant" ? "model" : "user";
      if (typeof msg.content === "string") {
        return { role, parts: [{ text: msg.content }] };
      }
      if (msg.parts) {
        return { role, parts: msg.parts };
      }
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map(block => {
          if (block.type === "text")  return { text: block.text };
          if (block.type === "image") return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
          if (block.type === "document") return { inlineData: { mimeType: "application/pdf", data: block.source.data } };
          return { text: block.text || "" };
        });
        return { role, parts };
      }
      return { role, parts: [{ text: String(msg.content || "") }] };
    });
  }
  // Plain string
  return [{ role: "user", parts: [{ text: String(promptOrMessages) }] }];
}

// ── Core fetch ─────────────────────────────────────────────────────────────
async function _fetch(contents, maxTokens, responseMimeType = "application/json") {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key set. Add your Gemini key to get started.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 1000,
          responseMimeType,
          temperature: 0.7,
        },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `Gemini error ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new Error("Invalid API key. Check your key at aistudio.google.com");
      if (res.status === 429) throw new Error("Rate limit hit. Wait a moment and try again.");
      throw new Error(msg);
    }

    const data = await res.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const reason = data?.candidates?.[0]?.finishReason || "UNKNOWN";

    if (!raw) {
      throw new Error(`Empty response from Gemini (reason: ${reason}) — please try again`);
    }

    return raw;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Request timed out — please try again");
    throw e;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * callGemini — returns parsed JSON.
 *
 * Supports all legacy call signatures from api-client.js:
 *   callGemini(prompt, maxTokens)
 *   callGemini(messagesArray, maxTokens)
 *   callGemini(system, user, maxTokens)   ← 3-arg form
 */
export async function callGemini(promptOrSystemOrMessages, maxTokensOrUser, maybeMaxTokens) {
  let contents, maxTokens;

  if (maybeMaxTokens !== undefined) {
    // 3-arg form: (system, user, maxTokens)
    const combined = `${promptOrSystemOrMessages}\n\n${maxTokensOrUser}`;
    contents  = [{ role: "user", parts: [{ text: combined }] }];
    maxTokens = maybeMaxTokens;
  } else {
    contents  = normaliseToGeminiContents(promptOrSystemOrMessages);
    maxTokens = maxTokensOrUser;
  }

  const raw   = await _fetch(contents, maxTokens, "application/json");
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try { return JSON.parse(clean); } catch {
    const obj = clean.match(/\{[\s\S]*\}/);
    const arr = clean.match(/\[[\s\S]*\]/);
    const match = obj && arr
      ? (clean.indexOf("{") < clean.indexOf("[") ? obj : arr)
      : (obj || arr);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error("Could not parse response — please try again");
  }
}

/**
 * callGeminiRaw — returns plain text string (no JSON parsing).
 * Used by: VisualMind, FeedbackTranslator.
 *
 * Supports same call signatures as callGemini.
 */
export async function callGeminiRaw(promptOrSystemOrMessages, maxTokensOrUser, maybeMaxTokens) {
  let contents, maxTokens;

  if (maybeMaxTokens !== undefined) {
    const combined = `${promptOrSystemOrMessages}\n\n${maxTokensOrUser}`;
    contents  = [{ role: "user", parts: [{ text: combined }] }];
    maxTokens = maybeMaxTokens;
  } else {
    contents  = normaliseToGeminiContents(promptOrSystemOrMessages);
    maxTokens = maxTokensOrUser;
  }

  // Use text/plain so Gemini doesn't force JSON formatting
  return _fetch(contents, maxTokens, "text/plain");
}
