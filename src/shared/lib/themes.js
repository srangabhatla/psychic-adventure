/**
 * Janardhan Labs — App Theme Registry
 * Single source of truth for per-app visual identity.
 * Used by KeyGate (themed key setup) and Home (portal cards).
 */

export const APP_THEMES = {
  "visualmind": {
    name: "VisualMind",
    tagline: "Turn notes into visual understanding",
    bg: "#FAFAF7", surface: "#FFFFFF", accent: "#2D2D2D",
    accentPale: "#F5F5F0", accentText: "#2D2D2D",
    rule: "#E8E8E2", ink: "#1A1A1A", inkMid: "#6B6B6B",
    fontHead: "'DM Sans', sans-serif", fontMono: "'DM Mono', monospace",
    gfont: "DM+Sans:wght@400;500;600&family=DM+Mono:wght@400",
    orb: "🧠", dark: false,
  },
  "feedback-translator": {
    name: "FeedbackTranslator",
    tagline: "Decode what feedback actually means",
    bg: "#080b14", surface: "#0F1320", accent: "#6C8EF5",
    accentPale: "#0D1530", accentText: "#6C8EF5",
    rule: "#1A2240", ink: "#E8ECF8", inkMid: "#7A85B0",
    fontHead: "'DM Sans', sans-serif", fontMono: "'DM Mono', monospace",
    gfont: "DM+Sans:wght@400;500;600&family=DM+Mono:wght@400",
    orb: "💬", dark: true,
  },
  "debate-coach": {
    name: "DebateCoach",
    tagline: "Master both sides of any argument",
    bg: "#12100E", surface: "#1C1815", accent: "#E8C97A",
    accentPale: "#1E1A0E", accentText: "#E8C97A",
    rule: "#2A2520", ink: "#F0EBE0", inkMid: "#8A7E6A",
    fontHead: "'Playfair Display', serif", fontMono: "'DM Mono', monospace",
    gfont: "Playfair+Display:wght@400;700&family=DM+Mono:wght@400",
    orb: "⚔️", dark: true,
  },
  "gift-intelligence": {
    name: "GiftIntelligence",
    tagline: "The perfect gift for every person",
    bg: "#F7F0E6", surface: "#FFFFFF", accent: "#C4674A",
    accentPale: "#FEF3EE", accentText: "#C4674A",
    rule: "#EAE0D4", ink: "#2A1F1A", inkMid: "#8A6858",
    fontHead: "'Cormorant Garamond', serif", fontMono: "'DM Mono', monospace",
    gfont: "Cormorant+Garamond:wght@400;500;600&family=DM+Mono:wght@400",
    orb: "🎁", dark: false,
  },
  "exam-simulator": {
    name: "ExamSimulator",
    tagline: "Test yourself before the test tests you",
    bg: "#F3F5FA", surface: "#FFFFFF", accent: "#0F1F3D",
    accentPale: "#EEF1F8", accentText: "#0F1F3D",
    rule: "#DDE2EE", ink: "#0F1F3D", inkMid: "#5A6A8A",
    fontHead: "'Libre Baskerville', serif", fontMono: "'JetBrains Mono', monospace",
    gfont: "Libre+Baskerville:wght@400;700&family=JetBrains+Mono:wght@400",
    orb: "📝", dark: false,
  },
  "claim-lens": {
    name: "ClaimLens",
    tagline: "Verify any claim with evidence",
    bg: "#08111C", surface: "#0E1A28", accent: "#00C9A7",
    accentPale: "#041814", accentText: "#00C9A7",
    rule: "#142030", ink: "#E0EEF8", inkMid: "#6A8AA8",
    fontHead: "'Syne', sans-serif", fontMono: "'Fira Code', monospace",
    gfont: "Syne:wght@400;600;700&family=Fira+Code:wght@400",
    orb: "🔍", dark: true,
  },
  "aperture": {
    name: "Aperture",
    tagline: "See research papers through 6 lenses",
    bg: "#F4F1EC", surface: "#FFFFFF", accent: "#3D6B4F",
    accentPale: "#EEF5F0", accentText: "#3D6B4F",
    rule: "#E0DAD2", ink: "#1E2A1E", inkMid: "#6A7A6A",
    fontHead: "'Fraunces', serif", fontMono: "'Fira Code', monospace",
    gfont: "Fraunces:wght@300;400;500&family=Fira+Code:wght@400",
    orb: "📖", dark: false,
  },
  "style-mirror": {
    name: "StyleMirror",
    tagline: "Extract your voice. Rewrite anything in it.",
    bg: "#13131F", surface: "#1C1C2E", accent: "#9B5DE5",
    accentPale: "#1E1530", accentText: "#9B5DE5",
    rule: "#2A2A40", ink: "#E8E6F0", inkMid: "#8A88A0",
    fontHead: "'Plus Jakarta Sans', sans-serif", fontMono: "'Overpass Mono', monospace",
    gfont: "Plus+Jakarta+Sans:wght@400;500;700&family=Overpass+Mono:wght@400",
    orb: "✍️", dark: true,
  },
  "sprint-mind": {
    name: "SprintMind",
    tagline: "PRD + JIRA hierarchy from one sentence",
    bg: "#F8F9FC", surface: "#FFFFFF", accent: "#2563EB",
    accentPale: "#EFF6FF", accentText: "#2563EB",
    rule: "#E2E6F0", ink: "#0F172A", inkMid: "#475569",
    fontHead: "'Instrument Sans', sans-serif", fontMono: "'Fira Code', monospace",
    gfont: "Instrument+Sans:wght@400;500;600&family=Fira+Code:wght@400",
    orb: "🚀", dark: false,
  },
  "contract-scan": {
    name: "ContractScan",
    tagline: "Know what you're signing before you sign it",
    bg: "#0B1610", surface: "#111E16", accent: "#10B981",
    accentPale: "#0A2016", accentText: "#10B981",
    rule: "#1A2E20", ink: "#EDF2EE", inkMid: "#8BAF95",
    fontHead: "'Lora', serif", fontMono: "'Space Mono', monospace",
    gfont: "Lora:wght@400;500;600&family=Space+Mono:wght@400",
    orb: "📋", dark: true,
  },
  "skinstack": {
    name: "SkinStack",
    tagline: "Your skin, your stack, no guesswork",
    bg: "#FDFAF6", surface: "#FFFFFF", accent: "#C084A0",
    accentPale: "#FDF0F5", accentText: "#9B5F7A",
    rule: "#EDE8E2", ink: "#2C1F1A", inkMid: "#7A6058",
    fontHead: "'Vidaloka', serif", fontMono: "'Nunito', sans-serif",
    gfont: "Vidaloka&family=Nunito:wght@400;500;600",
    orb: "✨", dark: false,
  },
  "story-bible": {
    name: "StoryBibleBuilder",
    tagline: "Five sacred steps. One complete world.",
    bg: "#0D0A07", surface: "#161009", accent: "#8b1a1a",
    accentPale: "#1A0A0A", accentText: "#c0392b",
    rule: "#2A1A0A", ink: "#F0EAD8", inkMid: "#A08060",
    fontHead: "'Cinzel', serif", fontMono: "'IM Fell English', serif",
    gfont: "Cinzel:wght@400;600&family=IM+Fell+English:ital@0;1",
    orb: "📜", dark: true,
  },
  "pm-studio": {
    name: "PM Studio",
    tagline: "17 tools for every PM workflow",
    bg: "#0D0A00", surface: "#161200", accent: "#F5A623",
    accentPale: "#1A1400", accentText: "#F5A623",
    rule: "#2A2000", ink: "#F0E8D0", inkMid: "#A09060",
    fontHead: "'DM Serif Display', serif", fontMono: "'JetBrains Mono', monospace",
    gfont: "DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500",
    orb: "⚡", dark: true,
  },
  "signal-post": {
    name: "SignalPost",
    tagline: "Your work already happened. Now let it work for you.",
    bg: "#0A0A0A", surface: "#111111", accent: "#F5A623",
    accentPale: "#1A1200", accentText: "#F5A623",
    rule: "#2A2A2A", ink: "#F0EDE8", inkMid: "#A09890",
    fontHead: "'Bebas Neue', sans-serif", fontMono: "'DM Mono', monospace",
    gfont: "Bebas+Neue&family=DM+Mono:wght@300;400;500",
    orb: "✦", dark: true,
  },
};

export const DEFAULT_THEME = APP_THEMES["sprint-mind"];

export function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
