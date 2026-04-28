import { useApiKey } from "../../shared/components/KeyGate";
import { callGemini } from "../../shared/lib/gemini-client";
import { useState, useRef } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
  /* ══ HEADER ══ */
  .site-header{background:var(--surface);border-bottom:1px solid var(--rule);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;}
  .header-brand{display:flex;flex-direction:column;gap:0.1rem;}
  .header-eyebrow{font-family:var(--font-mono);font-size:0.5rem;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:var(--accent,#6C8EF5);}
  .header-appname{font-size:1.5rem;font-weight:700;color:var(--ink,#E8ECF8);letter-spacing:-0.03em;line-height:1;}
  .header-appname span{color:var(--accent,#6C8EF5);}
  .header-tagline{font-family:var(--font-mono);font-size:0.52rem;color:var(--ink-dim,#7A85B0);margin-top:0.15rem;letter-spacing:0.04em;}
  @media(max-width:480px){.header-tagline{display:none}}
  .site-footer{border-top:1px solid var(--rule,#1A2240);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;background:var(--surface,#0F1320);}
  .footer-left{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim,#7A85B0);}
  .footer-left strong{color:var(--accent,#6C8EF5);font-weight:500;}
  .footer-right{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim,#7A85B0);}
  .jl-mark{font-family:'DM Mono',monospace;font-size:0.45rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.25);white-space:nowrap;flex-shrink:0;}
`;

const SUGGESTED = [
  "AI will do more harm than good",
  "Remote work is better than office work",
  "Social media should be regulated by governments",
  "Universal basic income should be implemented",
  "Space exploration is worth the cost",
  "Zoos should be abolished",
];

const DOMAINS = ["General","Politics","Business","Ethics","Science","Sports","Philosophy","Technology"];
const TONES   = ["Combative","Academic","Neutral"];
const ROUNDS  = ["1","3","5","Unlimited"];

// ── SINGLE CALL: generate both sides ────────────────────────────
function buildSidesPrompt(topic, domain, tone) {
  return {
    system: `You are DebateCoach. Generate steelmanned arguments — the strongest possible version of each position. Tone: ${tone}. Return ONLY valid compact JSON, no markdown, no extra text.`,
    user: `Topic: "${topic}" Domain: ${domain}
Return exactly this JSON structure:
{"topic":"cleaned topic","for":{"position":"One sentence FOR position","arguments":[{"title":"Title","body":"2-3 sentence argument"},{"title":"Title","body":"2-3 sentence argument"},{"title":"Title","body":"2-3 sentence argument"}]},"against":{"position":"One sentence AGAINST position","arguments":[{"title":"Title","body":"2-3 sentence argument"},{"title":"Title","body":"2-3 sentence argument"},{"title":"Title","body":"2-3 sentence argument"}]}}`
  };
}

// ── SINGLE CALL: generate challenge + score previous rebuttal ───
function buildRoundPrompt(topic, userPosition, opponentPosition, roundNum, tone, prevRebuttal, prevChallenge) {
  if (prevRebuttal && prevChallenge) {
    // Score previous AND generate next challenge in one call
    return {
      system: `You are a ${tone.toLowerCase()} debate judge and opponent. Return ONLY valid compact JSON, no markdown.`,
      user: `Topic: "${topic}". User defends: "${userPosition}".
Round ${roundNum} challenge was: "${prevChallenge}"
User's rebuttal: "${prevRebuttal}"

Score the rebuttal AND generate the next challenge. Return:
{"score":{"logic":{"score":7,"comment":"one sentence"},"evidence":{"score":6,"comment":"one sentence"},"rebuttal":{"score":8,"comment":"one sentence"},"overall":7,"verdict":"one sentence","stronger_rebuttal":"2-3 sentences on how to argue better"},"next_challenge":{"challenge":"Your single hardest counterargument for round ${roundNum + 1}. 2-4 sentences.","hint":"Argument type e.g. Statistical"}}`
    };
  }
  // First round — just generate challenge
  return {
    system: `You are a ${tone.toLowerCase()} debate opponent. Return ONLY valid compact JSON, no markdown.`,
    user: `Topic: "${topic}". User defends: "${userPosition}". Opponent holds: "${opponentPosition}". Round ${roundNum}.
Return: {"challenge":"Your single hardest counterargument. 2-4 sentences. Make it sting.","hint":"Argument type e.g. Moral"}`
  };
}

// ── FINAL SCORE: score last rebuttal only ───────────────────────
function buildFinalScorePrompt(topic, userPosition, challenge, rebuttal, tone) {
  return {
    system: `You are a ${tone.toLowerCase()} debate judge. Return ONLY valid compact JSON, no markdown.`,
    user: `Topic: "${topic}". User defends: "${userPosition}".
Challenge: "${challenge}"
Rebuttal: "${rebuttal}"
Return: {"score":{"logic":{"score":7,"comment":"one sentence"},"evidence":{"score":6,"comment":"one sentence"},"rebuttal":{"score":8,"comment":"one sentence"},"overall":7,"verdict":"one sentence","stronger_rebuttal":"2-3 sentences"}}`
  };
}

// ── API CALL with timeout ────────────────────────────────────────

function parseJSON(t) {
  try { return JSON.parse(t.replace(/```json|```/g, "").trim()); }
  catch {
    // Try to extract JSON from text
    const match = t.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

// ── STYLES ───────────────────────────────────────────────────────
const css = `
${FONTS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --for-bg: #faf6ef; --for-surface: #f0e8d8; --for-border: #d4b896;
  --for-text: #2a1f0e; --for-mid: #8a6d4a; --for-dim: #b89870;
  --for-accent: #c17f24; --for-glow: rgba(193,127,36,0.15);
  --ag-bg: #0d1117; --ag-surface: #161b22; --ag-border: rgba(255,255,255,0.10);
  --ag-text: #e6edf3; --ag-mid: #8b949e; --ag-dim: #484f58;
  --ag-accent: #4493f8; --ag-glow: rgba(68,147,248,0.15);
  --n-bg: #0f0f13; --n-text: #f0f0f0; --n-mid: #888; --n-dim: #444;
  --n-border: rgba(255,255,255,0.08); --n-accent: #e8c96a;
}

body { font-family:'DM Sans',sans-serif; background:var(--n-bg); color:var(--n-text); min-height:100vh; overflow-x:hidden; }

/* ── SETUP ── */
.setup { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 20px; }
.setup-bg { position:fixed; inset:0; pointer-events:none; background: radial-gradient(ellipse 60% 50% at 30% 30%,rgba(232,201,106,0.06) 0%,transparent 60%), radial-gradient(ellipse 50% 40% at 70% 70%,rgba(68,147,248,0.05) 0%,transparent 60%); }
.setup-inner { position:relative; z-index:1; width:100%; max-width:600px; }

.setup-badge { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:3px; text-transform:uppercase; color:var(--n-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; }
.setup-badge::before,.setup-badge::after { content:''; flex:1; height:1px; background:rgba(232,201,106,0.2); }

.setup-title { font-family:'Playfair Display',serif; font-size:clamp(30px,6vw,50px); font-weight:900; text-align:center; line-height:1.1; margin-bottom:8px; letter-spacing:-1px; }
.setup-title em { font-style:italic; color:var(--n-accent); }
.setup-sub { text-align:center; font-size:13px; color:var(--n-mid); line-height:1.7; margin-bottom:32px; }

.topic-input { width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--n-border); border-radius:12px; padding:14px 18px; font-family:'Playfair Display',serif; font-size:17px; color:var(--n-text); outline:none; transition:border-color 0.2s,box-shadow 0.2s; line-height:1.4; margin-bottom:12px; }
.topic-input::placeholder { color:var(--n-dim); font-style:italic; }
.topic-input:focus { border-color:var(--n-accent); box-shadow:0 0 0 3px rgba(232,201,106,0.1); }

.chips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:20px; }
.chip { padding:5px 13px; background:rgba(255,255,255,0.04); border:1px solid var(--n-border); border-radius:20px; font-size:12px; color:var(--n-mid); cursor:pointer; transition:all 0.15s; white-space:nowrap; }
.chip:hover { border-color:var(--n-accent); color:var(--n-accent); }

.config-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px; }
.config-group {}
.cfg-label { display:block; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--n-dim); margin-bottom:5px; }
.cfg-select { width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--n-border); border-radius:8px; padding:9px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--n-text); outline:none; cursor:pointer; }
.cfg-select option { background:#1a1a1f; color:#f0f0f0; }

.start-btn { width:100%; padding:15px; border:none; border-radius:12px; background:linear-gradient(135deg,#c17f24,#e8c96a); font-family:'Playfair Display',serif; font-size:17px; font-weight:700; color:#1a0e00; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 24px rgba(193,127,36,0.3); }
.start-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(193,127,36,0.4); }
.start-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; }

/* ── ARENA ── */
.arena { min-height:100vh; display:flex; flex-direction:column; }
.for-theme { background:var(--for-bg); }
.ag-theme  { background:var(--ag-bg); }
.sides-theme { background:var(--n-bg); }

.arena-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid; position:sticky; top:0; z-index:100; gap:12px; }
.for-theme .arena-hdr  { border-color:var(--for-border); background:var(--for-bg); }
.ag-theme  .arena-hdr  { border-color:var(--ag-border);  background:var(--ag-bg); }
.sides-theme .arena-hdr { border-color:var(--n-border); background:var(--n-bg); }

.arena-topic { font-family:'Playfair Display',serif; font-size:13px; font-weight:700; font-style:italic; flex:1; text-align:center; padding:0 10px; line-height:1.4; }
.for-theme  .arena-topic { color:var(--for-text); }
.ag-theme   .arena-topic { color:var(--ag-text); }
.sides-theme .arena-topic { color:var(--n-text); }

.arena-meta { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; }
.for-theme  .arena-meta { color:var(--for-mid); }
.ag-theme   .arena-meta { color:var(--ag-mid); }
.sides-theme .arena-meta { color:var(--n-mid); }

.back-btn { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:transparent; border:1px solid; border-radius:6px; padding:5px 10px; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
.for-theme  .back-btn { border-color:var(--for-border); color:var(--for-mid); }
.for-theme  .back-btn:hover { border-color:var(--for-accent); color:var(--for-accent); }
.ag-theme   .back-btn { border-color:var(--ag-border);  color:var(--ag-mid); }
.ag-theme   .back-btn:hover { border-color:var(--ag-accent); color:var(--ag-accent); }
.sides-theme .back-btn { border-color:var(--n-border); color:var(--n-mid); }
.sides-theme .back-btn:hover { border-color:var(--n-accent); color:var(--n-accent); }

/* ── SIDES SCREEN — MOBILE FIRST ── */
.sides-wrap { display:flex; flex-direction:column; gap:0; }

.side-card { padding:24px 20px; cursor:pointer; transition:all 0.2s; border-bottom:1px solid var(--n-border); }
.side-card:hover { opacity:0.85; }
.side-card:active { opacity:0.7; }

.side-for { border-left:4px solid var(--for-accent); }
.side-ag  { border-left:4px solid var(--ag-accent); }

.side-tag { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:6px; }
.side-for .side-tag { color:var(--for-accent); }
.side-ag  .side-tag { color:var(--ag-accent); }

.side-position { font-family:'Playfair Display',serif; font-size:17px; font-weight:700; color:var(--n-text); line-height:1.4; margin-bottom:14px; }

.arg-card { padding:12px 14px; border-radius:8px; margin-bottom:8px; }
.side-for .arg-card { background:rgba(193,127,36,0.07); border:1px solid rgba(193,127,36,0.15); }
.side-ag  .arg-card { background:rgba(68,147,248,0.06); border:1px solid rgba(68,147,248,0.12); }

.arg-title { font-family:'Playfair Display',serif; font-size:13px; font-weight:700; margin-bottom:4px; }
.side-for .arg-title { color:var(--for-accent); }
.side-ag  .arg-title { color:var(--ag-accent); }
.arg-body { font-size:12px; line-height:1.7; color:var(--n-mid); }

.pick-cta { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:14px; padding:11px; border-radius:9px; border:2px dashed; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; transition:all 0.2s; }
.side-for .pick-cta { border-color:rgba(193,127,36,0.3); color:var(--for-accent); }
.side-for .pick-cta:hover { background:rgba(193,127,36,0.08); border-color:var(--for-accent); }
.side-ag  .pick-cta { border-color:rgba(68,147,248,0.3); color:var(--ag-accent); }
.side-ag  .pick-cta:hover { background:rgba(68,147,248,0.08); border-color:var(--ag-accent); }

/* Desktop split */
@media (min-width: 700px) {
  .sides-wrap { flex-direction:row; min-height:calc(100vh - 57px); }
  .side-card { flex:1; border-bottom:none; border-right:1px solid var(--n-border); border-left:none; padding:32px 28px; }
  .side-card:last-child { border-right:none; }
  .side-for { border-top:4px solid var(--for-accent); }
  .side-ag  { border-top:4px solid var(--ag-accent); }
}

/* ── BATTLE ZONE ── */
.battle-zone { padding:20px; display:flex; flex-direction:column; gap:16px; max-width:760px; margin:0 auto; width:100%; padding-bottom:40px; }

.round-strip { display:flex; align-items:center; gap:10px; }
.round-pill { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; padding:4px 11px; border-radius:20px; }
.for-theme  .round-pill { background:rgba(193,127,36,0.12); color:var(--for-accent); border:1px solid rgba(193,127,36,0.2); }
.ag-theme   .round-pill { background:rgba(68,147,248,0.12);  color:var(--ag-accent);  border:1px solid rgba(68,147,248,0.2); }
.round-line { flex:1; height:1px; }
.for-theme .round-line { background:var(--for-border); }
.ag-theme  .round-line { background:var(--ag-border); }

/* CHALLENGE CARD */
.challenge-card { border-radius:12px; padding:20px; animation:slideIn 0.4s ease; }
@keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.for-theme  .challenge-card { background:rgba(42,31,14,0.06); border:1px solid var(--for-border); }
.ag-theme   .challenge-card { background:rgba(68,147,248,0.07); border:1px solid rgba(68,147,248,0.2); }

.ch-label { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
.for-theme .ch-label { color:var(--for-mid); }
.ag-theme  .ch-label { color:var(--ag-mid); }

.hint-pill { padding:2px 8px; border-radius:4px; font-size:9px; }
.for-theme .hint-pill { background:rgba(42,31,14,0.08); color:var(--for-dim); }
.ag-theme  .hint-pill { background:rgba(255,255,255,0.06); color:var(--ag-dim); }

.ch-text { font-family:'Playfair Display',serif; font-size:15px; line-height:1.75; font-style:italic; }
.for-theme .ch-text { color:var(--for-text); }
.ag-theme  .ch-text { color:var(--ag-text); }

/* REBUTTAL */
.reb-label { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; margin-bottom:7px; }
.for-theme .reb-label { color:var(--for-mid); }
.ag-theme  .reb-label { color:var(--ag-mid); }

.reb-ta { width:100%; border-radius:10px; padding:13px 15px; font-family:'DM Sans',sans-serif; font-size:14px; line-height:1.7; outline:none; resize:vertical; min-height:90px; transition:border-color 0.2s, box-shadow 0.2s; }
.for-theme .reb-ta { background:var(--for-surface); border:1px solid var(--for-border); color:var(--for-text); }
.for-theme .reb-ta:focus { border-color:var(--for-accent); box-shadow:0 0 0 3px var(--for-glow); }
.ag-theme  .reb-ta { background:rgba(255,255,255,0.04); border:1px solid var(--ag-border); color:var(--ag-text); }
.ag-theme  .reb-ta:focus { border-color:var(--ag-accent); box-shadow:0 0 0 3px var(--ag-glow); }
.reb-ta::placeholder { opacity:0.35; }

.submit-btn { width:100%; padding:13px; border:none; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; color:white; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
.for-theme  .submit-btn { background:var(--for-accent); box-shadow:0 4px 16px rgba(193,127,36,0.3); }
.for-theme  .submit-btn:hover:not(:disabled) { transform:translateY(-1px); }
.ag-theme   .submit-btn { background:var(--ag-accent); box-shadow:0 4px 16px rgba(68,147,248,0.3); }
.ag-theme   .submit-btn:hover:not(:disabled) { transform:translateY(-1px); }
.submit-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }

/* SCORE CARD */
.score-card { border-radius:12px; padding:20px; animation:slideIn 0.4s ease; }
.for-theme .score-card { background:var(--for-surface); border:1px solid var(--for-border); }
.ag-theme  .score-card { background:rgba(255,255,255,0.04); border:1px solid var(--ag-border); }

.score-dims { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:14px; }
.score-dim { text-align:center; }
.sdim-num { font-family:'Playfair Display',serif; font-size:28px; font-weight:900; line-height:1; margin-bottom:2px; }
.for-theme .sdim-num { color:var(--for-accent); }
.ag-theme  .sdim-num { color:var(--ag-accent); }
.sdim-lbl { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px; }
.for-theme .sdim-lbl { color:var(--for-dim); }
.ag-theme  .sdim-lbl { color:var(--ag-dim); }
.sdim-cmt { font-size:11px; line-height:1.5; }
.for-theme .sdim-cmt { color:var(--for-mid); }
.ag-theme  .sdim-cmt { color:var(--ag-mid); }

.verdict-row { display:flex; gap:14px; align-items:flex-start; padding-top:14px; border-top:1px solid; }
.for-theme .verdict-row { border-color:var(--for-border); }
.ag-theme  .verdict-row { border-color:var(--ag-border); }
.v-overall { font-family:'Playfair Display',serif; font-size:38px; font-weight:900; line-height:1; flex-shrink:0; }
.for-theme .v-overall { color:var(--for-accent); }
.ag-theme  .v-overall { color:var(--ag-accent); }
.v-text { font-size:13px; line-height:1.6; }
.for-theme .v-text { color:var(--for-mid); }
.ag-theme  .v-text { color:var(--ag-mid); }

.stronger-box { margin-top:14px; padding:12px 15px; border-radius:8px; border-left:3px solid; }
.for-theme .stronger-box { background:var(--for-glow); border-color:var(--for-accent); }
.ag-theme  .stronger-box { background:var(--ag-glow);  border-color:var(--ag-accent); }
.stronger-lbl { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:5px; }
.for-theme .stronger-lbl { color:var(--for-accent); }
.ag-theme  .stronger-lbl { color:var(--ag-accent); }
.stronger-txt { font-size:12.5px; line-height:1.6; }
.for-theme .stronger-txt { color:var(--for-text); }
.ag-theme  .stronger-txt { color:var(--ag-text); }

/* BATTLE ACTIONS */
.battle-actions { display:flex; gap:9px; flex-wrap:wrap; }
.next-btn { flex:1; padding:13px; border:none; border-radius:10px; font-family:'Playfair Display',serif; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.2s; min-width:140px; }
.for-theme .next-btn { background:var(--for-accent); color:white; }
.for-theme .next-btn:hover { transform:translateY(-1px); }
.ag-theme  .next-btn { background:var(--ag-accent); color:white; }
.ag-theme  .next-btn:hover { transform:translateY(-1px); }
.end-btn { padding:13px 20px; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; background:transparent; transition:all 0.2s; }
.for-theme .end-btn { border:1px solid var(--for-border); color:var(--for-mid); }
.for-theme .end-btn:hover { border-color:var(--for-accent); color:var(--for-accent); }
.ag-theme  .end-btn { border:1px solid var(--ag-border); color:var(--ag-mid); }
.ag-theme  .end-btn:hover { border-color:var(--ag-accent); color:var(--ag-accent); }

/* RETRY */
.retry-btn { width:100%; padding:11px; border-radius:10px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1px; text-transform:uppercase; cursor:pointer; background:transparent; transition:all 0.15s; }
.for-theme .retry-btn { border:1px solid var(--for-border); color:var(--for-accent); }
.ag-theme  .retry-btn { border:1px solid var(--ag-border);  color:var(--ag-accent); }

/* END SCREEN */
.end-screen { min-height:70vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:40px 20px; text-align:center; }
.end-trophy { font-size:52px; animation:bounce 0.6s ease; }
@keyframes bounce { 0%{transform:scale(0.5)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
.end-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:900; }
.for-theme .end-title { color:var(--for-text); }
.ag-theme  .end-title { color:var(--ag-text); }
.end-score { font-family:'Playfair Display',serif; font-size:64px; font-weight:900; line-height:1; }
.for-theme .end-score { color:var(--for-accent); }
.ag-theme  .end-score { color:var(--ag-accent); }
.end-sub { font-size:13px; }
.for-theme .end-sub { color:var(--for-mid); }
.ag-theme  .end-sub { color:var(--ag-mid); }
.end-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:6px; }

/* LOADING */
.loading-card { border-radius:12px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:12px; animation:slideIn 0.3s ease; }
.for-theme .loading-card { background:rgba(42,31,14,0.05); border:1px solid var(--for-border); }
.ag-theme  .loading-card { background:rgba(68,147,248,0.06); border:1px solid rgba(68,147,248,0.15); }
.ld-spin { width:24px; height:24px; border-radius:50%; border:2px solid; border-top-color:transparent; animation:spin 0.8s linear infinite; }
.for-theme .ld-spin { border-color:var(--for-border); border-top-color:var(--for-accent); }
.ag-theme  .ld-spin { border-color:var(--ag-border);  border-top-color:var(--ag-accent); }
.ld-lbl { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }
.for-theme .ld-lbl { color:var(--for-mid); }
.ag-theme  .ld-lbl { color:var(--ag-mid); }
@keyframes spin { to { transform:rotate(360deg); } }

.setup-spin { width:22px; height:22px; border-radius:50%; border:2px solid rgba(232,201,106,0.3); border-top-color:var(--n-accent); animation:spin 0.8s linear infinite; display:inline-block; }

/* ERROR */
.err-box { padding:13px 16px; border-radius:10px; font-size:12px; font-family:'DM Mono',monospace; background:rgba(248,113,113,0.1); border:1px solid rgba(248,113,113,0.2); color:#f87171; line-height:1.6; }

/* TOAST */
.toast { position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.88); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 16px; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1px; color:#f0f0f0; z-index:1000; animation:fadeUp 0.3s ease; }
@keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

@media (max-width:480px) {
  .score-dims { grid-template-columns:1fr; gap:10px; }
  .config-row { grid-template-columns:1fr; }
  .battle-actions { flex-direction:column; }
  .next-btn { min-width:unset; }
}
`;

// ── MAIN ──────────────────────────────────────────────────────────
function DebateCoachApp() {
  const [topic, setTopic]       = useState("");
  const [domain, setDomain]     = useState("General");
  const [tone, setTone]         = useState("Combative");
  const [rounds, setRounds]     = useState("3");

  const [screen, setScreen]     = useState("setup");
  const [theme, setTheme]       = useState("sides-theme");
  const [sides, setSides]       = useState(null);
  const [userSide, setUserSide] = useState(null);
  const [userPosition, setUserPosition]     = useState("");
  const [opponentPosition, setOpponentPosition] = useState("");

  const [round, setRound]       = useState(1);
  const [challenge, setChallenge]   = useState(null);
  const [rebuttal, setRebuttal]     = useState("");
  const [scoreData, setScoreData]   = useState(null);
  const [allScores, setAllScores]   = useState([]);
  const [pendingNext, setPendingNext] = useState(null); // next challenge pre-fetched

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [toast, setToast]       = useState(null);

  const battleRef = useRef(null);
  const maxRounds = rounds === "Unlimited" ? Infinity : parseInt(rounds);

  function showToast(m) { setToast(m); setTimeout(() => setToast(null), 2200); }

  // ── GENERATE SIDES ─────────────────────────────────────────
  async function generateSides() {
    if (!topic.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const { system, user } = buildSidesPrompt(topic.trim(), domain, tone);
      const raw  = await callGemini(system, user, 900);
      const data = parseJSON(raw);
      if (!data?.for?.arguments || !data?.against?.arguments)
        throw new Error("Could not parse arguments. Please try again.");
      setSides(data);
      setScreen("sides");
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  // ── PICK SIDE ───────────────────────────────────────────────
  async function pickSide(side, sidesData) {
    const uPos = side === "for" ? sidesData.for.position : sidesData.against.position;
    const oPos = side === "for" ? sidesData.against.position : sidesData.for.position;
    setUserSide(side);
    setUserPosition(uPos);
    setOpponentPosition(oPos);
    setTheme(side === "for" ? "for-theme" : "ag-theme");
    setRound(1);
    setAllScores([]);
    setScoreData(null);
    setPendingNext(null);
    setRebuttal("");
    setError(null);
    setScreen("battle");
    // Fetch first challenge
    await fetchFirstChallenge(sidesData.topic || topic, uPos, oPos, 1);
  }

  // ── FETCH FIRST CHALLENGE ───────────────────────────────────
  async function fetchFirstChallenge(t, uPos, oPos, roundNum) {
    setLoading(true); setError(null); setChallenge(null);
    try {
      const { system, user } = buildRoundPrompt(t, uPos, oPos, roundNum, tone, null, null);
      const raw  = await callGemini(system, user, 400);
      const data = parseJSON(raw);
      if (!data?.challenge) throw new Error("Could not generate challenge. Try again.");
      setChallenge(data);
      setTimeout(() => battleRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 200);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  // ── SUBMIT REBUTTAL ─────────────────────────────────────────
  // BUG FIX: Combined score + next challenge in ONE call
  async function submitRebuttal() {
    if (!rebuttal.trim() || loading) return;
    setLoading(true); setError(null);
    const isLastRound = maxRounds !== Infinity && round >= maxRounds;

    try {
      const t = sides?.topic || topic;

      if (isLastRound) {
        // Final round — just score
        const { system, user } = buildFinalScorePrompt(t, userPosition, challenge.challenge, rebuttal, tone);
        const raw  = await callGemini(system, user, 600);
        const data = parseJSON(raw);
        if (!data?.score) throw new Error("Could not score rebuttal. Try again.");
        const s = data.score;
        setScoreData(s);
        setAllScores(prev => [...prev, s.overall]);
      } else {
        // Not last — score AND get next challenge in one call
        const { system, user } = buildRoundPrompt(t, userPosition, opponentPosition, round, tone, rebuttal, challenge.challenge);
        const raw  = await callGemini(system, user, 900);
        const data = parseJSON(raw);
        if (!data?.score) throw new Error("Could not score rebuttal. Try again.");
        const s = data.score;
        setScoreData(s);
        setAllScores(prev => [...prev, s.overall]);
        // Cache next challenge
        if (data.next_challenge) setPendingNext(data.next_challenge);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  // ── NEXT ROUND ──────────────────────────────────────────────
  // BUG FIX: uses pre-fetched challenge if available, passes updated scores directly
  function nextRound() {
    const nextR = round + 1;
    if (maxRounds !== Infinity && round >= maxRounds) {
      setScreen("end");
      return;
    }
    setRound(nextR);
    setRebuttal("");
    setScoreData(null);
    setError(null);

    if (pendingNext) {
      // Use pre-fetched challenge — zero extra API call
      setChallenge(pendingNext);
      setPendingNext(null);
      setTimeout(() => battleRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 200);
    } else {
      // Fallback: fetch fresh challenge
      fetchFirstChallenge(sides?.topic || topic, userPosition, opponentPosition, nextR);
    }
  }

  // ── RETRY ───────────────────────────────────────────────────
  async function retryChallenge() {
    await fetchFirstChallenge(sides?.topic || topic, userPosition, opponentPosition, round);
  }

  // ── SESSION SCORE ───────────────────────────────────────────
  const sessionScore = allScores.length
    ? Math.round(allScores.reduce((a,b) => a+b, 0) / allScores.length)
    : 0;
  const trophy = sessionScore >= 8 ? "🏆" : sessionScore >= 6 ? "🥈" : "🥉";
  const isLastRound = maxRounds !== Infinity && round >= maxRounds;

  // ── RENDER: SETUP ───────────────────────────────────────────
  if (screen === "setup") return (
    <>
      <style>{css}</style>
      <div className="setup">
          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname">Debate<span>Coach</span></h1>
              <p className="header-tagline">Master both sides of any argument</p>
            </div>
          </header>
        <div className="setup-bg" />
        <div className="setup-inner">
          <div className="setup-badge">DebateCoach</div>
          <div className="setup-title">Argue <em>both</em> sides.<br/>Win every room.</div>
          <div className="setup-sub">Enter any topic. Get the strongest case for and against.<br/>Pick your side. Survive the counterattack.</div>

          <input className="topic-input" placeholder="e.g. AI will do more harm than good…" value={topic}
            onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && generateSides()} />

          <div className="chips">
            {SUGGESTED.map(s => <div className="chip" key={s} onClick={() => setTopic(s)}>{s}</div>)}
          </div>

          <div className="config-row">
            <div className="config-group">
              <label className="cfg-label">Domain</label>
              <select className="cfg-select" value={domain} onChange={e => setDomain(e.target.value)}>
                {DOMAINS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="config-group">
              <label className="cfg-label">Opponent Tone</label>
              <select className="cfg-select" value={tone} onChange={e => setTone(e.target.value)}>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="config-group">
              <label className="cfg-label">Rounds</label>
              <select className="cfg-select" value={rounds} onChange={e => setRounds(e.target.value)}>
                {ROUNDS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="err-box" style={{marginBottom:14}}>⚠ {error}</div>}

          <button className="start-btn" onClick={generateSides} disabled={loading || !topic.trim()}>
            {loading ? <><div className="setup-spin" style={{marginRight:10}} />Building arguments…</> : "Build Both Sides →"}
          </button>
        </div>
      </div>
    </>
  );

  // ── RENDER: SIDES ───────────────────────────────────────────
  if (screen === "sides") return (
    <>
      <style>{css}</style>
      <div className={`arena sides-theme`}>
        <header className="arena-hdr">
          <button className="back-btn" onClick={() => setScreen("setup")}>← Back</button>
          <div className="arena-topic">"{sides?.topic || topic}"</div>
          <div className="arena-meta">Pick a side</div>
          <span className="jl-mark">JL</span>
        </header>
        <div className="sides-wrap">
          {/* FOR */}
          <div className="side-card side-for" onClick={() => pickSide("for", sides)}>
            <div className="side-tag">▲ For</div>
            <div className="side-position">{sides?.for?.position}</div>
            {sides?.for?.arguments?.map((a, i) => (
              <div className="arg-card" key={i}>
                <div className="arg-title">{a.title}</div>
                <div className="arg-body">{a.body}</div>
              </div>
            ))}
            <div className="pick-cta">⚖ Defend this position</div>
          </div>
          {/* AGAINST */}
          <div className="side-card side-ag" onClick={() => pickSide("against", sides)}>
            <div className="side-tag">▼ Against</div>
            <div className="side-position">{sides?.against?.position}</div>
            {sides?.against?.arguments?.map((a, i) => (
              <div className="arg-card" key={i}>
                <div className="arg-title">{a.title}</div>
                <div className="arg-body">{a.body}</div>
              </div>
            ))}
            <div className="pick-cta">⚖ Defend this position</div>
          </div>
        </div>
      </div>
    </>
  );

  // ── RENDER: BATTLE ──────────────────────────────────────────
  if (screen === "battle") return (
    <>
      <style>{css}</style>
      <div className={`arena ${theme}`}>
        <header className="arena-hdr">
          <button className="back-btn" onClick={() => {
            setScreen("sides"); setChallenge(null); setScoreData(null);
            setRebuttal(""); setPendingNext(null); setError(null);
          }}>← Sides</button>
          <div className="arena-topic" style={{fontStyle:"normal", fontSize:12}}>
            <em style={{fontStyle:"italic"}}>{userPosition?.slice(0,55)}{userPosition?.length > 55 ? "…" : ""}</em>
          </div>
          <div className="arena-meta">{rounds === "Unlimited" ? `Round ${round}` : `${round}/${maxRounds}`}</div>
        </header>

        <div className="battle-zone" ref={battleRef}>
          <div className="round-strip">
            <div className="round-pill">Round {round}</div>
            <div className="round-line" />
            <div className="round-pill" style={{opacity:0.6, fontSize:8}}>{tone} · {domain}</div>
          </div>

          {/* Loading */}
          {loading && !challenge && (
            <div className="loading-card">
              <div className="ld-spin" />
              <div className="ld-lbl">Preparing challenge…</div>
            </div>
          )}

          {/* Error with retry */}
          {error && !loading && (
            <>
              <div className="err-box">⚠ {error}</div>
              {!challenge && <button className="retry-btn" onClick={retryChallenge}>↻ Retry</button>}
            </>
          )}

          {/* Challenge */}
          {challenge && (
            <div className="challenge-card">
              <div className="ch-label">
                Opponent's challenge
                {challenge.hint && <span className="hint-pill">{challenge.hint}</span>}
              </div>
              <div className="ch-text">"{challenge.challenge}"</div>
            </div>
          )}

          {/* Rebuttal */}
          {challenge && !scoreData && (
            <>
              <div>
                <div className="reb-label">Your rebuttal</div>
                <textarea className="reb-ta" rows={4}
                  placeholder="Counter their argument directly. Be specific…"
                  value={rebuttal} onChange={e => setRebuttal(e.target.value)} />
              </div>
              {error && !loading && <div className="err-box">⚠ {error}</div>}
              <button className="submit-btn" onClick={submitRebuttal} disabled={loading || !rebuttal.trim()}>
                {loading
                  ? <><div className="ld-spin" style={{width:14,height:14,borderWidth:2}} />
                      {isLastRound ? "Judging final round…" : "Scoring & loading next…"}
                    </>
                  : "Submit Rebuttal →"}
              </button>
            </>
          )}

          {/* Score */}
          {scoreData && (
            <>
              <div className="score-card">
                <div className="score-dims">
                  {Object.entries(scoreData.scores || scoreData).filter(([k]) => ["logic","evidence","rebuttal"].includes(k)).map(([key, val]) => (
                    <div className="score-dim" key={key}>
                      <div className="sdim-num">{val.score}</div>
                      <div className="sdim-lbl">{key}</div>
                      <div className="sdim-cmt">{val.comment}</div>
                    </div>
                  ))}
                </div>
                <div className="verdict-row">
                  <div className="v-overall">{scoreData.overall}</div>
                  <div className="v-text">{scoreData.verdict}</div>
                </div>
                {scoreData.stronger_rebuttal && (
                  <div className="stronger-box">
                    <div className="stronger-lbl">Stronger rebuttal</div>
                    <div className="stronger-txt">{scoreData.stronger_rebuttal}</div>
                  </div>
                )}
              </div>

              <div className="battle-actions">
                <button className="end-btn" onClick={() => setScreen("end")}>End Session</button>
                {(rounds === "Unlimited" || round < maxRounds) ? (
                  <button className="next-btn" onClick={nextRound} disabled={loading}>
                    {loading ? "Loading…" : `Round ${round + 1} →`}
                  </button>
                ) : (
                  <button className="next-btn" onClick={() => setScreen("end")}>
                    See Final Score →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  // ── RENDER: END ─────────────────────────────────────────────
  if (screen === "end") return (
    <>
      <style>{css}</style>
      <div className={`arena ${theme}`}>
        <header className="arena-hdr">
          <button className="back-btn" onClick={() => { setScreen("setup"); setSides(null); setTopic(""); }}>← New Debate</button>
          <div className="arena-topic">Session Complete</div>
          <div className="arena-meta">{allScores.length} round{allScores.length !== 1 ? "s" : ""}</div>
        <span className="jl-mark">JL</span>
        </header>
        <div className="end-screen">
          <div className="end-trophy">{allScores.length === 0 ? "👋" : trophy}</div>
          <div className="end-title">Session Score</div>
          <div className="end-score">
            {allScores.length === 0 ? "—" : sessionScore}
            <span style={{fontSize:28}}>/10</span>
          </div>
          <div className="end-sub">
            {allScores.length === 0
              ? "No rounds completed"
              : `${allScores.length} round${allScores.length !== 1 ? "s" : ""} · defending ${userSide === "for" ? "For" : "Against"} · ${tone} opponent`}
          </div>
          <div className="end-actions">
            <button className="next-btn" style={{padding:"12px 24px"}} onClick={() => pickSide(userSide, sides)}>Rematch →</button>
            <button className="end-btn" onClick={() => { setScreen("sides"); setRound(1); setAllScores([]); setScoreData(null); setChallenge(null); }}>Switch Side</button>
            <button className="end-btn" onClick={() => { setScreen("setup"); setSides(null); setTopic(""); }}>New Topic</button>
          </div>
        </div>
      </div>
    </>
  );

          <footer className="site-footer" style={{marginTop:"auto"}}>
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
  return null;
}

export default function DebateCoach() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("debate-coach");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <DebateCoachApp />
    </>
  );
}
