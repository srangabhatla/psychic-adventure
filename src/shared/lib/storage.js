/**
 * Janardhan Labs — Storage Utility
 * Uses localStorage as the primary backend (works in all deployed environments).
 * Falls back gracefully if localStorage is unavailable.
 *
 * Usage:
 *   import { saveResult, loadResults, clearResults, storageGet, storageSet } from "../../shared/lib/storage";
 */

const MAX_RESULTS = 3;
const PREFIX = "jl-";

function lsKey(appId) { return `${PREFIX}results-${appId}`; }

function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
  catch { return null; }
}

function lsSet(k, value) {
  try { localStorage.setItem(k, JSON.stringify(value)); } catch {}
}

function lsDel(k) {
  try { localStorage.removeItem(k); } catch {}
}

export function saveResult(appId, data) {
  const existing = loadResults(appId);
  const updated = [{ data, savedAt: new Date().toISOString() }, ...existing].slice(0, MAX_RESULTS);
  lsSet(lsKey(appId), updated);
}

export function loadResults(appId) {
  return lsGet(lsKey(appId)) || [];
}

export function clearResults(appId) {
  lsDel(lsKey(appId));
}

export function storageGet(k) { return lsGet(PREFIX + k); }
export function storageSet(k, value) { lsSet(PREFIX + k, value); }
export function storageDelete(k) { lsDel(PREFIX + k); }
