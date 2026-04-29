/**
 * Janardhan Labs — QualityGate
 * Pre-call input scorer. Uses shared gemini-client (retry/backoff included).
 * Never blocks the user — gate errors default to amber (proceed).
 */
import { useState } from "react";
import { callGemini } from "../lib/gemini-client";

export const QUALITY_CONTEXTS = {
  "gift-intelligence": "Gift recommendation. Good: specific person, age, personality, occasion, budget. Bad: 'my friend' with no detail.",
  "sprint-mind":       "PM tool generating PRDs and JIRA tickets. Good: specific feature with user persona and action. Bad: 'dark mode', 'notifications'.",
  "exam-simulator":    "Exam simulator. Good: specific topic + study level + context or notes. Bad: single words like 'history'.",
  "skinstack":         "Skincare routine builder. Good: skin type, concerns, existing products, restrictions. Bad: 'normal skin, want to improve'.",
};

function buildPrompt(input, appId) {
  const ctx = QUALITY_CONTEXTS[appId] || "An AI tool. Good input is specific. Bad input is vague.";
  return "Evaluate this input for an AI tool.\nContext: " + ctx + "\nInput: \"" + input + "\"\n\n" +
    "Return ONLY valid JSON:\n{\"quality\":\"green\",\"message\":\"one sentence\"}\n\n" +
    "quality is green|amber|red. message: green=confirm, amber=name ONE missing thing, red=say exactly what to add.";
}

export function useQualityGate(appId) {
  const [score,   setScore]   = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isBlocked = score === "red";
  const isPassed  = score === "green" || score === "amber";

  async function analyse(input) {
    if (!input || input.trim().length < 10) {
      setScore("red"); setMessage("Too short — add more detail."); return;
    }
    setLoading(true);
    try {
      const r = await callGemini(buildPrompt(input.trim(), appId), 150);
      setScore(r.quality || "amber");
      setMessage(r.message || "");
    } catch {
      setScore("amber");
      setMessage("Could not check — proceed when ready.");
    }
    setLoading(false);
  }

  function reset() { setScore(null); setMessage(""); }

  return { score, message, loading, isBlocked, isPassed, analyse, reset };
}
