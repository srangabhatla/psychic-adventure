/**
 * Janardhan Labs — QualityGate
 * Lightweight pre-call input scorer (~300 tokens).
 * Runs BEFORE the main AI call to prevent token waste on weak inputs.
 *
 * Usage:
 *   import { useQualityGate } from "../../shared/components/QualityGate";
 *
 *   const { score, message, loading, analyse, reset } = useQualityGate(apiKey, "What your app analyses");
 *   // score: "green" | "amber" | "red" | null
 *   // isBlocked: true when score === "red"
 *
 * Visual rendering is left to each app — this is the logic layer only.
 */

import { useState } from "react";
import { callGemini } from "../lib/gemini-client";

function buildQualityPrompt(input, appContext) {
  return `You are evaluating input quality before running an AI tool.

App context: ${appContext}
User input: "${input}"

Return ONLY valid JSON — no markdown, no explanation:
{
  "quality": "green" | "amber" | "red",
  "message": "One direct sentence. Green = confirm ready. Amber = name the ONE missing detail. Red = say exactly what's wrong and what's needed.",
  "suggestion": "Optional: one specific improvement the user can make (null if green)"
}

Green = specific, has enough context to produce a useful output.
Amber = right direction but missing one key detail.
Red = too vague, too short, or missing essential information.`;
}

export function useQualityGate(apiKey, appContext) {
  const [score,   setScore]   = useState(null);   // "green" | "amber" | "red" | null
  const [message, setMessage] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const isBlocked = score === "red";
  const isPassed  = score === "green" || score === "amber";

  async function analyse(input) {
    if (!input || input.trim().length < 10) {
      setScore("red");
      setMessage("Input is too short. Add more detail.");
      setSuggestion(null);
      return;
    }
    setLoading(true); setError("");
    try {
      const r = await callGemini(buildQualityPrompt(input.trim(), appContext), 300);
      setScore(r.quality || "amber");
      setMessage(r.message || "");
      setSuggestion(r.suggestion || null);
    } catch (e) {
      setError(e.message);
      // Don't block on gate errors — let the user proceed
      setScore("amber");
      setMessage("Could not analyse input — proceeding anyway.");
    }
    setLoading(false);
  }

  function reset() {
    setScore(null);
    setMessage("");
    setSuggestion(null);
    setError("");
  }

  return { score, message, suggestion, loading, error, isBlocked, isPassed, analyse, reset };
}
