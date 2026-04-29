/**
 * Janardhan Labs — Gemini Client v2
 *
 * Fixes:
 *   - Retry with exponential backoff on 429 (4s → 8s → 16s, max 3 attempts)
 *   - All calls use gemini-2.0-flash-lite (higher free-tier RPM/TPM)
 *   - callGeminiWithQuality() bundles quality check + generate into ONE call
 *   - Shared key via localStorage "jl-gemini-key"
 *   - Supports all legacy call signaturesF
 */

const LS_KEY     = "jl-gemini-key";
const MODEL      = "gemini-2.0-flash-lite";
const BASE_URL   = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";
const TIMEOUT_MS = 55000;
const MAX_RETRY  = 3;
const RETRY_BASE = 4000;

export function getApiKey()   { try { return localStorage.getItem(LS_KEY) || null; } catch { return null; } }
export function saveApiKey(k) { try { localStorage.setItem(LS_KEY, k.trim()); } catch {} }
export function clearApiKey() { try { localStorage.removeItem(LS_KEY); } catch {} }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalise(v) {
  if (Array.isArray(v)) {
    return v.map(msg => {
      const role = msg.role === "assistant" ? "model" : "user";
      if (typeof msg.content === "string") return { role, parts: [{ text: msg.content }] };
      if (msg.parts) return { role, parts: msg.parts };
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map(b => {
          if (b.type === "text")     return { text: b.text };
          if (b.type === "image")    return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
          if (b.type === "document") return { inlineData: { mimeType: "application/pdf", data: b.source.data } };
          return { text: b.text || "" };
        });
        return { role, parts };
      }
      return { role, parts: [{ text: String(msg.content || "") }] };
    });
  }
  return [{ role: "user", parts: [{ text: preprocessInput(String(v)) }] }];
}

function preprocessInput(text) {
  if (typeof text !== "string" || text.length < 100) return text;
  
  // Normalize whitespace
  let clean = text.replace(/\s+/g, " ").trim();
  
  // Remove repeated sentences
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const unique = sentences.filter(s => {
    const key = s.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  clean = unique.join(". ");
  
  // Cap at ~3200 chars (safe token budget)
  if (clean.length > 3200) {
    clean = clean.slice(0, 3200) + "...";
  }
  
  return clean;
}

async function _fetch(contents, maxTokens, mimeType, attempt) {
  attempt = attempt || 0;
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key set — add your Gemini key to get started.");

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, TIMEOUT_MS);

  try {
    const res = await fetch(BASE_URL + "?key=" + apiKey, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 1000,
          responseMimeType: mimeType || "application/json",
          temperature: 0.7,
        },
      }),
    });

    clearTimeout(timer);

    if (res.status === 429) {
      if (attempt < MAX_RETRY) {
        const wait = RETRY_BASE * Math.pow(2, attempt);
        console.warn("Gemini 429 — retrying in " + (wait/1000) + "s");
        await sleep(wait);
        return _fetch(contents, maxTokens, mimeType, attempt + 1);
      }
      throw new Error(
        "Rate limit reached on Gemini free tier. Wait 60 seconds and try again, " +
        "or use a paid key at aistudio.google.com for higher limits."
      );
    }

    if (!res.ok) {
      const err = await res.json().catch(function() { return {}; });
      const msg = (err && err.error && err.error.message) || ("Gemini error " + res.status);
      if (res.status === 401 || res.status === 403)
        throw new Error("Invalid API key — verify at aistudio.google.com/apikey");
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
      if (reason === "SAFETY")     throw new Error("Blocked by Gemini safety filters — try rephrasing.");
      if (reason === "RECITATION") throw new Error("Blocked due to recitation — try rephrasing.");
      throw new Error("Empty response from Gemini (" + reason + ") — please try again.");
    }

    return raw;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Request timed out — check connection and try again.");
    throw e;
  }
}

function parseJSON(raw) {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(clean); } catch(e1) {
    const obj = clean.match(/\{[\s\S]*\}/);
    const arr = clean.match(/\[[\s\S]*\]/);
    const m = (obj && arr)
      ? (clean.indexOf("{") < clean.indexOf("[") ? obj : arr)
      : (obj || arr);
    if (m) { try { return JSON.parse(m[0]); } catch(e2) {} }
    throw new Error("Could not parse Gemini response — please try again.");
  }
}

function resolveArgs(a, b, c) {
  if (c !== undefined) {
    return { contents: [{ role: "user", parts: [{ text: a + "\n\n" + b }] }], maxTokens: c };
  }
  return { contents: normalise(a), maxTokens: b };
}

export async function callGemini(a, b, c) {
  const args = resolveArgs(a, b, c);
  const raw = await _fetch(args.contents, args.maxTokens, "application/json");
  return parseJSON(raw);
}

export async function callGeminiRaw(a, b, c) {
  const args = resolveArgs(a, b, c);
  return _fetch(args.contents, args.maxTokens, "text/plain");
}

/**
 * callGeminiWithQuality
 * Bundles quality check + generation into ONE Gemini call — zero extra requests.
 * If input is too vague, returns { __quality: "red", message: "..." } immediately.
 * Otherwise returns the normal generation output.
 */
export async function callGeminiWithQuality(qualityContext, userInput, generatePrompt, maxTokens) {
  const bundled = "STEP 1 — INPUT QUALITY CHECK\n" +
    "Context: " + qualityContext + "\n" +
    "Input: \"" + userInput + "\"\n\n" +
    "If the input is too vague or short to produce a useful output, respond ONLY with this JSON and stop:\n" +
    "{\"__quality\":\"red\",\"message\":\"[one sentence: exactly what is missing]\"}\n\n" +
    "If the input is acceptable, proceed.\n\n" +
    "STEP 2 — GENERATE\n" +
    generatePrompt;

  const contents = [{ role: "user", parts: [{ text: bundled }] }];
  const raw = await _fetch(contents, maxTokens, "application/json");
  return parseJSON(raw);
}
