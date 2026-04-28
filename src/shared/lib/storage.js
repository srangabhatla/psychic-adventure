/**
 * Janardhan Labs — Storage Utility
 * Wraps window.storage for per-app result persistence.
 * Saves last MAX_RESULTS outputs per app so page refresh doesn't erase work.
 *
 * Usage:
 *   import { saveResult, loadResults, clearResults } from "../../shared/lib/storage";
 *   await saveResult("gift-intelligence", giftData);
 *   const past = await loadResults("gift-intelligence");  // newest first
 *   await clearResults("gift-intelligence");
 */

const MAX_RESULTS = 3;

function key(appId) {
  return `jl-results-${appId}`;
}

export async function saveResult(appId, data) {
  try {
    const existing = await loadResults(appId);
    const updated  = [
      { data, savedAt: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_RESULTS);
    await window.storage.set(key(appId), JSON.stringify(updated));
  } catch {}
}

export async function loadResults(appId) {
  try {
    const r = await window.storage.get(key(appId));
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

export async function clearResults(appId) {
  try { await window.storage.delete(key(appId)); } catch {}
}

// ── Simple key-value helpers for app-specific persistence ─────────────────
// e.g. voice profiles, routines, session history

export async function storageGet(k) {
  try {
    const r = await window.storage.get(k);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

export async function storageSet(k, value) {
  try { await window.storage.set(k, JSON.stringify(value)); } catch {}
}

export async function storageDelete(k) {
  try { await window.storage.delete(k); } catch {}
}
