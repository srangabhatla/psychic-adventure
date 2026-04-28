/**
 * Story Bible Builder — Janardhan Labs
 * Agentic 5-step story bible generator.
 * Uses user's own Gemini API key (not Jan Labs backend).
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const MODELS = [
 "gemini-2.5-flash-lite",
 "gemini-2.5-flash",
 "gemini-2.0-flash-lite"
];



// ── TEST MODE ─────────────────────────────────────────────────────────────────
// Set to true to run the full UI flow without any API key.
// Every step returns mock output instantly. Flip to false before production.
const TEST_MODE = false;
const LS_KEY = "story_bible_gemini_key";
const MAX_HIST = 30;

function addToHistory(history, item){

 const newHistory = [...history, item];

 if(newHistory.length > MAX_HIST){

  return newHistory.slice(-MAX_HIST);

 }

 return newHistory;

}

// ── KEY HELPERS — never store or display the raw key ─────────────────────────
const encodeKey = k => btoa(unescape(encodeURIComponent(k)));
const decodeKey = s => { try { return decodeURIComponent(escape(atob(s))); } catch { return ""; } };
const maskKey   = k => k ? "AIza" + "●".repeat(8) + "…" + k.slice(-3) : "";

const MOCK = {
  call0: `=== SECTION 1: WORLD RULES ===

**SETTING OVERVIEW:**
Kerala, 1987 and 2023 bleeding into each other at the seams. The air smells of laterite dust and old rain. The Periyar carries silt the colour of forgotten things. Strangers sense something is wrong with the light here — it falls at angles that don't match the sun's position.

**THE THREE LAWS OF THIS WORLD:**
Law 1: The river remembers everything — but memory here is not evidence. The more clearly Arun hears it, the less anyone else will believe him.
Law 2: The past is accessible only through grief. Joy closes it off entirely.
Law 3: Truth is not suppressed here — it is diluted. Everyone holds a true fragment. No single fragment adds up to the whole.

**POWER ANATOMY:**
The family elders hold power through narrative monopoly — they decide which version of events is repeated at weddings and funerals until it becomes true. They sacrifice accuracy to preserve dignity. What they pretend not to know: that Arun's grandmother made a choice no one has named.

**THE WOUND BENEATH THE SURFACE:**
A drowning that was called an accident. The river knows otherwise. The family knows otherwise. The official story was chosen not to protect the dead, but to protect the living who were there.

=== SECTION 2: CHARACTERS ===

**PROTAGONIST:**
Arun Pillai, 41. Teaches Malayalam literature at a government school nobody applied to. Wants to be the person who finally tells the true story — but lies to himself that he wants this for justice, not to feel exceptional. His flaw: he mistakes understanding for intimacy; he analyses people instead of loving them. His left hand trembles slightly when he is near the river.

**ANTAGONIST:**
His uncle Madhavan, 68. Retired civil servant. Core belief: a family's dignity is a collective resource that individuals have no right to spend. He is right — Arun's truth-telling will destroy three people who built entire lives on the silence.

**THE FOIL:**
Leela, Arun's student, 17. Says: "Sir, if a story is beautiful enough, does it matter if it happened?" She is what Arun becomes if he chooses beauty over truth.

**THE WILDCARD:**
The ferryman Ouseph. Surface role: boatman. Actually searching for: whether he made the right choice the night of the drowning, when he saw something and said nothing.

**THE CENTRAL DYNAMIC:**
Madhavan offers Arun the one thing he most needs — to belong to this family — on the condition that he stops asking what the river is saying.`,

  call1: `=== SECTION 3: CONFLICT & THEMES ===

**THE ENGINE:**
Arun's dead grandmother's diary surfaces during a house demolition — its account of her final year contradicts every family story told about her death for 35 years.

**THE REAL FIGHT:**
Arun has spent his life teaching other people's stories because he does not trust his own perception of reality. The river is either confirming he is valid — or it is the final proof he has lost his mind.

**CORE THEME:**
Is a truth that destroys people's ability to live worth telling?

**SHADOW THEMES:**
1. Whether inheritance is gift or debt — Arun did not ask to hear the river or carry this grief.
2. The violence of accurate memory in a culture built on curated forgetting.

**THE LINE NO ONE SAYS:**
"We knew. We all knew. We decided you were better off not knowing." — Madhavan, final act.

=== SECTION 4: STORY ARC ===

**ACT ONE — THE RUPTURE:**
Arun has achieved a tolerable life by not asking questions. The diary destroys this — the worst possible moment: he finds it the same week he is being considered for a position that would finally make him respectable in his family's eyes.

**ACT TWO — THE DESCENT:**
He tries research — it doesn't fit. He tries confronting Madhavan — who offers a more coherent, comfortable, almost certainly false version. He tries fictionalising it — wins a prize. He feels sick.

**ACT THREE — THE CRUCIBLE:**
To reach the truth he must destroy his own need to be believed. He must decide whether to speak it anyway, knowing it will cost him the family position, the job, and possibly his reputation for sanity.

**THE SERIES SPINE:**
What do the living owe the dead? Across volumes — what other silences does this family run on, and who else is paying the interest?

**ENDING REGISTER:**
Pyrrhic and unresolved. Arun speaks. Some believe him. The family fractures along fault lines that were always there. The river continues. He is not healed. But he is no longer lying.

=== SECTION 5: VISUAL & TONE DNA ===

**COLOUR PALETTE:**
Laterite red — the soil that stains everything; the past that cannot be washed off.
Monsoon grey-green — the river in memory; the version of events that feels true but cannot be proven.
Turmeric yellow — the colour of ceremony, of what the family performs in public.
Ink black — appears only in diary pages; the one account never meant to be read.

**PANEL RHYTHM:**
Present-day: sparse, 3-4 panels, significant white space — the silence of a man who has learned not to speak. Memory scenes: dense, 7-8 panels, overlapping borders. The rhythm breaks to a single full-page panel exactly twice: when Arun first hears the river clearly, and when he finally speaks.

**THE RECURRING MOTIF:**
A wooden oar. At the start it is Ouseph's tool. By the end it has appeared as a classroom pointer, a coffin edge, a pen, a divining rod. In the final image it is still. Pointing nowhere. Or everywhere.

**LIGHT PHILOSOPHY:**
Late afternoon Kerala light just before the rains — golden and slightly wrong, familiar places looking like photographs of themselves. Not dramatic darkness. The uncanny of the almost-ordinary.

**THREE REFERENCE TOUCHSTONES:**
1. Mani Ratnam's Mouna Ragam — the quality of silence between people who once knew each other as something else.
2. Marquez's In Evil Hour — a community's secrets visible to everyone except the people keeping them.
3. Satyajit Ray's Charulata — an intelligent person trapped in a life that cannot hold their intelligence.

**ARTIST BRIEF:**
Draw Kerala without its postcard self. No backwater romance, no lush tourism green. Draw the mildew on old house walls. The specific orange of a government school corridor. Avoid: boats at sunset, temple festivals, coconut palms as beauty. The one image: Arun at the river's edge, facing away, water the same colour as sky, no horizon visible.`,
};

// ── REDO PROMPTS — one per section, ~400 tokens each ─────────────────────────
// Used only for Redo. Single section, single call, ~half the tokens of a full call.
const REDO = {
  0: d => `${seed(d)}\n\nRewrite ONLY the WORLD RULES section of this story bible.\n\n**SETTING OVERVIEW:**\n3 sentences. Smell it, feel the temperature, sense who is unwelcome. Zero tourism language.\n\n**THE THREE LAWS OF THIS WORLD:**\n3 rules. Each must contain an internal contradiction — the world's logic must betray itself.\n\n**POWER ANATOMY:**\nWho holds power? What do they sacrifice? What do they pretend not to know?\n\n**THE WOUND BENEATH THE SURFACE:**\nWhat happened that no one discusses? What lie does this society tell itself every morning?`,

  1: d => `${seed(d)}\n\nRewrite ONLY the CHARACTERS section of this story bible.\n\n**PROTAGONIST:**\nName, role, what they want, the lie they tell themselves about why, their real flaw, one physical detail that reveals character.\n\n**ANTAGONIST:**\nName, role, core belief — and why they are RIGHT from within their own logic.\n\n**THE FOIL:**\nName, function, one line of dialogue that defines them entirely.\n\n**THE WILDCARD:**\nName, surface role, what they are actually searching for.\n\n**THE CENTRAL DYNAMIC:**\nThe tension between protagonist and antagonist. One precise sentence.`,

  2: d => `${seed(d)}\n\nRewrite ONLY the CONFLICT AND THEMES section of this story bible.\n\n**THE ENGINE:**\nExternal plot mechanism in one sharp sentence.\n\n**THE REAL FIGHT:**\nThe internal conflict the external plot illuminates. Uncomfortably personal.\n\n**CORE THEME:**\nThe question this story asks but refuses to answer. Phrase as a question.\n\n**SHADOW THEMES:**\nTwo themes that complicate (not reinforce) the core theme.\n\n**THE LINE NO ONE SAYS:**\nThe dialogue that could end the story if anyone were honest enough to say it.`,

  3: d => `${seed(d)}\n\nRewrite ONLY the STORY ARC section of this story bible.\n\n**ACT ONE — THE RUPTURE:**\nFalse equilibrium + what shatters it + why this is the worst moment.\n\n**ACT TWO — THE DESCENT:**\nOld strategies fail. What is lost. What was wrong.\n\n**ACT THREE — THE CRUCIBLE:**\nWhat the protagonist must destroy in themselves. The cost of winning.\n\n**THE SERIES SPINE:**\nThe question one story cannot contain.\n\n**ENDING REGISTER:**\nTragedy, pyrrhic victory, dark triumph, or something that refuses categorisation. One honest sentence.`,

  4: d => `${seed(d)}\n\nRewrite ONLY the VISUAL AND TONE DNA section of this story bible.\n\n**COLOUR PALETTE:**\n4 colours. Format: [Name] — [meaning in THIS world].\n\n**PANEL RHYTHM:**\nDense/claustrophobic or sparse/cinematic? When does it break and what does that signal?\n\n**THE RECURRING MOTIF:**\nOne visual symbol transformed by context. Start meaning vs end meaning.\n\n**LIGHT PHILOSOPHY:**\nNot "dark" — the specific quality. Sodium orange of wet asphalt. Blue-white of a screen in a dark room.\n\n**THREE REFERENCE TOUCHSTONES:**\nThree works this story is in conversation with. One sentence each on feeling, not plot.\n\n**ARTIST BRIEF:**\nOne paragraph: what to AVOID, texture of surfaces, the one image that makes this world instantly recognisable.`,
};
const STEPS = [
  { id:0, icon:"◈", title:"World Rules"       },
  { id:1, icon:"◉", title:"Characters"        },
  { id:2, icon:"◆", title:"Conflict & Themes" },
  { id:3, icon:"◐", title:"Story Arc"         },
  { id:4, icon:"◇", title:"Visual & Tone DNA" },
];

// 2 API calls — each covers multiple sections
const CALLS = [
  { id:0, msg:"Forging world and characters..."        },
  { id:1, msg:"Weaving themes, arc and visual DNA..."  },
];

// ── GENRES ───────────────────────────────────────────────────────────────────
const GENRES = [
  "Divine Bureaucracy Dark Comedy",
  "Cosmic Horror Philosophical Sci-Fi",
  "Sacred Games-Style Crime Drama",
  "Mythpunk Urban Fantasy",
  "Body Horror Sci-Fi",
  "Noir Revenge Thriller",
  "Literary Magical Realism",
  "Dystopian Survival Drama",
  "Psychological Folk Horror",
  "Heist Caper Comedy",
];

// ── SYSTEM PROMPT (Claude-engineered) ─────────────────────────────────────────
// Compressed system prompt — rules baked in, no fluff
const SYS = `Story bible writer. Literary sensibility, screenwriter structure.
RULES: Be SPECIFIC not general. Power shown through what people fear to say. Characters: want vs self-lie, never the same. Settings: what decayed, smells wrong. FORBIDDEN: chosen ones, prophecies, reluctant heroes. World rules have internal contradictions. Themes are questions not answers.
FORMAT: **LABEL:** before each section. No preamble. Start immediately. Be vivid, ruthless.`;

// ── COMPRESSED SEED — ~40 tokens, passed once per call ───────────────────────
const seed = d =>
  `T:"${d.t}" G:${d.g} P:${d.p} S:${d.s} C:${d.c.slice(0,100)}${d.tone ? " Tone:"+d.tone.slice(0,60) : ""}`;

// ── 2-CALL PROMPTS ────────────────────────────────────────────────────────────
// Call 0: World Rules + Characters (~900 tokens out, 1 API call)
// Call 1: Conflict + Arc + Visual DNA (~1100 tokens out, 1 API call)
// Total: 2 calls vs old 5 — 60% fewer rate limit hits
const PROMPTS = {
  // Call 0: World + Characters in one request
  call0: d => `${seed(d)}

Write TWO sections of a story bible. Label each clearly.

=== SECTION 1: WORLD RULES ===

**SETTING OVERVIEW:**
3 sentences. Smell it, feel the temperature, sense who is unwelcome. Zero tourism language.

**THE THREE LAWS OF THIS WORLD:**
3 rules. Each must contain an internal contradiction — the world's logic must betray itself.

**POWER ANATOMY:**
Who holds power? What do they sacrifice? What do they pretend not to know?

**THE WOUND BENEATH THE SURFACE:**
What happened that no one discusses? What lie does this society tell itself every morning?

=== SECTION 2: CHARACTERS ===

**PROTAGONIST:**
Name, role, what they want, the lie they tell themselves about why they want it, their real flaw (not a quirk — one that will cost them something), one physical detail that reveals character.

**ANTAGONIST:**
Name, role, core belief — and why they are RIGHT from within their own logic.

**THE FOIL:**
Name, function, one line of dialogue that defines them entirely.

**THE WILDCARD:**
Name, surface role, what they are actually searching for.

**THE CENTRAL DYNAMIC:**
The tension between protagonist and antagonist. One precise sentence.`,

  // Call 1: Conflict + Arc + Visual in one request
  call1: d => `${seed(d)}

Write THREE sections of a story bible. Label each clearly.

=== SECTION 3: CONFLICT & THEMES ===

**THE ENGINE:**
External plot mechanism in one sharp sentence.

**THE REAL FIGHT:**
The internal conflict the external plot illuminates. Uncomfortably personal.

**CORE THEME:**
The question this story asks but refuses to answer. Phrase as a question.

**SHADOW THEMES:**
Two themes that complicate (not reinforce) the core theme.

**THE LINE NO ONE SAYS:**
The dialogue that could end the story if anyone were honest enough to say it.

=== SECTION 4: STORY ARC ===

**ACT ONE — THE RUPTURE:**
False equilibrium + what shatters it + why this is the worst moment.

**ACT TWO — THE DESCENT:**
Old strategies fail. What is lost. What was wrong.

**ACT THREE — THE CRUCIBLE:**
What the protagonist must destroy in themselves. The cost of winning.

**THE SERIES SPINE:**
The question one story cannot contain.

**ENDING REGISTER:**
Tragedy, pyrrhic victory, dark triumph, or something that refuses categorisation. One honest sentence.

=== SECTION 5: VISUAL & TONE DNA ===

**COLOUR PALETTE:**
4 colours. Format: [Name] — [meaning in THIS world].

**PANEL RHYTHM:**
Dense/claustrophobic or sparse/cinematic? When does it break and what does that signal?

**THE RECURRING MOTIF:**
One visual symbol transformed by context. Start meaning vs end meaning.

**LIGHT PHILOSOPHY:**
Not "dark" — the specific quality. Sodium orange of wet asphalt. Blue-white of a screen in a dark room.

**THREE REFERENCE TOUCHSTONES:**
Three works this story is in conversation with. One sentence each on feeling, not plot.

**ARTIST BRIEF:**
One paragraph: what to AVOID, texture of surfaces, the one image that makes this world instantly recognisable.`,
};

// STYLES 
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600&family=IM+Fell+English:ital@0;1&display=swap');

  .sbb-wrap * { box-sizing: border-box; margin: 0; padding: 0; }

  .sbb-wrap {
    min-height: 100vh;
    background: #0a0705;
    color: #d4c9b8;
    font-family: 'IM Fell English', Georgia, serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* back button */
  .sbb-back {
    position: fixed; top: 14px; left: 16px; z-index: 200;
    background: rgba(10,7,5,0.85); border: 1px solid rgba(201,168,76,0.25);
    color: #7a6230; font-family: 'Cinzel', serif; font-size: 10px;
    letter-spacing: 2px; text-transform: uppercase; padding: 7px 14px;
    border-radius: 6px; cursor: pointer; transition: all 0.2s;
    backdrop-filter: blur(6px);
  }
  .sbb-back:hover { color: #c9a84c; border-color: rgba(201,168,76,0.5); }

  .sbb-inner {
    max-width: 680px; margin: 0 auto;
    padding: 56px 16px 60px;
  }

  /* HEADER */
  .sbb-header { text-align: center; margin-bottom: 28px; }
  .sbb-eyebrow { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 4px; color: #7a6230; text-transform: uppercase; margin-bottom: 10px; }
  .sbb-h1 { font-family: 'Cinzel Decorative', serif; font-size: clamp(22px, 6vw, 38px); color: #f0ead8; line-height: 1.15; text-shadow: 0 0 40px rgba(139,26,26,0.5); margin-bottom: 6px; }
  .sbb-h1 span { color: #c0392b; }
  .sbb-sub { font-style: italic; color: #7a7060; font-size: 14px; }
  .sbb-divider { display: flex; align-items: center; gap: 10px; margin: 18px 0; }
  .sbb-divider::before, .sbb-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, #7a6230, transparent); }
  .sbb-div-glyph { color: #8b1a1a; font-size: 15px; }

  /* ONBOARDING */
  .sbb-onboard { background: #1a1410; border: 1px solid rgba(201,168,76,0.3); border-radius: 10px; padding: 22px 18px; margin-bottom: 18px; }
  .sbb-onboard-title { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 2px; color: #c9a84c; text-transform: uppercase; margin-bottom: 5px; }
  .sbb-onboard-desc { font-size: 13px; color: #7a7060; font-style: italic; line-height: 1.6; margin-bottom: 18px; }
  .sbb-guide { display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px; }
  .sbb-guide-step { display: flex; align-items: flex-start; gap: 11px; padding: 10px 12px; background: #120e0a; border-radius: 6px; border: 1px solid rgba(201,168,76,0.1); }
  .sbb-guide-num { width: 21px; height: 21px; min-width: 21px; background: #8b1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-size: 10px; color: #f0ead8; font-weight: 600; }
  .sbb-guide-text { font-size: 13px; color: #d4c9b8; line-height: 1.5; padding-top: 1px; }
  .sbb-guide-text strong { color: #c9a84c; }
  .sbb-btn-studio { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: linear-gradient(135deg,#1a3a6a,#0d2040); border: 1px solid #2a5a9a; color: #8ab4f8; border-radius: 6px; padding: 12px; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 1px; cursor: pointer; text-decoration: none; transition: all 0.2s; margin-bottom: 16px; }
  .sbb-btn-studio:hover { background: linear-gradient(135deg,#1e4a8a,#102850); }
  .sbb-key-divider { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
  .sbb-key-divider::before, .sbb-key-divider::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.15); }
  .sbb-key-divider span { font-size: 11px; color: #7a7060; font-style: italic; }
  .sbb-key-row { display: flex; gap: 7px; margin-bottom: 8px; }
  .sbb-key-input { flex: 1; background: #120e0a; border: 1px solid rgba(201,168,76,0.25); border-radius: 6px; padding: 11px 12px; color: #f0ead8; font-family: 'Courier New', monospace; font-size: 13px; outline: none; transition: border-color 0.2s; min-width: 0; }
  .sbb-key-input:focus { border-color: #c9a84c; }
  .sbb-key-input::placeholder { color: #7a7060; opacity: 0.6; }
  .sbb-key-toggle { background: transparent; border: 1px solid rgba(201,168,76,0.2); border-radius: 6px; padding: 11px; color: #7a7060; cursor: pointer; font-size: 14px; line-height: 1; transition: all 0.2s; }
  .sbb-key-toggle:hover { color: #c9a84c; }
  .sbb-btn-save { background: #8b1a1a; color: #f0ead8; border: none; border-radius: 6px; padding: 11px 16px; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 1px; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
  .sbb-btn-save:hover { background: #c0392b; }
  .sbb-key-status { font-size: 12px; font-style: italic; min-height: 16px; margin-bottom: 4px; }
  .sbb-key-status.ok { color: #5aaa5a; }
  .sbb-key-status.err { color: #c0392b; }
  .sbb-key-warn { font-size: 11px; color: #c9a030; font-style: italic; padding: 7px 11px; background: rgba(201,160,48,0.08); border: 1px solid rgba(201,160,48,0.2); border-radius: 6px; margin-bottom: 6px; }
  .sbb-key-note { font-size: 11px; color: #7a7060; font-style: italic; line-height: 1.5; padding: 8px 12px; background: #120e0a; border-radius: 6px; border-left: 2px solid #7a6230; }

  /* KEY BANNER */
  .sbb-banner { display: flex; align-items: center; gap: 10px; background: #1a1410; border: 1px solid rgba(90,170,90,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
  .sbb-banner-icon { color: #5aaa5a; font-size: 13px; }
  .sbb-banner-text { flex: 1; font-size: 13px; color: #d4c9b8; }
  .sbb-banner-text span { color: #7a7060; font-style: italic; font-size: 11px; }
  .sbb-btn-change { background: transparent; border: 1px solid #7a6230; color: #7a6230; border-radius: 6px; padding: 5px 10px; font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 1px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; }
  .sbb-btn-change:hover { color: #c9a84c; border-color: #c9a84c; }

  /* HISTORY */
  .sbb-hist-label { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 2px; color: #7a6230; text-transform: uppercase; margin-bottom: 7px; }
  .sbb-hist-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
  .sbb-hist-item { display: flex; align-items: center; gap: 9px; padding: 8px 12px; background: #1a1410; border: 1px solid rgba(201,168,76,0.12); border-radius: 6px; cursor: pointer; transition: border-color 0.2s; }
  .sbb-hist-item:hover { border-color: rgba(201,168,76,0.35); }
  .sbb-hist-title { flex: 1; font-size: 13px; color: #d4c9b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sbb-hist-genre { font-size: 10px; color: #7a7060; font-style: italic; flex-shrink: 0; }
  .sbb-hist-del { color: #7a7060; font-size: 14px; padding: 0 4px; cursor: pointer; transition: color 0.15s; flex-shrink: 0; line-height: 1; background: none; border: none; }
  .sbb-hist-del:hover { color: #c0392b; }

  /* FORM */
  .sbb-form { background: #1a1410; border: 1px solid rgba(201,168,76,0.15); border-radius: 10px; padding: 18px 15px; margin-bottom: 14px; }
  .sbb-form-title { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 3px; color: #7a6230; text-transform: uppercase; margin-bottom: 13px; display: flex; align-items: center; gap: 8px; }
  .sbb-form-title::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.15); }
  .sbb-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .sbb-field:last-child { margin-bottom: 0; }
  .sbb-label { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 2px; color: #c9a84c; text-transform: uppercase; }
  .sbb-req { color: #c0392b; margin-left: 3px; }
  .sbb-input, .sbb-select, .sbb-textarea { background: #120e0a; border: 1px solid rgba(201,168,76,0.2); border-radius: 6px; padding: 10px 12px; color: #f0ead8; font-family: 'IM Fell English', Georgia, serif; font-size: 15px; outline: none; transition: border-color 0.2s; width: 100%; resize: vertical; }
  .sbb-input:focus, .sbb-select:focus, .sbb-textarea:focus { border-color: #c9a84c; }
  .sbb-input::placeholder, .sbb-textarea::placeholder { color: #7a7060; font-style: italic; }
  .sbb-select option { background: #120e0a; }
  .sbb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
  @media(max-width:420px) { .sbb-row { grid-template-columns: 1fr; } }
  .sbb-char { font-size: 10px; color: #7a7060; font-style: italic; text-align: right; }
  .sbb-char.warn { color: #c0392b; }
  .sbb-tone-hint { font-size: 11px; color: #7a7060; font-style: italic; margin-top: 3px; line-height: 1.4; }
  .sbb-tone-hint strong { color: #7a6230; font-style: normal; }

  /* GENERATE BUTTON */
  .sbb-btn-gen { width: 100%; background: linear-gradient(135deg,#8b1a1a,#5a0f0f); color: #f0ead8; border: 1px solid rgba(139,26,26,0.6); border-radius: 10px; padding: 15px; font-family: 'Cinzel Decorative', serif; font-size: 14px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .sbb-btn-gen:hover:not(:disabled) { background: linear-gradient(135deg,#c0392b,#8b1a1a); box-shadow: 0 4px 20px rgba(139,26,26,0.4); transform: translateY(-1px); }
  .sbb-btn-gen:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .sbb-btn-spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: sbb-spin 0.7s linear infinite; }
  .sbb-token-note { font-size: 11px; color: #7a7060; font-style: italic; text-align: center; margin-bottom: 16px; }
  .sbb-test-banner { background: rgba(201,160,48,0.12); border: 1px solid rgba(201,160,48,0.4); border-radius: 6px; padding: 8px 14px; margin-bottom: 14px; font-size: 12px; color: #c9a030; font-style: italic; text-align: center; }

  /* PROGRESS */
  .sbb-track { display: flex; gap: 3px; margin-bottom: 8px; }
  .sbb-pill { flex: 1; height: 3px; background: rgba(201,168,76,0.1); border-radius: 2px; transition: background 0.4s; }
  .sbb-pill.done { background: #7a6230; }
  .sbb-pill.active { background: #c0392b; animation: sbb-pulse 0.8s infinite alternate; }
  .sbb-step-labels { display: flex; gap: 3px; margin-bottom: 12px; }
  .sbb-step-lbl { flex: 1; font-family: 'Cinzel', serif; font-size: 8px; color: #7a7060; text-align: center; text-transform: uppercase; transition: color 0.3s; }
  .sbb-step-lbl.done { color: #7a6230; }
  .sbb-step-lbl.active { color: #c9a84c; }
  .sbb-step-disp { background: #1a0e08; border: 1px solid #8b1a1a; border-radius: 6px; padding: 12px 14px; display: flex; align-items: center; gap: 11px; margin-bottom: 16px; }
  .sbb-step-spinner { width: 17px; height: 17px; border: 2px solid rgba(139,26,26,0.25); border-top-color: #c0392b; border-radius: 50%; animation: sbb-spin 0.75s linear infinite; flex-shrink: 0; }
  .sbb-step-txt { font-style: italic; color: #d4c9b8; font-size: 14px; line-height: 1.4; }

  /* ERROR */
  .sbb-error { background: rgba(139,26,26,0.12); border: 1px solid rgba(139,26,26,0.5); border-radius: 6px; padding: 12px 14px; color: #d4c9b8; font-style: italic; font-size: 14px; line-height: 1.6; margin-bottom: 14px; }

  /* OUTPUT */
  .sbb-out-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 13px; gap: 11px; flex-wrap: wrap; }
  .sbb-out-title { font-family: 'Cinzel Decorative', serif; font-size: clamp(13px,4vw,17px); color: #c9a84c; line-height: 1.3; flex: 1; }
  .sbb-out-title span { display: block; font-size: 10px; color: #7a7060; font-family: 'Cinzel', serif; letter-spacing: 2px; font-style: normal; margin-top: 3px; }
  .sbb-out-actions { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
  .sbb-btn-act { background: transparent; border: 1px solid #7a6230; color: #7a6230; border-radius: 6px; padding: 6px 11px; font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
  .sbb-btn-act:hover { background: #7a6230; color: #f0ead8; }
  .sbb-btn-act.danger { border-color: #8b1a1a; color: #8b1a1a; }
  .sbb-btn-act.danger:hover { background: #8b1a1a; color: #f0ead8; }

  /* BIBLE CARD */
  .sbb-card { background: #1a1410; border: 1px solid rgba(201,168,76,0.15); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
  .sbb-card-hdr { padding: 12px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; background: #120e0a; border-bottom: 1px solid rgba(201,168,76,0.1); user-select: none; }
  .sbb-card-hdr:active { opacity: 0.8; }
  .sbb-card-icon { color: #8b1a1a; font-size: 13px; flex-shrink: 0; }
  .sbb-card-title { font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 2px; color: #c9a84c; text-transform: uppercase; flex: 1; }
  .sbb-card-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
  .sbb-btn-redo { background: transparent; border: 1px solid rgba(139,26,26,0.4); color: #c0392b; border-radius: 4px; padding: 3px 8px; font-family: 'Cinzel', serif; font-size: 8px; letter-spacing: 0.5px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; white-space: nowrap; }
  .sbb-btn-redo:hover:not(:disabled) { background: rgba(139,26,26,0.2); border-color: #c0392b; }
  .sbb-btn-redo:disabled { opacity: 0.35; cursor: not-allowed; }
  .sbb-card-chev { color: #7a7060; font-size: 10px; transition: transform 0.25s; flex-shrink: 0; }
  .sbb-card-chev.collapsed { transform: rotate(-90deg); }
  .sbb-card-body { padding: 14px; line-height: 1.85; color: #d4c9b8; font-size: 14px; }
  .sbb-card-body.regen { opacity: 0.4; }
  .sbb-bible-label { display: block; color: #c9a84c; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 12px; margin-bottom: 3px; }
  .sbb-bible-label:first-child { margin-top: 0; }

  /* FOOTER */
  .sbb-footer { text-align: center; margin-top: 36px; }
  .sbb-footer-brand { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 3px; color: #7a6230; text-transform: uppercase; margin-bottom: 3px; }
  .sbb-footer-note { font-size: 11px; color: #7a7060; font-style: italic; }

  @keyframes sbb-spin    { to { transform: rotate(360deg); } }
  @keyframes sbb-pulse   { from { opacity: 0.5; } to { opacity: 1; } }
  @keyframes sbb-fadeup  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatContent(raw) {
  return raw
    .replace(/\*\*([^*\n]{1,60}):\*\*/g, '<span class="sbb-bible-label">$1</span>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#f0ead8">$1</strong>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<span class="sbb-bible-label">$1</span>')
    .trim();
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); } catch { return []; }
}

function saveHistory(d, res) {
  let hist = getHistory().filter(h => h.title !== d.t);
  hist.unshift({ id: Date.now(), title: d.t, genre: d.g, input: d, results: { ...res } });
  if (hist.length > MAX_HIST) hist = hist.slice(0, MAX_HIST);
  try { localStorage.setItem(LS_HIST, JSON.stringify(hist)); } catch {}
}

// ── SPLIT SECTIONS ───────────────────────────────────────────────────────────
// Splits combined API response into sections.
// Strategy: try marker-based split first (=== SECTION X ===),
// fall back to splitting on the first known label of each section group.
function splitSections(text, markers) {
  // Try marker-based split
  const markerResults = [];
  let markerFound = false;
  for (let i = 0; i < markers.length; i++) {
    const start = text.indexOf("=== " + markers[i]);
    if (start !== -1) markerFound = true;
    const end = i + 1 < markers.length
      ? text.indexOf("=== " + markers[i + 1])
      : text.length;
    if (start === -1) { markerResults.push(""); continue; }
    const content = text.slice(start, end === -1 ? text.length : end);
    const firstNewline = content.indexOf("\n");
    markerResults.push(firstNewline === -1 ? content : content.slice(firstNewline + 1).trim());
  }
  if (markerFound && markerResults.some(r => r.length > 40)) return markerResults;

  // Fallback: split on first bold label of each section
  // call0 sections start with: SETTING OVERVIEW, PROTAGONIST
  // call1 sections start with: THE ENGINE, ACT ONE, COLOUR PALETTE
  const SECTION_ANCHORS = {
    "SECTION 1": ["**SETTING OVERVIEW", "**Setting Overview"],
    "SECTION 2": ["**PROTAGONIST", "**Protagonist"],
    "SECTION 3": ["**THE ENGINE", "**The Engine"],
    "SECTION 4": ["**ACT ONE", "**Act One"],
    "SECTION 5": ["**COLOUR PALETTE", "**Colour Palette", "**COLOR PALETTE"],
  };

  const anchorPositions = markers.map(m => {
    const anchors = SECTION_ANCHORS[m] || [];
    for (const anchor of anchors) {
      const pos = text.indexOf(anchor);
      if (pos !== -1) return pos;
    }
    return -1;
  });

  const fallbackResults = [];
  for (let i = 0; i < markers.length; i++) {
    const start = anchorPositions[i];
    if (start === -1) { fallbackResults.push(""); continue; }
    // Find the next section's start
    let end = text.length;
    for (let j = i + 1; j < markers.length; j++) {
      if (anchorPositions[j] !== -1) { end = anchorPositions[j]; break; }
    }
    fallbackResults.push(text.slice(start, end).trim());
  }
  if (fallbackResults.some(r => r.length > 40)) return fallbackResults;

  // Last resort: return full text in first slot, empty in rest
  return markers.map((_, i) => i === 0 ? text.trim() : "");
}

// ── GEMINI CALL ───────────────────────────────────────────────────────────────
// ── GEMINI CONFIG (UPDATED FOR 2026 API) ────────────────────────



const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;

async function warmupGemini(key){
  try{
    await fetch(GEMINI_URL(MODELS[0], key),{
      method:"POST",
      headers:{ "Content-Type":"application/json"},
      body: JSON.stringify({
        contents:[
          { role:"user", parts:[{ text:"ping"}]}
        ],
        generationConfig:{ maxOutputTokens:5 }
      })
    })
  }catch(e){}
}


// ── GEMINI CALL ─────────────────────────────────────────────────────

async function callGemini(prompt, apiKey){

 for(const model of MODELS){

  try{

   const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
     method:"POST",

     headers:{
      "Content-Type":"application/json"
     },

     body: JSON.stringify({

      contents:[
       {
        parts:[
         { text: prompt }
        ]
       }
      ]

     })

    }
   );

   if(!res.ok){

    const txt = await res.text();

    console.log(model,"failed:",txt);

    continue;

   }

   const data = await res.json();

   const output =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

   if(output) return output;

  }

  catch(e){

   console.log("error:",model,e);

  }

 }

 throw new Error("All Gemini models failed");

}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function App() {
  // Key state
  const [apiKey,      setApiKey]      = useState(() => maskKey(decodeKey(localStorage.getItem(LS_KEY) || "")));
  const [keyInput,    setKeyInput]    = useState("");
  const [keyVisible,  setKeyVisible]  = useState(false);
  const [keyStatus,   setKeyStatus]   = useState({ msg: "", ok: true });
  const [keyActive,   setKeyActive]   = useState(() => !!localStorage.getItem(LS_KEY));
  const [showKeyWarn, setShowKeyWarn] = useState(false);

  // Form state
  const [title,    setTitle]    = useState("");
  const [genre,    setGenre]    = useState(GENRES[0]);
  const [prot,     setProt]     = useState("");
  const [setting,  setSetting]  = useState("");
  const [concept,  setConcept]  = useState("");
  const [tone,     setTone]     = useState("");

  // Generation state
  const [running,    setRunning]    = useState(false);
  const [stepIdx,    setStepIdx]    = useState(-1);
  const [stepMsg,    setStepMsg]    = useState("");
  const [pills,      setPills]      = useState(Array(2).fill("idle")); // 2 calls
  const [results,    setResults]    = useState({});
  const [currentD,   setCurrentD]   = useState(null);
  const [error,      setError]      = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [collapsed,  setCollapsed]  = useState({});
  const [regenning,  setRegenning]  = useState({});

  // History
  const [history,    setHistory]    = useState(() => getHistory());

  const outputRef  = useRef(null);
  const progressRef = useRef(null);

  // Char counters
  const rem = (val, max) => max - val.length;
  const charCls = (val, max) => "sbb-char" + (rem(val, max) < 20 ? " warn" : "");

  // ── KEY SAVE ────────────────────────────────────────────────────────────────
  function handleSaveKey() {
    const k = keyInput.trim();
    if (!k)                    return setKeyStatus({ msg: "Paste your key first.", ok: false });
    if (!k.startsWith("AIza")) return setKeyStatus({ msg: 'Key should start with "AIza" — copy it again.', ok: false });
    if (k.length < 30)          return setKeyStatus({ msg: "Key looks too short — try again.", ok: false });
    const isNew = !localStorage.getItem(LS_KEY);
    localStorage.setItem(LS_KEY, encodeKey(k));   // encoded — never plain text
    setApiKey(maskKey(k));                         // display mask only — never raw key in state
    setKeyInput("");                               // clear input immediately
    setKeyActive(true);
    setKeyStatus({ msg: "Key saved ✦", ok: true });
    if (isNew) setShowKeyWarn(true);
  }

  function handleChangeKey() {
    setKeyActive(false);
    setKeyInput("");
    setKeyStatus({ msg: "", ok: true });
    setShowKeyWarn(false);
  }

  // ── VALIDATE ────────────────────────────────────────────────────────────────
  function validate() {
    if (!title.trim())   return "Story title is required.";
    if (!prot.trim())    return "Protagonist is required.";
    if (!setting.trim()) return "Setting is required.";
    if (!concept.trim()) return "Core concept is required.";
    if (!tone.trim())    return "Tone / Influences is required — name a real work.";
    if (TEST_MODE)       return null; // skip key check in test mode
    const k = decodeKey(localStorage.getItem(LS_KEY) || "") || keyInput.trim();
    if (!k)              return "Save your Gemini API key first.";
    if (!k.startsWith("AIza")) return "Invalid API key format.";
    return null;
  }

  // ── STEP RUNNER ─────────────────────────────────────────────────────────────
  const runCall = useCallback(async (callIdx, prompt, key) => {
    const maxRetries = 3;
    // Warm UX messages for retries — never show "error" to the user
    const retryMsgs = [
      "Still working — Gemini is warming up...",
      "Almost there — one more moment...",
      "Hang tight, final attempt...",
    ];
    // Wait times for 429 (rate limit) vs other errors
    const waits429 = [15000, 30000, 45000];
    const waitsOther = [5000, 12000, 20000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setStepMsg(attempt === 0 ? CALLS[callIdx].msg : retryMsgs[attempt - 1]);
        setPills(p => p.map((v,i) => i === callIdx ? "active" : v));
        const out = await callGemini(prompt, key, "call" + callIdx);
        setPills(p => p.map((v,i) => i === callIdx ? "done" : v));
        return out;
      } catch (e) {
        if (attempt === maxRetries) throw e;
        const is429 = e.message.includes("limit") || e.message.includes("429");
        const wait  = is429 ? waits429[attempt] : waitsOther[attempt];
        setStepMsg(retryMsgs[attempt]);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }, []);

  // ── MAIN GENERATION ─────────────────────────────────────────────────────────
  async function startGeneration() {
    const err = validate();
    if (err) { setError(err); return; }
    if (running) return;

    const d = { t: title.trim(), g: genre, p: prot.trim(), s: setting.trim(), c: concept.trim(), tone: tone.trim() };
    const key = decodeKey(localStorage.getItem(LS_KEY) || "") || keyInput.trim();
    await warmupGemini(key);

    setRunning(true);
    setError("");
    setShowOutput(false);
    setResults({});
    setPills(Array(2).fill("idle"));
    setCurrentD(d); // Set before API calls — regenStep needs this immediately

    setTimeout(() => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);

    try {
      const res = {};
      // Call 0: World + Characters
      const raw0 = await runCall(0, PROMPTS.call0(d), key);
      const split0 = splitSections(raw0, ["SECTION 1", "SECTION 2"]);
      res[0] = split0[0] || raw0;
      res[1] = split0[1] || "";

      // 10s pause between calls — gives free-tier quota window time to reset
      await new Promise(r => setTimeout(r, 10000));

      // Call 1: Conflict + Arc + Visual
      const raw1 = await runCall(1, PROMPTS.call1(d), key);
      const split1 = splitSections(raw1, ["SECTION 3", "SECTION 4", "SECTION 5"]);
      res[2] = split1[0] || raw1;
      res[3] = split1[1] || "";
      res[4] = split1[2] || "";

      setResults(res);
      saveHistory(d, res);
      setHistory(getHistory());
      setShowOutput(true);
      setCollapsed({});
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      setStepIdx(-1);
    }
  }

  // ── REGEN SINGLE STEP ───────────────────────────────────────────────────────
  async function regenStep(idx) {
    const d = currentD;
    if (running || !d) return;
    const key = decodeKey(localStorage.getItem(LS_KEY) || "") || keyInput.trim();
    if (!TEST_MODE && !key) { setError("API key missing — tap Change to re-enter it."); return; }

    const callIdx = idx <= 1 ? 0 : 1;
    setRunning(true);
    setError("");
    setRegenning(r => ({ ...r, [idx]: true }));
    setPills(p => p.map((v,i) => i === callIdx ? "active" : v));
    setStepMsg("Rewriting " + STEPS[idx].title + "...");

    const maxRetries = 3;
    const retryMsgs  = ["Still working...", "Almost there...", "Final attempt..."];
    const waits429   = [15000, 30000, 45000];
    const waitsOther = [5000, 12000, 20000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) setStepMsg(retryMsgs[attempt - 1]);
        const raw = await callGemini(REDO[idx](d), key, "redo" + idx);
        setPills(p => p.map((v,i) => i === callIdx ? "done" : v));
        setResults(r => {
          const updated = { ...r, [idx]: raw.trim() };
          saveHistory(d, updated);
          setHistory(getHistory());
          return updated;
        });
        break; // success — exit retry loop
      } catch (e) {
        if (attempt === maxRetries) {
          // All retries exhausted — show error
          setError(e.message);
          setPills(p => p.map((v,i) => i === callIdx ? "done" : v));
          break;
        }
        const is429 = e.message.includes("limit") || e.message.includes("429");
        const wait  = is429 ? waits429[attempt] : waitsOther[attempt];
        setStepMsg(retryMsgs[attempt]);
        await new Promise(r => setTimeout(r, wait));
      }
    }

    setRunning(false);
    setStepIdx(-1);
    setRegenning(r => ({ ...r, [idx]: false }));
  }

  // ── LOAD HISTORY ────────────────────────────────────────────────────────────
  function loadHistory(h) {
    setTitle(h.input.t);
    setGenre(h.input.g);
    setProt(h.input.p);
    setSetting(h.input.s);
    setConcept(h.input.c);
    setTone(h.input.tone || "");
    setResults(h.results);
    setCurrentD(h.input);
    setShowOutput(true);
    setPills(Array(2).fill("done"));
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function deleteHistory(id, e) {
    e.stopPropagation();
    const updated = getHistory().filter(h => h.id !== id);
    try { localStorage.setItem(LS_HIST, JSON.stringify(updated)); } catch {}
    setHistory(updated);
  }

  // ── EXPORT ──────────────────────────────────────────────────────────────────
  function getFullText() {
    const d = currentD || { t: title, g: genre, p: prot, s: setting, c: concept, tone };
    const sep = "=".repeat(56);
    let out = `STORY BIBLE\n${sep}\nTitle: ${d.t}\nGenre: ${d.g}\nProtagonist: ${d.p}\nSetting: ${d.s}\nConcept: ${d.c}\n`;
    if (d.tone) out += `Tone: ${d.tone}\n`;
    out += `\n${sep}\n\n`;
    STEPS.forEach((step, i) => {
      out += `[ ${step.title.toUpperCase()} ]\n${"-".repeat(40)}\n`;
      out += (results[i] || "").replace(/\*\*/g, "").trim() + "\n\n\n";
    });
    out += `${sep}\nJanardhan Labs - Story Bible Builder\n`;
    return out;
  }

  function copyAll() {
    navigator.clipboard.writeText(getFullText()).catch(() => {});
  }

  function downloadTxt() {
    const d    = currentD || { t: title };
    const name = (d.t || "story").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    const blob = new Blob([getFullText()], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `${name}_StoryBible.txt` });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── NAVIGATE BACK ────────────────────────────────────────────────────────────
  function goBack() {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div className="sbb-wrap">
        <button className="sbb-back" onClick={goBack}>← Labs</button>

        <div className="sbb-inner">

          {/* HEADER */}
          <header className="sbb-header">
            <div className="sbb-eyebrow">Janardhan Labs · Original IP Studio</div>
            <h1 className="sbb-h1">Story <span>Bible</span> Builder</h1>
            <p className="sbb-sub">Five sacred steps. One complete world.</p>
            <div className="sbb-divider"><span className="sbb-div-glyph">✦</span></div>
          </header>

          {/* ONBOARDING */}
          {!keyActive && (
            <div className="sbb-onboard">
              <div className="sbb-onboard-title">First — Your Free Gemini Key</div>
              <p className="sbb-onboard-desc">This tool runs on Google's Gemini AI using your own key. Free, takes under a minute.</p>
              <div className="sbb-guide">
                {[
                  "Tap below to open Google AI Studio in a new tab",
                  "Sign in with any Google account",
                  <span>Click <strong>"Create API Key"</strong> — copy it</span>,
                  <span>Paste below and tap <strong>"Save Key"</strong></span>,
                ].map((txt, i) => (
                  <div className="sbb-guide-step" key={i}>
                    <div className="sbb-guide-num">{i + 1}</div>
                    <div className="sbb-guide-text">{txt}</div>
                  </div>
                ))}
              </div>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="sbb-btn-studio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                Open Google AI Studio — Get Free Key
              </a>
              <div className="sbb-key-divider"><span>paste your key here</span></div>
              <div className="sbb-key-row">
                <input
                  type={keyVisible ? "text" : "password"}
                  className="sbb-key-input"
                  placeholder="AIza..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value.trim())}
                  autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                />
                <button className="sbb-key-toggle" onClick={() => setKeyVisible(v => !v)}>
                  {keyVisible ? "🙈" : "👁"}
                </button>
                <button className="sbb-btn-save" onClick={handleSaveKey}>Save Key</button>
              </div>
              {keyStatus.msg && (
                <div className={`sbb-key-status ${keyStatus.ok ? "ok" : "err"}`}>{keyStatus.msg}</div>
              )}
              {showKeyWarn && (
                <div className="sbb-key-warn">Save your key somewhere safe — clearing browser storage will remove it.</div>
              )}
              <div className="sbb-key-note">Your key stays in this browser only. Free tier: 1,500 runs/day.<br/>💡 First time? Run one test prompt in AI Studio first — it warms up your quota.</div>
            </div>
          )}

          {/* KEY BANNER */}
          {keyActive && (
            <div className="sbb-banner">
              <span className="sbb-banner-icon">✦</span>
              <div className="sbb-banner-text">
                Gemini key active<br />
                <span>{"••••••••••••••••...."+apiKey.slice(-4)}</span>
              </div>
              <button className="sbb-btn-change" onClick={handleChangeKey}>Change</button>
            </div>
          )}

          {/* HISTORY */}
          {history.length > 0 && (
            <div>
              <div className="sbb-hist-label">Recent Bibles</div>
              <div className="sbb-hist-list">
                {history.map(h => (
                  <div className="sbb-hist-item" key={h.id} onClick={() => loadHistory(h)}>
                    <span className="sbb-hist-title">{h.title}</span>
                    <span className="sbb-hist-genre">{h.genre.split(" ")[0]}</span>
                    <button className="sbb-hist-del" onClick={e => deleteHistory(h.id, e)} title="Delete">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FORM */}
          <div className="sbb-form">
            <div className="sbb-form-title">Your Story</div>

            <div className="sbb-row">
              <div className="sbb-field">
                <label className="sbb-label">Title<span className="sbb-req">*</span></label>
                <input className="sbb-input" placeholder="e.g. The God Who Got Fired"
                  value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
                <div className={charCls(title,60)}>{rem(title,60)}</div>
              </div>
              <div className="sbb-field">
                <label className="sbb-label">Genre<span className="sbb-req">*</span></label>
                <select className="sbb-select" value={genre} onChange={e => setGenre(e.target.value)}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="sbb-row">
              <div className="sbb-field">
                <label className="sbb-label">Protagonist<span className="sbb-req">*</span></label>
                <input className="sbb-input" placeholder="Name + who they are"
                  value={prot} onChange={e => setProt(e.target.value)} maxLength={100} />
                <div className={charCls(prot,100)}>{rem(prot,100)}</div>
              </div>
              <div className="sbb-field">
                <label className="sbb-label">Setting<span className="sbb-req">*</span></label>
                <input className="sbb-input" placeholder="Place + era"
                  value={setting} onChange={e => setSetting(e.target.value)} maxLength={80} />
                <div className={charCls(setting,80)}>{rem(setting,80)}</div>
              </div>
            </div>

            <div className="sbb-field">
              <label className="sbb-label">Core Concept<span className="sbb-req">*</span></label>
              <textarea className="sbb-textarea" rows={3}
                placeholder="One sentence: who, what breaks, what's at stake."
                value={concept} onChange={e => setConcept(e.target.value)} maxLength={300} />
              <div className={charCls(concept,300)}>{rem(concept,300)}</div>
            </div>

            <div className="sbb-field">
              <label className="sbb-label">Tone / Influences<span className="sbb-req">*</span></label>
              <input className="sbb-input"
                placeholder="e.g. Terry Pratchett meets Sacred Games — absurdist but grounded"
                value={tone} onChange={e => setTone(e.target.value)} maxLength={150} />
              <div className={charCls(tone,150)}>{rem(tone,150)}</div>
              <div className="sbb-tone-hint">This field drives quality. <strong>Name real works.</strong></div>
            </div>
          </div>

          {/* GENERATE */}
          <button className="sbb-btn-gen" onClick={startGeneration} disabled={running}>
            {running && <div className="sbb-btn-spin" />}
            <span>{running ? "Forging..." : "✦ Forge the Bible ✦"}</span>
          </button>
          {TEST_MODE && (
            <div className="sbb-test-banner">
              ⚗ Test Mode — mock responses only. Set TEST_MODE = false before deploying.
            </div>
          )}
          <div className="sbb-token-note">{TEST_MODE ? "No API key needed in test mode" : "Gemini 1.5 Flash · ~1,600 tokens/run · ~400 tokens/redo · Janardhan Labs"}</div>

          {/* PROGRESS */}
          {running && (
            <div ref={progressRef}>
              <div className="sbb-track">
                {pills.map((p, i) => <div key={i} className={`sbb-pill ${p}`} />)}
              </div>
              <div className="sbb-step-labels">
                {CALLS.map((c, i) => (
                  <div key={i} className={`sbb-step-lbl ${pills[i]}`}>{c.label}</div>
                ))}
              </div>
              <div className="sbb-step-disp">
                <div className="sbb-step-spinner" />
                <div className="sbb-step-txt">{stepMsg}</div>
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="sbb-error">
              {error === "RATE_LIMIT_429"
                ? "⏳ Gemini is warming up — all retries used. Wait 30 seconds and try again, or run one test prompt at aistudio.google.com to warm up your key first."
                : "! " + error}
            </div>
          )}

          {/* OUTPUT */}
          {showOutput && (
            <div ref={outputRef}>
              <div className="sbb-out-header">
                <div className="sbb-out-title">
                  "{escHtml(currentD?.t || title)}"
                  <span>Story Bible</span>
                </div>
                <div className="sbb-out-actions">
                  <button className="sbb-btn-act" onClick={copyAll}>Copy</button>
                  <button className="sbb-btn-act" onClick={downloadTxt}>Save</button>
                  <button className="sbb-btn-act danger" onClick={() => { setShowOutput(false); setResults({}); setCurrentD(null); setPills(Array(2).fill("idle")); window.scrollTo({top:0,behavior:"smooth"}); }}>New</button>
                </div>
              </div>

              {STEPS.map((step, i) => (
                <div className="sbb-card" key={i}>
                  <div className="sbb-card-hdr" onClick={() => setCollapsed(c => ({ ...c, [i]: !c[i] }))}>
                    <span className="sbb-card-icon">{step.icon}</span>
                    <span className="sbb-card-title">{step.title}</span>
                    <div className="sbb-card-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="sbb-btn-redo"
                        disabled={running}
                        onClick={() => regenStep(i)}
                      >
                        {regenning[i] ? "..." : "Redo"}
                      </button>
                    </div>
                    <span className={`sbb-card-chev ${collapsed[i] ? "collapsed" : ""}`}>▼</span>
                  </div>
                  {!collapsed[i] && (
                    <div
                      className={`sbb-card-body ${regenning[i] ? "regen" : ""}`}
                      dangerouslySetInnerHTML={{ __html: formatContent(results[i] || "") }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <footer className="sbb-footer">
            <div className="sbb-footer-brand">Janardhan Labs</div>
            <div className="sbb-footer-note">Story Bible Builder · v5</div>
          </footer>

        </div>
      </div>
    </>
  );
}
