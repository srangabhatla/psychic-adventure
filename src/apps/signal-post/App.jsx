import { useState, useEffect, useRef, useCallback } from "react";

// ── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  voice:    "signalpost-voice",
  queue:    "signalpost-queue",
  journal:  "signalpost-journal",
  settings: "signalpost-settings",
  apiKey:   "signalpost-gemini-key",
};

async function storageGet(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

async function storageSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Pillar config ────────────────────────────────────────────────────────────
const PILLARS = {
  "build-in-public": { label: "Build in Public", color: "#F5A623", short: "BIP" },
  "pm-thinking":     { label: "PM Thinking",     color: "#4FC3F7", short: "PM"  },
  "ai-tutorials":    { label: "AI Tutorials",    color: "#81C784", short: "AI"  },
  "career-growth":   { label: "Career Growth",   color: "#CE93D8", short: "CG"  },
};

// Human-readable structure labels (outcome language, not creative-writing jargon)
const STRUCTURES = {
  "vulnerability-progress": { label: "I tried it. It broke. Then it worked.", short: "Struggle → Win"    },
  "reframe":                { label: "Everyone's wrong about this.",           short: "Contrarian Take"  },
  "before-after":           { label: "Before I knew this vs. now.",            short: "Before → After"  },
  "earned-insight":         { label: "Here's what 3 years taught me.",         short: "Earned Insight"  },
  "framework":              { label: "My 3-step framework for X.",             short: "Framework"       },
};

// ── Gemini direct call ───────────────────────────────────────────────────────
async function callGemini(apiKey, prompt, maxTokens = 1500) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(clean); } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Could not parse Gemini response — please try again");
  }
}

// ── PDF extraction (client-side, no server needed) ───────────────────────────
async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "txt" || ext === "md") {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsText(file);
      return;
    }

    if (ext === "pdf") {
      // PDF.js from CDN — load dynamically
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!window.pdfjsLib) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
          const typedArray = new Uint8Array(e.target.result);
          const pdf        = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
          let text = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
            const page    = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(s => s.str).join(" ") + "\n";
          }
          resolve(text.trim());
        } catch (err) {
          reject(new Error("Could not extract PDF text: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Could not read PDF"));
      reader.readAsArrayBuffer(file);
      return;
    }

    reject(new Error(`Unsupported file type: .${ext}. Use .txt, .md, or .pdf`));
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Prompts ──────────────────────────────────────────────────────────────────
function buildDocExtractPrompt(docText) {
  const truncated = docText.slice(0, 6000); // Keep input token cost bounded
  return `You are a LinkedIn content strategist. Extract 3 distinct postable signal ideas from this document/work artifact.

DOCUMENT:
${truncated}

Each signal should be a specific, concrete insight, story, or lesson that could become a LinkedIn post.
Do NOT summarise the document — extract what's interesting, surprising, or worth sharing.

Return ONLY valid JSON:
{
  "signals": [
    {
      "signal": "1-3 sentence postable idea, written as a raw thought not a post",
      "why": "One sentence on why this would resonate on LinkedIn",
      "suggestedPillar": "build-in-public" | "pm-thinking" | "ai-tutorials" | "career-growth",
      "suggestedStructure": "vulnerability-progress" | "reframe" | "before-after" | "earned-insight" | "framework"
    },
    { ... },
    { ... }
  ],
  "docSummary": "One sentence description of what this document is about"
}`;
}

function buildQualityPrompt(signal, voiceProfile) {
  return `You are a LinkedIn content strategist. Evaluate this raw signal for post quality.

Signal: "${signal}"

Voice context: ${voiceProfile ? `This person writes with: ${voiceProfile.summary}` : "No voice profile yet."}

Return ONLY valid JSON:
{
  "quality": "green" | "amber" | "red",
  "message": "One direct sentence — coaching note (amber/red) or confirmation (green). Be specific, not generic.",
  "detectedPillar": "build-in-public" | "pm-thinking" | "ai-tutorials" | "career-growth",
  "suggestedStructure": "vulnerability-progress" | "reframe" | "before-after" | "earned-insight" | "framework",
  "pillarConfidence": "high" | "medium"
}

Green = specific, has a concrete detail, someone can learn from it.
Amber = right direction but needs one more specific detail (name the missing piece).
Red = too vague to generate a good post — say exactly what's missing.`;
}

function buildGenerationPrompt(signal, pillar, structure, voiceProfile) {
  const pillarContext = {
    "build-in-public": "Share the real process — what was built, what broke, what was learned. Make the reader feel like they're watching over your shoulder.",
    "pm-thinking":     "Challenge a common assumption or share a framework. The reader should feel smarter after reading.",
    "ai-tutorials":    "Show the before/after. Make the transformation feel achievable in 10 minutes.",
    "career-growth":   "Speak from earned experience. Make the insight feel hard-won, not generic advice.",
  };
  const structureGuide = {
    "vulnerability-progress": "Open with a concrete failure or struggle. Move to what specifically changed. End with the lesson.",
    "reframe":                "Open by stating the widely-held belief. Flip it hard. Prove the flip with your specific experience.",
    "before-after":           "Contrast a specific before state and after state. The delta is the post.",
    "earned-insight":         "Lead with the lesson in one punchy sentence. Then prove it with the specific story.",
    "framework":              "Name the framework. Break it into exactly 3 numbered principles. Each principle = one line.",
  };
  const voice = voiceProfile
    ? `\nVOICE FINGERPRINT — write EXACTLY in this style:\n${voiceProfile.traits.join("\n")}\nAvoid: ${(voiceProfile.avoidances || []).join(", ")}`
    : "\nVoice: Direct, smart, occasionally self-deprecating. Indian professional context. No corporate fluff. Short sentences hit harder.";

  return `You are a LinkedIn ghostwriter for a senior PM and AI builder at Janardhan Labs.

RAW SIGNAL: "${signal}"
PILLAR: ${pillar} — ${pillarContext[pillar]}
STRUCTURE: ${structure} — ${structureGuide[structure]}
${voice}

HARD RULES:
- Line 1 of the hook post must be 8 words or fewer. It must create a pattern interrupt.
- Line 2 must make them curious enough to click "see more".
- No em dashes. No "In today's world." No "I'm excited to share." No "game-changer."
- Use short line breaks — each line is one thought.
- End with ONE specific question that invites genuine response, not "what do you think?"
- Carousel: each slide is ONE idea. Headline ≤ 8 words. Body ≤ 2 sentences. No filler slides.

Return ONLY valid JSON:
{
  "hookPost": "Full LinkedIn text post (150-280 words). Use \\n for line breaks.",
  "carouselSlides": [
    { "slideNum": 1, "type": "hook",    "headline": "Hook (≤8 words)", "body": "Optional supporting line", "visual": "visual motif description" },
    { "slideNum": 2, "type": "content", "headline": "Slide 2 headline", "body": "Body copy ≤2 sentences",   "visual": "visual motif" },
    { "slideNum": 3, "type": "content", "headline": "...", "body": "...", "visual": "..." },
    { "slideNum": 4, "type": "content", "headline": "...", "body": "...", "visual": "..." },
    { "slideNum": 5, "type": "content", "headline": "...", "body": "...", "visual": "..." },
    { "slideNum": 6, "type": "content", "headline": "...", "body": "...", "visual": "..." },
    { "slideNum": 7, "type": "cta",     "headline": "Follow for more [specific topic]", "body": "One CTA question", "visual": "amber glow" }
  ],
  "suggestedHashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;
}

function buildVoicePrompt(posts) {
  return `Analyse these LinkedIn posts and extract the author's unique voice fingerprint.

POSTS:
${posts}

Return ONLY valid JSON:
{
  "summary": "2 sentence description of this person's writing style",
  "traits": [
    "Sentence rhythm: [describe precisely]",
    "Vocabulary register: [describe precisely]",
    "Tone: [describe precisely]",
    "Hook pattern: [describe what their hooks have in common]",
    "Signature move: [one thing they always do that nobody else does]"
  ],
  "avoidances": ["3-5 things this person never does — be specific"]
}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:         #0A0A0A;
    --surface:    #111111;
    --surface2:   #191919;
    --surface3:   #222222;
    --rule:       #2A2A2A;
    --rule2:      #333333;
    --amber:      #F5A623;
    --amber-dim:  rgba(245,166,35,0.15);
    --amber-glow: rgba(245,166,35,0.06);
    --ink:        #F0EDE8;
    --ink-mid:    #A09890;
    --ink-dim:    #5A5550;
    --green:      #4CAF50;
    --red:        #EF5350;
    --blue:       #4FC3F7;
    --purple:     #CE93D8;
    --font-disp:  'Bebas Neue', sans-serif;
    --font-body:  'Newsreader', Georgia, serif;
    --font-mono:  'DM Mono', monospace;
    --radius:     4px;
    --transition: 0.18s ease;
  }

  html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font-body); }

  body::before {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  }

  .app { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

  /* ── TOP BAR ── */
  .topbar {
    height: 52px; border-bottom: 1px solid var(--rule);
    display: flex; align-items: center; padding: 0 1.5rem; gap: 1rem;
    background: rgba(10,10,10,0.92); backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
  }
  .topbar-brand { display: flex; align-items: baseline; gap: 0.5rem; flex: 1; }
  .topbar-name { font-family: var(--font-disp); font-size: 1.5rem; letter-spacing: 0.04em; color: var(--ink); line-height: 1; }
  .topbar-name span { color: var(--amber); }
  .topbar-tag { font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim); }
  .nav { display: flex; gap: 0.25rem; }
  .nav-btn {
    font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.1em;
    text-transform: uppercase; background: none; border: none; color: var(--ink-dim);
    padding: 0.4rem 0.75rem; border-radius: var(--radius); cursor: pointer;
    transition: all var(--transition); white-space: nowrap;
  }
  .nav-btn:hover { color: var(--ink); background: var(--surface2); }
  .nav-btn.active { color: var(--amber); background: var(--amber-dim); }
  .q-badge {
    margin-left: 0.3rem; background: var(--amber); color: #0A0A0A;
    border-radius: 100px; padding: 0 0.3rem; font-size: 0.4rem;
  }
  .key-indicator {
    display: flex; align-items: center; gap: 0.4rem;
    font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.06em;
    color: var(--ink-dim); cursor: pointer; padding: 0.3rem 0.6rem;
    border: 1px solid var(--rule); border-radius: var(--radius); transition: all var(--transition);
  }
  .key-indicator:hover { border-color: var(--amber); color: var(--amber); }
  .key-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
  .key-dot.active { background: var(--green); }
  .voice-btn {
    font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.06em;
    padding: 0.3rem 0.6rem; border: 1px solid var(--rule); border-radius: var(--radius);
    background: none; cursor: pointer; transition: all var(--transition);
    color: var(--amber); white-space: nowrap;
  }
  .voice-btn:hover { border-color: var(--amber); }
  .voice-btn.set { color: var(--green); border-color: rgba(76,175,80,0.3); }

  /* ── MAIN ── */
  .main { flex: 1; padding: 2rem 1.5rem; max-width: 1100px; margin: 0 auto; width: 100%; }

  /* ── ONBOARDING ── */
  .onboard-wrap { max-width: 520px; margin: 5rem auto; }
  .onboard-step { font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.75rem; }
  .onboard-title { font-family: var(--font-disp); font-size: 3rem; letter-spacing: 0.04em; color: var(--ink); line-height: 1; margin-bottom: 0.5rem; }
  .onboard-title span { color: var(--amber); }
  .onboard-desc { font-size: 1rem; color: var(--ink-mid); line-height: 1.8; margin-bottom: 2rem; }
  .onboard-skip { font-family: var(--font-mono); font-size: 0.5rem; color: var(--ink-dim); background: none; border: none; cursor: pointer; text-decoration: underline; margin-left: 0.75rem; }
  .onboard-skip:hover { color: var(--ink); }

  /* ── DASHBOARD ── */
  .dash-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1px; background: var(--rule); border: 1px solid var(--rule);
    border-radius: var(--radius); overflow: hidden; margin-bottom: 1.5rem;
  }
  .stat-card { background: var(--surface); padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .stat-label { font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); }
  .stat-value { font-family: var(--font-disp); font-size: 2.8rem; line-height: 1; color: var(--ink); }
  .stat-value.amber { color: var(--amber); }
  .stat-value.green { color: var(--green); }
  .stat-value.red   { color: var(--red); }
  .stat-sub { font-family: var(--font-mono); font-size: 0.5rem; color: var(--ink-dim); letter-spacing: 0.06em; }
  .stat-sub.warn { color: var(--red); }

  .dash-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }

  .panel { background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius); padding: 1.25rem; }
  .panel-title {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-dim); margin-bottom: 1rem;
    display: flex; align-items: center; justify-content: space-between;
  }

  .pillar-bars { display: flex; flex-direction: column; gap: 0.65rem; }
  .pillar-row { display: flex; align-items: center; gap: 0.75rem; }
  .pillar-name { font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mid); width: 80px; flex-shrink: 0; }
  .pillar-track { flex: 1; height: 4px; background: var(--rule2); border-radius: 2px; overflow: hidden; }
  .pillar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .pillar-count { font-family: var(--font-mono); font-size: 0.48rem; color: var(--ink-dim); width: 20px; text-align: right; }

  .queue-items { display: flex; flex-direction: column; gap: 0.5rem; }
  .queue-item-mini {
    background: var(--surface2); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 0.65rem 0.85rem; display: flex; align-items: center; gap: 0.75rem;
    cursor: pointer; transition: border-color var(--transition);
  }
  .queue-item-mini:hover { border-color: var(--rule2); }
  .qi-pillar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .qi-text { flex: 1; font-size: 0.8rem; color: var(--ink-mid); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .qi-status { font-family: var(--font-mono); font-size: 0.45rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.2rem 0.45rem; border-radius: 100px; }
  .qi-status.draft { background: var(--surface3); color: var(--ink-dim); }
  .qi-status.ready { background: rgba(76,175,80,0.15); color: var(--green); }

  .cadence-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .cadence-dot { aspect-ratio: 1; border-radius: 2px; }
  .cadence-dot.empty { background: var(--surface3); }
  .cadence-dot.posted { background: var(--amber); }
  .cadence-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: 0.4rem; }
  .cadence-day { font-family: var(--font-mono); font-size: 0.42rem; text-align: center; color: var(--ink-dim); }

  .cta-btn {
    width: 100%; padding: 0.9rem; background: var(--amber); color: #0A0A0A;
    border: none; border-radius: var(--radius); font-family: var(--font-disp);
    font-size: 1.1rem; letter-spacing: 0.08em; cursor: pointer;
    transition: all var(--transition); margin-bottom: 1rem;
  }
  .cta-btn:hover { background: #FFB93A; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(245,166,35,0.3); }

  /* ── SIGNAL STUDIO ── */
  .studio-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .studio-left  { display: flex; flex-direction: column; gap: 1rem; }
  .studio-right { display: flex; flex-direction: column; gap: 1rem; }

  .section-head {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--amber); margin-bottom: 0.75rem;
    display: flex; align-items: center; gap: 0.75rem;
  }
  .section-head::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

  /* Input mode tabs */
  .input-mode-tabs { display: flex; gap: 0; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; margin-bottom: 0.75rem; }
  .imt-btn {
    flex: 1; padding: 0.5rem; font-family: var(--font-mono); font-size: 0.52rem;
    letter-spacing: 0.08em; text-transform: uppercase; background: none; border: none;
    color: var(--ink-dim); cursor: pointer; transition: all var(--transition);
  }
  .imt-btn:not(:last-child) { border-right: 1px solid var(--rule); }
  .imt-btn.active { background: var(--amber-dim); color: var(--amber); }
  .imt-btn:hover:not(.active) { background: var(--surface2); color: var(--ink); }

  /* Doc upload zone */
  .doc-zone {
    border: 1.5px dashed var(--rule2); border-radius: var(--radius); padding: 1.5rem;
    text-align: center; cursor: pointer; transition: all var(--transition);
    background: var(--surface2);
  }
  .doc-zone:hover, .doc-zone.drag-over { border-color: var(--amber); background: var(--amber-glow); }
  .doc-zone-icon { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .doc-zone-label { font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); }
  .doc-zone-sub { font-family: var(--font-mono); font-size: 0.46rem; color: var(--ink-dim); margin-top: 0.25rem; }
  .doc-loaded { background: rgba(76,175,80,0.06); border-color: rgba(76,175,80,0.3); }
  .doc-loaded-name { font-family: var(--font-mono); font-size: 0.55rem; color: var(--green); margin-bottom: 0.25rem; }

  /* Signal candidates from doc */
  .signal-candidates { display: flex; flex-direction: column; gap: 0.5rem; }
  .signal-candidate {
    background: var(--surface2); border: 1px solid var(--rule);
    border-radius: var(--radius); padding: 0.85rem 1rem; cursor: pointer;
    transition: all var(--transition);
  }
  .signal-candidate:hover { border-color: var(--amber); }
  .signal-candidate.selected { border-color: var(--amber); background: var(--amber-glow); }
  .sc-signal { font-size: 0.88rem; color: var(--ink); line-height: 1.5; margin-bottom: 0.4rem; }
  .sc-why { font-family: var(--font-mono); font-size: 0.48rem; color: var(--ink-dim); line-height: 1.6; }
  .sc-tags { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
  .sc-tag { font-family: var(--font-mono); font-size: 0.42rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: 100px; color: #0A0A0A; }

  .signal-box {
    width: 100%; min-height: 130px; background: var(--surface2); border: 1px solid var(--rule);
    border-radius: var(--radius); padding: 1rem; font-family: var(--font-body);
    font-size: 1rem; color: var(--ink); resize: vertical; outline: none;
    line-height: 1.7; transition: border-color var(--transition);
  }
  .signal-box:focus { border-color: var(--amber); }
  .signal-box::placeholder { color: var(--ink-dim); font-style: italic; }

  .quality-gate {
    border-radius: var(--radius); padding: 0.85rem 1rem;
    display: flex; gap: 0.75rem; align-items: flex-start;
    font-family: var(--font-mono); font-size: 0.58rem; line-height: 1.6;
  }
  .quality-gate.green { background: rgba(76,175,80,0.08); border: 1px solid rgba(76,175,80,0.25); color: var(--green); }
  .quality-gate.amber { background: var(--amber-dim); border: 1px solid rgba(245,166,35,0.3); color: var(--amber); }
  .quality-gate.red   { background: rgba(239,83,80,0.08); border: 1px solid rgba(239,83,80,0.2); color: var(--red); }
  .gate-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.1rem; }

  .pillar-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .pillar-chip {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 0.3rem 0.75rem; border-radius: 100px;
    border: 1px solid var(--rule); background: none; color: var(--ink-dim);
    cursor: pointer; transition: all var(--transition);
  }
  .pillar-chip:hover { border-color: var(--rule2); color: var(--ink); }
  .pillar-chip.active { color: #0A0A0A; border-color: transparent; }

  /* Structure cards — replaces dropdown */
  .structure-grid { display: flex; flex-direction: column; gap: 0.4rem; }
  .structure-card {
    background: var(--surface2); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 0.65rem 0.85rem; cursor: pointer; transition: all var(--transition);
    display: flex; align-items: center; gap: 0.75rem;
  }
  .structure-card:hover { border-color: var(--rule2); }
  .structure-card.active { border-color: var(--amber); background: var(--amber-glow); }
  .sc-label { font-size: 0.85rem; color: var(--ink); line-height: 1.3; flex: 1; }
  .sc-short { font-family: var(--font-mono); font-size: 0.46rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--amber); flex-shrink: 0; }
  .structure-card:not(.active) .sc-label { color: var(--ink-mid); }

  .action-row { display: flex; gap: 0.75rem; }
  .btn-primary {
    flex: 1; padding: 0.75rem; background: var(--amber); color: #0A0A0A;
    border: none; border-radius: var(--radius); font-family: var(--font-disp);
    font-size: 1rem; letter-spacing: 0.06em; cursor: pointer; transition: all var(--transition);
  }
  .btn-primary:hover:not(:disabled) { background: #FFB93A; }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-secondary {
    padding: 0.75rem 1.25rem; background: none; border: 1px solid var(--rule);
    border-radius: var(--radius); font-family: var(--font-mono); font-size: 0.58rem;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim);
    cursor: pointer; transition: all var(--transition);
  }
  .btn-secondary:hover { border-color: var(--rule2); color: var(--ink); }
  .btn-secondary:disabled { opacity: 0.35; cursor: not-allowed; }

  /* Red-gate banner — blocks generation on red quality */
  .red-gate-banner {
    background: rgba(239,83,80,0.06); border: 1px solid rgba(239,83,80,0.2);
    border-radius: var(--radius); padding: 0.65rem 0.85rem;
    font-family: var(--font-mono); font-size: 0.52rem; color: var(--red); line-height: 1.6;
    display: flex; align-items: center; gap: 0.5rem;
  }

  /* Output */
  .output-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--rule); margin-bottom: 1rem; }
  .output-tab {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em;
    text-transform: uppercase; padding: 0.6rem 1rem; background: none; border: none;
    color: var(--ink-dim); cursor: pointer; border-bottom: 2px solid transparent;
    margin-bottom: -1px; transition: all var(--transition);
  }
  .output-tab.active { color: var(--amber); border-bottom-color: var(--amber); }
  .output-tab:hover:not(.active) { color: var(--ink); }

  .post-editor {
    width: 100%; min-height: 220px; background: var(--surface2); border: 1px solid var(--rule);
    border-radius: var(--radius); padding: 1rem; font-family: var(--font-body);
    font-size: 0.95rem; color: var(--ink); resize: vertical; outline: none;
    line-height: 1.75; transition: border-color var(--transition);
  }
  .post-editor:focus { border-color: var(--rule2); }

  .carousel-preview { display: flex; flex-direction: column; gap: 0.5rem; }
  .slide-card {
    background: var(--surface2); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 0.85rem 1rem; display: flex; gap: 0.85rem; align-items: flex-start;
  }
  .slide-num { font-family: var(--font-disp); font-size: 1.4rem; color: var(--amber); line-height: 1; flex-shrink: 0; width: 28px; }
  .slide-content { flex: 1; }
  .slide-headline { font-size: 0.9rem; font-weight: 500; color: var(--ink); margin-bottom: 0.25rem; line-height: 1.4; }
  .slide-body { font-family: var(--font-mono); font-size: 0.55rem; color: var(--ink-dim); line-height: 1.6; }
  .slide-tag { font-family: var(--font-mono); font-size: 0.45rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.2rem; }
  .slide-visual { font-family: var(--font-mono); font-size: 0.44rem; color: var(--ink-dim); margin-top: 0.35rem; font-style: italic; }

  .output-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .act-btn {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 0.4rem 0.85rem; background: none;
    border: 1px solid var(--rule); border-radius: var(--radius); color: var(--ink-dim);
    cursor: pointer; transition: all var(--transition);
  }
  .act-btn:hover { border-color: var(--amber); color: var(--amber); }
  .act-btn.success { border-color: var(--green); color: var(--green); }
  .act-btn.primary { background: var(--amber-dim); border-color: var(--amber); color: var(--amber); }
  .act-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── QUEUE ── */
  .queue-layout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .queue-col-head {
    font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-dim); padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--rule); margin-bottom: 0.75rem;
    display: flex; align-items: center; justify-content: space-between;
  }
  .queue-col-head span { background: var(--surface3); padding: 0.15rem 0.45rem; border-radius: 100px; font-size: 0.45rem; }
  .queue-card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 1rem; margin-bottom: 0.75rem; transition: border-color var(--transition);
  }
  .qc-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
  .qc-pillar-tag { font-family: var(--font-mono); font-size: 0.45rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.18rem 0.5rem; border-radius: 100px; color: #0A0A0A; }
  .qc-date { font-family: var(--font-mono); font-size: 0.45rem; color: var(--ink-dim); margin-left: auto; }
  .qc-source { font-family: var(--font-mono); font-size: 0.44rem; color: var(--ink-dim); font-style: italic; }
  .qc-preview { font-size: 0.82rem; color: var(--ink-mid); line-height: 1.5; margin-bottom: 0.75rem; }
  .qc-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .qc-btn {
    font-family: var(--font-mono); font-size: 0.45rem; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 0.25rem 0.6rem; background: none;
    border: 1px solid var(--rule); border-radius: var(--radius); color: var(--ink-dim);
    cursor: pointer; transition: all var(--transition);
  }
  .qc-btn:hover { border-color: var(--amber); color: var(--amber); }
  .qc-btn.green:hover { border-color: var(--green); color: var(--green); }
  .qc-btn.danger:hover { border-color: var(--red); color: var(--red); }
  .pdf-note { font-family: var(--font-mono); font-size: 0.48rem; color: var(--ink-dim); line-height: 1.8; padding: 0.85rem; background: var(--surface2); border-radius: var(--radius); }

  /* ── JOURNAL ── */
  .journal-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1px; background: var(--rule); border: 1px solid var(--rule);
    border-radius: var(--radius); overflow: hidden; margin-bottom: 1.5rem;
  }
  .js-card { background: var(--surface); padding: 1rem 1.25rem; }
  .js-label { font-family: var(--font-mono); font-size: 0.46rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 0.3rem; }
  .js-value { font-family: var(--font-disp); font-size: 2.2rem; line-height: 1; color: var(--ink); }
  .js-value.amber { color: var(--amber); }

  .journal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }

  .perf-chart { display: flex; flex-direction: column; gap: 0.75rem; }
  .perf-row { display: flex; align-items: center; gap: 0.75rem; }
  .perf-label { font-family: var(--font-mono); font-size: 0.5rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-mid); width: 90px; flex-shrink: 0; }
  .perf-track { flex: 1; height: 6px; background: var(--rule2); border-radius: 3px; overflow: hidden; }
  .perf-fill { height: 100%; border-radius: 3px; }
  .perf-val { font-family: var(--font-mono); font-size: 0.48rem; color: var(--ink-dim); width: 40px; text-align: right; }

  .filter-row { display: flex; gap: 0.4rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .filter-chip {
    font-family: var(--font-mono); font-size: 0.48rem; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 0.25rem 0.65rem; border-radius: 100px;
    border: 1px solid var(--rule); background: none; color: var(--ink-dim);
    cursor: pointer; transition: all var(--transition);
  }
  .filter-chip:hover { border-color: var(--rule2); color: var(--ink); }
  .filter-chip.active { background: var(--amber-dim); border-color: var(--amber); color: var(--amber); }

  .journal-log { display: flex; flex-direction: column; gap: 0.75rem; }
  .log-item { background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; }
  .log-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; cursor: pointer; transition: background var(--transition); }
  .log-header:hover { background: var(--surface2); }
  .log-pillar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .log-title { flex: 1; font-size: 0.88rem; color: var(--ink); line-height: 1.3; }
  .log-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .log-date { font-family: var(--font-mono); font-size: 0.46rem; color: var(--ink-dim); }
  .log-rating { display: flex; gap: 2px; }
  .log-star { font-size: 0.7rem; }
  .log-imp { font-family: var(--font-mono); font-size: 0.46rem; color: var(--amber); }
  .log-expand { padding: 0 1rem 1rem; border-top: 1px solid var(--rule); }
  .log-text { font-size: 0.85rem; color: var(--ink-mid); line-height: 1.7; padding-top: 0.75rem; white-space: pre-wrap; }
  .log-tags { display: flex; gap: 0.4rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .log-tag { font-family: var(--font-mono); font-size: 0.44rem; color: var(--ink-dim); }

  /* ── MODALS ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    backdrop-filter: blur(4px); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--rule2); border-radius: 6px;
    padding: 1.75rem; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
  }
  .modal-title { font-family: var(--font-disp); font-size: 1.6rem; letter-spacing: 0.04em; color: var(--ink); margin-bottom: 0.25rem; }
  .modal-title span { color: var(--amber); }
  .modal-sub { font-family: var(--font-mono); font-size: 0.52rem; color: var(--ink-dim); letter-spacing: 0.08em; margin-bottom: 1.5rem; line-height: 1.7; }
  .modal-label { font-family: var(--font-mono); font-size: 0.5rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 0.4rem; margin-top: 1rem; }
  .modal-input {
    width: 100%; background: var(--surface2); border: 1px solid var(--rule);
    border-radius: var(--radius); padding: 0.65rem 0.85rem;
    font-family: var(--font-mono); font-size: 0.7rem; color: var(--ink); outline: none;
    transition: border-color var(--transition);
  }
  .modal-input:focus { border-color: var(--amber); }
  .modal-textarea {
    width: 100%; min-height: 140px; background: var(--surface2); border: 1px solid var(--rule);
    border-radius: var(--radius); padding: 0.75rem 0.85rem;
    font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    resize: vertical; outline: none; line-height: 1.65; transition: border-color var(--transition);
  }
  .modal-textarea:focus { border-color: var(--amber); }
  .star-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .star-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; transition: transform var(--transition); }
  .star-btn:hover { transform: scale(1.2); }
  .modal-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
  .voice-fingerprint-preview { margin-top: 1rem; padding: 0.85rem; background: var(--surface2); border-radius: var(--radius); }
  .vfp-title { font-family: var(--font-mono); font-size: 0.48rem; color: var(--amber); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.1em; }
  .vfp-trait { font-family: var(--font-mono); font-size: 0.52rem; color: var(--ink-dim); line-height: 2; }
  .warn-box { background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.2); border-radius: var(--radius); padding: 0.65rem 0.85rem; font-family: var(--font-mono); font-size: 0.52rem; color: var(--amber); line-height: 1.6; margin-bottom: 1rem; }

  /* ── LOADING / ERROR ── */
  .loading-bar { height: 2px; background: var(--rule); border-radius: 1px; overflow: hidden; margin: 0.75rem 0; }
  .loading-fill { height: 100%; background: var(--amber); animation: loadpulse 1.2s ease-in-out infinite; }
  @keyframes loadpulse { 0% { width:0%;margin-left:0 } 50% { width:60%;margin-left:20% } 100% { width:0%;margin-left:100% } }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--rule2); border-top-color: var(--amber); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error-box { background: rgba(239,83,80,0.08); border: 1px solid rgba(239,83,80,0.25); border-radius: var(--radius); padding: 0.85rem 1rem; font-family: var(--font-mono); font-size: 0.58rem; color: var(--red); line-height: 1.6; }
  .empty-state { text-align: center; padding: 3rem 1rem; color: var(--ink-dim); }
  .empty-icon { font-size: 2rem; margin-bottom: 0.75rem; }
  .empty-text { font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .dash-grid { grid-template-columns: repeat(2, 1fr); }
    .dash-row, .studio-layout, .queue-layout, .journal-row { grid-template-columns: 1fr; }
    .journal-stats { grid-template-columns: repeat(2, 1fr); }
    .main { padding: 1.25rem 1rem; }
    .topbar-tag { display: none; }
  }
`;

// ── Main Component ────────────────────────────────────────────────────────────
export default function SignalPost() {
  // ── Persistent state ──
  const [apiKey, setApiKey]           = useState("");
  const [voiceProfile, setVoiceProfile] = useState(null);
  const [queue, setQueue]             = useState([]);
  const [journal, setJournal]         = useState([]);

  // ── Onboarding ──
  const [onboardStep, setOnboardStep] = useState(null); // null=done, "key", "voice"

  // ── Nav ──
  const [screen, setScreen]           = useState("dashboard");

  // ── Modals ──
  const [showKeyModal, setShowKeyModal]     = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [postModal, setPostModal]           = useState(null);
  const [voiceOverwriteConfirm, setVoiceOverwriteConfirm] = useState(false);

  // ── Studio state ──
  const [inputMode, setInputMode]         = useState("signal"); // "signal" | "doc"
  const [signal, setSignal]               = useState("");
  const [docFile, setDocFile]             = useState(null);    // { name, text }
  const [docLoading, setDocLoading]       = useState(false);
  const [docCandidates, setDocCandidates] = useState(null);    // extracted signal options
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [qualityResult, setQualityResult] = useState(null);
  const [gateLoading, setGateLoading]     = useState(false);
  const [selectedPillar, setSelectedPillar]   = useState("");
  const [selectedStructure, setSelectedStructure] = useState("");
  const [generating, setGenerating]       = useState(false);
  const [generated, setGenerated]         = useState(null);
  const [outputTab, setOutputTab]         = useState("hook");
  const [hookText, setHookText]           = useState("");
  const [error, setError]                 = useState("");
  const [copiedKey, setCopiedKey]         = useState("");
  const [pdfLoading, setPdfLoading]       = useState(false);

  // ── Voice modal ──
  const [voicePosts, setVoicePosts]       = useState("");

  // ── Post log modal ──
  const [postDate, setPostDate]           = useState("");
  const [postImpressions, setPostImpressions] = useState("");
  const [postRating, setPostRating]       = useState(0);

  // ── Journal ──
  const [expandedLog, setExpandedLog]     = useState(null);
  const [journalFilter, setJournalFilter] = useState("all");

  const fileInputRef = useRef(null);

  // ── Load from storage ──
  useEffect(() => {
    (async () => {
      const key = await storageGet(STORAGE_KEYS.apiKey);
      const v   = await storageGet(STORAGE_KEYS.voice);
      const q   = await storageGet(STORAGE_KEYS.queue);
      const j   = await storageGet(STORAGE_KEYS.journal);
      if (key) setApiKey(key);
      if (v)   setVoiceProfile(v);
      if (q)   setQueue(q);
      if (j)   setJournal(j);
      // Onboarding: if no key, show key step
      if (!key) setOnboardStep("key");
      else if (!v) setOnboardStep("voice");
    })();
  }, []);

  useEffect(() => { storageSet(STORAGE_KEYS.queue, queue); }, [queue]);
  useEffect(() => { storageSet(STORAGE_KEYS.journal, journal); }, [journal]);

  // ── Computed stats ──
  const totalPosts = journal.length;
  const avgRating  = journal.length
    ? (journal.reduce((s, j) => s + (j.rating || 0), 0) / journal.length).toFixed(1)
    : "—";

  // Streak — normalise to local date string to avoid UTC drift
  const toLocalDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const streak = (() => {
    if (!journal.length) return 0;
    const dates = [...new Set(journal.map(j => j.datePosted))].sort().reverse();
    let count = 0;
    const today = toLocalDate(new Date().toISOString());
    let cur = today;
    for (const d of dates) {
      const a = new Date(cur), b = new Date(d);
      const diff = Math.round((a - b) / 86400000);
      if (diff === 0 || diff === 1) { count++; cur = d; }
      else break;
    }
    return count;
  })();

  const longestStreak = (() => {
    if (!journal.length) return 0;
    const dates = [...new Set(journal.map(j => j.datePosted))].sort();
    let max = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]) - new Date(dates[i-1])) / 86400000);
      if (diff === 1) { cur++; max = Math.max(max, cur); }
      else cur = 1;
    }
    return journal.length ? max : 0;
  })();

  const pillarCounts = Object.keys(PILLARS).reduce((acc, p) => {
    acc[p] = journal.filter(j => j.pillar === p).length;
    return acc;
  }, {});

  const pillarAvgImp = Object.keys(PILLARS).reduce((acc, p) => {
    const entries = journal.filter(j => j.pillar === p && j.impressions);
    acc[p] = entries.length
      ? Math.round(entries.reduce((s, j) => s + (j.impressions || 0), 0) / entries.length)
      : 0;
    return acc;
  }, {});

  const daysSinceLast = (() => {
    if (!journal.length) return null;
    const last = new Date(journal[0].datePosted);
    return Math.floor((new Date() - last) / 86400000);
  })();

  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i));
    const ds = toLocalDate(d.toISOString());
    return { date: ds, posted: journal.some(j => j.datePosted === ds) };
  });

  // ── Handlers ──
  async function saveApiKey(val) {
    const k = val.trim();
    if (!k) return;
    setApiKey(k);
    await storageSet(STORAGE_KEYS.apiKey, k);
    setShowKeyModal(false);
    if (onboardStep === "key") {
      setOnboardStep(!voiceProfile ? "voice" : null);
    }
  }

  // Doc ingestion
  async function handleFileSelect(file) {
    if (!file) return;
    setDocLoading(true); setError(""); setDocCandidates(null); setSelectedCandidate(null);
    try {
      const text = await extractTextFromFile(file);
      setDocFile({ name: file.name, text });
      if (!apiKey) throw new Error("Add your Gemini API key first.");
      const result = await callGemini(apiKey, buildDocExtractPrompt(text), 800);
      setDocCandidates(result);
    } catch (e) {
      setError(e.message);
      setDocFile(null);
    }
    setDocLoading(false);
  }

  function pickCandidate(candidate) {
    setSelectedCandidate(candidate);
    setSignal(candidate.signal);
    setSelectedPillar(candidate.suggestedPillar || "");
    setSelectedStructure(candidate.suggestedStructure || "");
    setQualityResult(null); // Reset gate so user can re-analyse with the new signal
  }

  async function runQualityGate() {
    const sig = signal.trim();
    if (!sig || !apiKey) return;
    setGateLoading(true); setError(""); setQualityResult(null);
    try {
      const r = await callGemini(apiKey, buildQualityPrompt(sig, voiceProfile), 400);
      setQualityResult(r);
      // Auto-fill pillar/structure if not already set
      if (!selectedPillar && r.detectedPillar)     setSelectedPillar(r.detectedPillar);
      if (!selectedStructure && r.suggestedStructure) setSelectedStructure(r.suggestedStructure);
    } catch (e) { setError(e.message); }
    setGateLoading(false);
  }

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true); setError(""); setGenerated(null); setOutputTab("hook");
    try {
      const r = await callGemini(apiKey, buildGenerationPrompt(signal, selectedPillar, selectedStructure, voiceProfile), 2000);
      setGenerated(r);
      setHookText(r.hookPost || "");
    } catch (e) { setError(e.message); }
    setGenerating(false);
  }

  function saveToQueue(status) {
    if (!generated) return;
    const item = {
      id: uid(),
      signal,
      source: docFile ? `From: ${docFile.name}` : "Manual signal",
      pillar: selectedPillar,
      structure: selectedStructure,
      hookPost: hookText,
      carouselSlides: generated.carouselSlides,
      hashtags: generated.suggestedHashtags || [],
      status,
      createdAt: new Date().toISOString(),
    };
    setQueue(prev => [item, ...prev]);
    // Reset studio
    setGenerated(null); setSignal(""); setQualityResult(null);
    setSelectedPillar(""); setSelectedStructure(""); setHookText("");
    setDocFile(null); setDocCandidates(null); setSelectedCandidate(null);
    setScreen("queue");
  }

  function moveQueue(id, status) {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  function deleteQueueItem(id) {
    setQueue(prev => prev.filter(i => i.id !== id));
  }

  function openPostModal(item) {
    setPostModal(item);
    setPostDate(toLocalDate(new Date().toISOString()));
    setPostImpressions(""); setPostRating(0);
  }

  function confirmPosted() {
    if (!postModal) return;
    const entry = {
      id: uid(),
      postId: postModal.id,
      pillar: postModal.pillar,
      format: "hook-post",
      datePosted: postDate,
      impressions: postImpressions ? parseInt(postImpressions) : null,
      rating: postRating,
      postText: postModal.hookPost,
      headline: postModal.carouselSlides?.[0]?.headline || postModal.hookPost?.split("\n")[0] || "",
      source: postModal.source || "",
    };
    setJournal(prev => [entry, ...prev]);
    setQueue(prev => prev.filter(i => i.id !== postModal.id));
    setPostModal(null);
  }

  async function extractVoice(overwrite = false) {
    if (!voicePosts.trim() || !apiKey) return;
    if (voiceProfile && !overwrite) {
      setVoiceOverwriteConfirm(true);
      return;
    }
    setGateLoading(true);
    try {
      const r = await callGemini(apiKey, buildVoicePrompt(voicePosts), 600);
      setVoiceProfile(r);
      await storageSet(STORAGE_KEYS.voice, r);
      setShowVoiceModal(false);
      setVoicePosts("");
      setVoiceOverwriteConfirm(false);
      if (onboardStep === "voice") setOnboardStep(null);
    } catch (e) { setError(e.message); }
    setGateLoading(false);
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000);
    }).catch(() => {});
  }

  async function downloadPDF(item) {
    // PDF endpoint (generate-carousel-pdf.py) requires a Python serverless function.
    // For now, copy the carousel script and use Canva to design slides.
    const script = (item.carouselSlides || [])
      .map(s => `Slide ${s.slideNum} [${s.type}]\n${s.headline}\n${s.body || ""}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(script).then(() => {
      setError("Carousel script copied to clipboard — paste into Canva or Notion to design your slides. (PDF export coming soon)");
    });
  }

  // ── canGenerate logic — enforced quality gate ──
  const qualityBlocked = qualityResult?.quality === "red";
  const canGate    = signal.trim().length > 15 && !gateLoading && !!apiKey;
  const canGenerate = !!qualityResult && !qualityBlocked && !!selectedPillar && !!selectedStructure && !generating;

  // ── Onboarding screens ──
  if (onboardStep === "key") {
    return (
      <>
        <style>{STYLES}</style>
        <div className="app">
          <header className="topbar">
            <div className="topbar-brand">
              <div className="topbar-name">Signal<span>Post</span></div>
              <div className="topbar-tag">LinkedIn Content OS · Janardhan Labs</div>
            </div>
          </header>
          <main className="main">
            <div className="onboard-wrap">
              <div className="onboard-step">Step 1 of 2 — Setup</div>
              <div className="onboard-title">Your work already<br /><span>happened.</span></div>
              <div className="onboard-desc">
                SignalPost turns what you build and learn into LinkedIn posts that sound like you.<br /><br />
                It runs on your own Gemini API key — so your content, your key, your tokens. Nothing goes through our servers.
              </div>
              <ApiKeyForm onSave={saveApiKey} />
              <button className="onboard-skip" onClick={() => setOnboardStep("voice")}>Skip for now</button>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (onboardStep === "voice") {
    return (
      <>
        <style>{STYLES}</style>
        <div className="app">
          <header className="topbar">
            <div className="topbar-brand">
              <div className="topbar-name">Signal<span>Post</span></div>
              <div className="topbar-tag">LinkedIn Content OS · Janardhan Labs</div>
            </div>
          </header>
          <main className="main">
            <div className="onboard-wrap">
              <div className="onboard-step">Step 2 of 2 — Voice Fingerprint</div>
              <div className="onboard-title">Make it sound<br /><span>like you.</span></div>
              <div className="onboard-desc">
                Paste 2–3 of your best past LinkedIn posts below. One Gemini call extracts your writing DNA — sentence rhythm, hook style, vocabulary register. Every post you generate from now will be written in your voice, not generic AI voice.<br /><br />
                This takes 30 seconds and makes every output meaningfully better.
              </div>
              <textarea
                className="modal-textarea"
                style={{ minHeight: "180px", marginBottom: "1rem" }}
                placeholder={"Paste your best LinkedIn posts here, separated by ---\n\nThe more specific the post, the more accurate your fingerprint."}
                value={voicePosts}
                onChange={e => setVoicePosts(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="btn-primary" onClick={() => extractVoice(true)} disabled={!voicePosts.trim() || !apiKey || gateLoading}>
                  {gateLoading ? <span className="spinner" /> : "Extract My Voice"}
                </button>
                <button className="btn-secondary" onClick={() => setOnboardStep(null)}>Skip — I'll do this later</button>
              </div>
              {error && <div className="error-box" style={{ marginTop: "0.75rem" }}>{error}</div>}
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Screen renderers ──
  function Dashboard() {
    return (
      <div>
        <button className="cta-btn" onClick={() => setScreen("studio")}>
          ↯ Drop a Signal — Create a Post
        </button>

        <div className="dash-grid">
          <div className="stat-card">
            <div className="stat-label">Streak</div>
            <div className="stat-value amber">{streak}</div>
            <div className="stat-sub">days · best: {longestStreak}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Posts</div>
            <div className="stat-value">{totalPosts}</div>
            <div className="stat-sub">lifetime</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Rating</div>
            <div className="stat-value green">{avgRating}</div>
            <div className="stat-sub">out of 5</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Posted</div>
            <div className={`stat-value ${daysSinceLast > 4 ? "red" : "amber"}`} style={{ fontSize: "2rem" }}>
              {daysSinceLast === null ? "—" : daysSinceLast === 0 ? "Today" : `${daysSinceLast}d ago`}
            </div>
            <div className={`stat-sub ${daysSinceLast > 4 ? "warn" : ""}`}>
              {daysSinceLast === null ? "no posts yet" : daysSinceLast > 4 ? "⚠ overdue" : ""}
            </div>
          </div>
        </div>

        <div className="dash-row">
          <div className="panel">
            <div className="panel-title">Pillar Balance</div>
            <div className="pillar-bars">
              {Object.entries(PILLARS).map(([key, p]) => {
                const count = pillarCounts[key];
                const max   = Math.max(...Object.values(pillarCounts), 1);
                return (
                  <div key={key} className="pillar-row">
                    <div className="pillar-name">{p.label}</div>
                    <div className="pillar-track">
                      <div className="pillar-fill" style={{ width: `${(count/max)*100}%`, background: p.color }} />
                    </div>
                    <div className="pillar-count">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              Queue
              <span style={{ color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: "0.48rem" }}>
                {queue.filter(q=>q.status==="ready").length} ready
              </span>
            </div>
            <div className="queue-items">
              {queue.slice(0, 4).map(item => (
                <div key={item.id} className="queue-item-mini" onClick={() => setScreen("queue")}>
                  <div className="qi-pillar-dot" style={{ background: PILLARS[item.pillar]?.color }} />
                  <div className="qi-text">{item.hookPost?.split("\n")[0] || item.carouselSlides?.[0]?.headline}</div>
                  <div className={`qi-status ${item.status}`}>{item.status}</div>
                </div>
              ))}
              {queue.length === 0 && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--ink-dim)", textAlign: "center", padding: "1rem 0" }}>
                  Queue empty — create your first post ↑
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">28-Day Cadence</div>
          <div className="cadence-grid">
            {last28.map((d, i) => (
              <div key={i} className={`cadence-dot ${d.posted ? "posted" : "empty"}`} title={d.date} />
            ))}
          </div>
          <div className="cadence-days">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="cadence-day">{d}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function Studio() {
    const effectiveSignal = signal.trim();

    return (
      <div className="studio-layout">
        {/* LEFT — Input */}
        <div className="studio-left">

          {/* Input mode toggle */}
          <div>
            <div className="section-head">Input Mode</div>
            <div className="input-mode-tabs">
              <button className={`imt-btn ${inputMode === "signal" ? "active" : ""}`}
                onClick={() => { setInputMode("signal"); setDocFile(null); setDocCandidates(null); setSelectedCandidate(null); }}>
                ✏ Raw Signal
              </button>
              <button className={`imt-btn ${inputMode === "doc" ? "active" : ""}`}
                onClick={() => setInputMode("doc")}>
                ↑ From Document
              </button>
            </div>
          </div>

          {/* DOC MODE */}
          {inputMode === "doc" && (
            <div>
              <div className="section-head">Upload Work Artifact</div>
              <div
                className={`doc-zone ${docFile ? "doc-loaded" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
                onDrop={e => {
                  e.preventDefault(); e.currentTarget.classList.remove("drag-over");
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
              >
                {docLoading ? (
                  <><div className="doc-zone-icon"><span className="spinner" /></div><div className="doc-zone-label">Extracting signals…</div></>
                ) : docFile ? (
                  <><div className="doc-loaded-name">✓ {docFile.name}</div><div className="doc-zone-sub">Click to replace</div></>
                ) : (
                  <><div className="doc-zone-icon">↑</div><div className="doc-zone-label">Drop file or click to upload</div><div className="doc-zone-sub">.txt · .md · .pdf (max 20 pages)</div></>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />

              {docCandidates?.docSummary && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--ink-dim)", lineHeight: 1.7, padding: "0.5rem 0" }}>
                  Doc: {docCandidates.docSummary}
                </div>
              )}

              {docCandidates?.signals?.length > 0 && (
                <div>
                  <div className="section-head">Pick a Signal</div>
                  <div className="signal-candidates">
                    {docCandidates.signals.map((c, i) => (
                      <div
                        key={i}
                        className={`signal-candidate ${selectedCandidate === c ? "selected" : ""}`}
                        onClick={() => pickCandidate(c)}
                      >
                        <div className="sc-signal">{c.signal}</div>
                        <div className="sc-why">{c.why}</div>
                        <div className="sc-tags">
                          <span className="sc-tag" style={{ background: PILLARS[c.suggestedPillar]?.color }}>
                            {PILLARS[c.suggestedPillar]?.short || c.suggestedPillar}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.44rem", color: "var(--ink-dim)", alignSelf: "center" }}>
                            {STRUCTURES[c.suggestedStructure]?.short}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SIGNAL — shown in both modes after candidate picked or manual */}
          <div>
            <div className="section-head">
              {inputMode === "doc" && selectedCandidate ? "Selected Signal — Edit if needed" : "Raw Signal"}
            </div>
            <textarea
              className="signal-box"
              placeholder={inputMode === "doc"
                ? "Pick a signal above, or type your own here."
                : "Something you built, shipped, struggled with, or learned. One rough sentence is enough."}
              value={signal}
              onChange={e => { setSignal(e.target.value); setQualityResult(null); }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", color: "var(--ink-dim)" }}>
                {effectiveSignal.length} chars
              </span>
              <button className="btn-secondary" onClick={runQualityGate} disabled={!canGate}>
                {gateLoading ? <><span className="spinner" />&nbsp;Analysing</> : "Analyse Signal →"}
              </button>
            </div>
          </div>

          {/* Quality gate result */}
          {qualityResult && (
            <div className={`quality-gate ${qualityResult.quality}`}>
              <span className="gate-icon">
                {qualityResult.quality === "green" ? "✓" : qualityResult.quality === "amber" ? "⚠" : "✕"}
              </span>
              <span>{qualityResult.message}</span>
            </div>
          )}

          {/* Red gate hard block */}
          {qualityBlocked && (
            <div className="red-gate-banner">
              ✕ Fix the signal above before generating. A weak input produces a weak post — and wastes your tokens.
            </div>
          )}

          {/* Pillar + Structure — only show after quality gate passes */}
          {qualityResult && !qualityBlocked && (
            <>
              <div>
                <div className="section-head">Pillar</div>
                <div className="pillar-chips">
                  {Object.entries(PILLARS).map(([key, p]) => (
                    <button
                      key={key}
                      className={`pillar-chip ${selectedPillar === key ? "active" : ""}`}
                      style={selectedPillar === key ? { background: p.color } : {}}
                      onClick={() => setSelectedPillar(key)}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-head">Post Structure</div>
                <div className="structure-grid">
                  {Object.entries(STRUCTURES).map(([key, s]) => (
                    <div
                      key={key}
                      className={`structure-card ${selectedStructure === key ? "active" : ""}`}
                      onClick={() => setSelectedStructure(key)}
                    >
                      <div className="sc-label">{s.label}</div>
                      <div className="sc-short">{s.short}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-row">
                <button className="btn-primary" onClick={generate} disabled={!canGenerate}>
                  {generating ? <><span className="spinner" />&nbsp;Generating</> : "Generate Post"}
                </button>
              </div>
            </>
          )}

          {generating && <div className="loading-bar"><div className="loading-fill" /></div>}
          {error && <div className="error-box">{error}</div>}
        </div>

        {/* RIGHT — Output */}
        <div className="studio-right">
          {!generated ? (
            <div className="empty-state" style={{ marginTop: "4rem" }}>
              <div className="empty-icon">✦</div>
              <div className="empty-text">Your post appears here</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--ink-dim)", marginTop: "0.75rem", lineHeight: 2 }}>
                {inputMode === "doc"
                  ? "Upload a doc → pick a signal → analyse → generate"
                  : "Drop a signal → analyse → generate"}
              </div>
              {!voiceProfile && (
                <div style={{ marginTop: "1.5rem", fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--amber)", cursor: "pointer" }}
                  onClick={() => setShowVoiceModal(true)}>
                  ✦ Set your voice fingerprint for better output →
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", textTransform: "uppercase", letterSpacing: "0.1em", color: PILLARS[selectedPillar]?.color }}>
                  {PILLARS[selectedPillar]?.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.48rem", color: "var(--ink-dim)" }}>
                  {STRUCTURES[selectedStructure]?.short}
                </div>
                {voiceProfile && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.44rem", color: "var(--green)", marginLeft: "auto" }}>✦ Your voice</div>
                )}
              </div>

              <div className="output-tabs">
                <button className={`output-tab ${outputTab === "hook" ? "active" : ""}`}    onClick={() => setOutputTab("hook")}>Hook Post</button>
                <button className={`output-tab ${outputTab === "carousel" ? "active" : ""}`} onClick={() => setOutputTab("carousel")}>Carousel Script</button>
              </div>

              {outputTab === "hook" ? (
                <>
                  <textarea className="post-editor" value={hookText} onChange={e => setHookText(e.target.value)} />
                  {generated.suggestedHashtags?.length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--ink-dim)", lineHeight: 2 }}>
                      {generated.suggestedHashtags.map(h => `#${h}`).join("  ")}
                    </div>
                  )}
                </>
              ) : (
                <div className="carousel-preview">
                  {(generated.carouselSlides || []).map(slide => (
                    <div key={slide.slideNum} className="slide-card">
                      <div className="slide-num">{slide.slideNum}</div>
                      <div className="slide-content">
                        <div className="slide-tag">{slide.type}</div>
                        <div className="slide-headline">{slide.headline}</div>
                        {slide.body   && <div className="slide-body">{slide.body}</div>}
                        {slide.visual && <div className="slide-visual">↳ Visual: {slide.visual}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="output-actions">
                <button
                  className={`act-btn ${copiedKey === "post" ? "success" : ""}`}
                  onClick={() => copy(hookText + "\n\n" + (generated.suggestedHashtags||[]).map(h=>`#${h}`).join(" "), "post")}
                >
                  {copiedKey === "post" ? "Copied ✓" : "Copy Post"}
                </button>
                <button className="act-btn primary" onClick={() => downloadPDF({ ...generated, pillar: selectedPillar, hookPost: hookText })} disabled={pdfLoading}>
                  {pdfLoading ? <span className="spinner" /> : "↓ PDF"}
                </button>
                <button className="act-btn" onClick={() => saveToQueue("draft")}>Save Draft</button>
                <button className="act-btn" style={{ borderColor: "var(--green)", color: "var(--green)" }}
                  onClick={() => saveToQueue("ready")}>
                  Mark Ready →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function Queue() {
    const draftItems = queue.filter(q => q.status === "draft");
    const readyItems = queue.filter(q => q.status === "ready");

    function QueueCard({ item, showPostBtn }) {
      const pillar  = PILLARS[item.pillar];
      const preview = item.hookPost?.split("\n")[0] || item.carouselSlides?.[0]?.headline || "";
      const date    = new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return (
        <div className="queue-card">
          <div className="qc-header">
            <div className="qc-pillar-tag" style={{ background: pillar?.color }}>{pillar?.short}</div>
            {item.source && <div className="qc-source">{item.source}</div>}
            <div className="qc-date">{date}</div>
          </div>
          <div className="qc-preview">{preview}</div>
          <div className="qc-actions">
            {item.status === "draft" && (
              <button className="qc-btn green" onClick={() => moveQueue(item.id, "ready")}>Mark Ready</button>
            )}
            <button className={`qc-btn ${copiedKey === item.id ? "green" : ""}`}
              onClick={() => copy(item.hookPost + "\n\n" + (item.hashtags||[]).map(h=>`#${h}`).join(" "), item.id)}>
              {copiedKey === item.id ? "Copied ✓" : "Copy"}
            </button>
            <button className="qc-btn" onClick={() => downloadPDF(item)} disabled={pdfLoading}
              style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>
              PDF
            </button>
            {showPostBtn && (
              <button className="qc-btn green" onClick={() => openPostModal(item)}>✓ Posted</button>
            )}
            <button className="qc-btn danger" onClick={() => deleteQueueItem(item.id)}>Delete</button>
          </div>
        </div>
      );
    }

    return (
      <div className="queue-layout">
        <div>
          <div className="queue-col-head">Draft <span>{draftItems.length}</span></div>
          {draftItems.length === 0
            ? <div className="empty-state"><div className="empty-icon">◌</div><div className="empty-text">No drafts</div></div>
            : draftItems.map(item => <QueueCard key={item.id} item={item} showPostBtn={false} />)
          }
        </div>
        <div>
          <div className="queue-col-head">Ready <span>{readyItems.length}</span></div>
          {readyItems.length === 0
            ? <div className="empty-state"><div className="empty-icon">◌</div><div className="empty-text">No posts ready</div></div>
            : readyItems.map(item => <QueueCard key={item.id} item={item} showPostBtn={true} />)
          }
        </div>
        <div>
          <div className="queue-col-head">How to Post</div>
          <div className="pdf-note">
            <strong style={{ color: "var(--amber)" }}>Hook post:</strong> Copy → open LinkedIn → paste → post.<br /><br />
            <strong style={{ color: "var(--amber)" }}>Carousel:</strong> Download PDF → screenshot each slide → upload as images to LinkedIn.<br /><br />
            After posting, click <strong>✓ Posted</strong> to log impressions and rate it. This builds your performance data over time.
          </div>
        </div>
      </div>
    );
  }

  function Journal() {
    const maxImp     = Math.max(...Object.values(pillarAvgImp), 1);
    const filtered   = journalFilter === "all" ? journal : journal.filter(j => j.pillar === journalFilter);

    return (
      <div>
        <div className="journal-stats">
          <div className="js-card">
            <div className="js-label">Total Posts</div>
            <div className="js-value">{totalPosts}</div>
          </div>
          <div className="js-card">
            <div className="js-label">Current Streak</div>
            <div className="js-value amber">{streak}<span style={{ fontSize: "1rem" }}> days</span></div>
          </div>
          <div className="js-card">
            <div className="js-label">Longest Streak</div>
            <div className="js-value">{longestStreak}<span style={{ fontSize: "1rem" }}> days</span></div>
          </div>
          <div className="js-card">
            <div className="js-label">Avg Rating</div>
            <div className="js-value amber">{avgRating}</div>
          </div>
        </div>

        <div className="journal-row">
          <div className="panel">
            <div className="panel-title">Avg Impressions by Pillar</div>
            <div className="perf-chart">
              {Object.entries(PILLARS).map(([key, p]) => (
                <div key={key} className="perf-row">
                  <div className="perf-label">{p.label.split(" ")[0]}</div>
                  <div className="perf-track">
                    <div className="perf-fill" style={{ width: `${(pillarAvgImp[key]/maxImp)*100}%`, background: p.color }} />
                  </div>
                  <div className="perf-val">{pillarAvgImp[key] || "—"}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-title">Pillar Distribution</div>
            <div className="pillar-bars" style={{ marginTop: "0.5rem" }}>
              {Object.entries(PILLARS).map(([key, p]) => {
                const pct = totalPosts ? Math.round((pillarCounts[key]/totalPosts)*100) : 0;
                return (
                  <div key={key} className="pillar-row">
                    <div className="pillar-name">{p.label}</div>
                    <div className="pillar-track">
                      <div className="pillar-fill" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                    <div className="pillar-count">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="filter-row">
          <button className={`filter-chip ${journalFilter === "all" ? "active" : ""}`} onClick={() => setJournalFilter("all")}>All</button>
          {Object.entries(PILLARS).map(([key, p]) => (
            <button key={key} className={`filter-chip ${journalFilter === key ? "active" : ""}`} onClick={() => setJournalFilter(key)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="journal-log">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◌</div>
              <div className="empty-text">No posts logged yet — mark posts as posted from the Queue</div>
            </div>
          ) : filtered.map(entry => (
            <div key={entry.id} className="log-item">
              <div className="log-header" onClick={() => setExpandedLog(expandedLog === entry.id ? null : entry.id)}>
                <div className="log-pillar-dot" style={{ background: PILLARS[entry.pillar]?.color }} />
                <div className="log-title">{entry.headline || entry.postText?.split("\n")[0]}</div>
                <div className="log-meta">
                  {entry.impressions && <div className="log-imp">{entry.impressions.toLocaleString()} imp</div>}
                  <div className="log-rating">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className="log-star">{s <= (entry.rating||0) ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <div className="log-date">{entry.datePosted}</div>
                </div>
              </div>
              {expandedLog === entry.id && (
                <div className="log-expand">
                  <div className="log-text">{entry.postText}</div>
                  <div className="log-tags">
                    <span className="log-tag">{PILLARS[entry.pillar]?.label}</span>
                    <span className="log-tag">·</span>
                    <span className="log-tag">{entry.format}</span>
                    {entry.source && <><span className="log-tag">·</span><span className="log-tag">{entry.source}</span></>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-name">Signal<span>Post</span></div>
            <div className="topbar-tag">LinkedIn Content OS · Janardhan Labs</div>
          </div>
          <nav className="nav">
            {[["dashboard","Dashboard"],["studio","Studio"],["queue","Queue"],["journal","Journal"]].map(([id, label]) => (
              <button key={id} className={`nav-btn ${screen === id ? "active" : ""}`}
                onClick={() => { setScreen(id); setExpandedLog(null); }}>
                {label}
                {id === "queue" && queue.length > 0 && <span className="q-badge">{queue.length}</span>}
              </button>
            ))}
          </nav>
          <div className="key-indicator" onClick={() => setShowKeyModal(true)}>
            <div className={`key-dot ${apiKey ? "active" : ""}`} />
            {apiKey ? "Key active" : "Add API key"}
          </div>
          <button
            className={`voice-btn ${voiceProfile ? "set" : ""}`}
            onClick={() => setShowVoiceModal(true)}
          >
            {voiceProfile ? "✦ Voice set" : "Set voice →"}
          </button>
        </header>

        <main className="main">
          {screen === "dashboard" && <Dashboard />}
          {screen === "studio"    && <Studio />}
          {screen === "queue"     && <Queue />}
          {screen === "journal"   && <Journal />}
        </main>

        {/* API Key Modal */}
        {showKeyModal && (
          <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Gemini <span>API Key</span></div>
              <div className="modal-sub">Stays in your browser. Never sent to any server.</div>
              <ApiKeyForm onSave={saveApiKey} existing={apiKey} onCancel={() => setShowKeyModal(false)} />
            </div>
          </div>
        )}

        {/* Voice Modal */}
        {showVoiceModal && (
          <div className="modal-overlay" onClick={() => setShowVoiceModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Voice <span>Fingerprint</span></div>
              <div className="modal-sub">
                Paste 2–3 of your best LinkedIn posts. We extract your writing DNA — hook style, rhythm, vocabulary — and every generation will sound like you.
              </div>
              {voiceProfile && !voiceOverwriteConfirm && (
                <div className="voice-fingerprint-preview">
                  <div className="vfp-title">Current Fingerprint</div>
                  {voiceProfile.traits?.map((t, i) => (
                    <div key={i} className="vfp-trait">· {t}</div>
                  ))}
                </div>
              )}
              {voiceOverwriteConfirm && (
                <div className="warn-box">
                  ⚠ This will replace your current voice fingerprint. Are you sure?
                </div>
              )}
              <div className="modal-label">Your past posts</div>
              <textarea
                className="modal-textarea"
                placeholder={"Paste posts here, separated by ---\n\nThe more specific and genuine the post, the better the fingerprint."}
                value={voicePosts}
                onChange={e => { setVoicePosts(e.target.value); setVoiceOverwriteConfirm(false); }}
              />
              {error && <div className="error-box" style={{ marginTop: "0.75rem" }}>{error}</div>}
              <div className="modal-actions">
                <button className="btn-primary"
                  onClick={() => voiceProfile && !voiceOverwriteConfirm ? setVoiceOverwriteConfirm(true) : extractVoice(true)}
                  disabled={!voicePosts.trim() || !apiKey || gateLoading}>
                  {gateLoading ? <span className="spinner" /> : voiceOverwriteConfirm ? "Yes, replace fingerprint" : "Extract Voice"}
                </button>
                <button className="btn-secondary" onClick={() => { setShowVoiceModal(false); setVoiceOverwriteConfirm(false); setVoicePosts(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Post Logging Modal */}
        {postModal && (
          <div className="modal-overlay" onClick={() => setPostModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Log <span>Post</span></div>
              <div className="modal-sub">30 seconds now builds your performance data for months.</div>
              <div className="modal-label">Date Posted</div>
              <input className="modal-input" type="date" value={postDate} onChange={e => setPostDate(e.target.value)} />
              <div className="modal-label">Impressions (optional — fill in later if needed)</div>
              <input className="modal-input" type="number" placeholder="e.g. 1200" value={postImpressions} onChange={e => setPostImpressions(e.target.value)} />
              <div className="modal-label">Did it land? (1 = missed · 5 = nailed it)</div>
              <div className="star-row">
                {[1,2,3,4,5].map(s => (
                  <button key={s} className="star-btn" onClick={() => setPostRating(s)}>
                    {s <= postRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn-primary" onClick={confirmPosted}>Confirm Posted</button>
                <button className="btn-secondary" onClick={() => setPostModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Reusable ApiKeyForm ───────────────────────────────────────────────────────
function ApiKeyForm({ onSave, existing, onCancel }) {
  const [val, setVal] = useState(existing ? "••••••••••••••••" : "");
  const [editing, setEditing] = useState(!existing);

  return (
    <div>
      {!editing ? (
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <div style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--rule)", borderRadius: "var(--radius)", padding: "0.65rem 0.85rem", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--green)" }}>
            ✓ Key saved
          </div>
          <button className="btn-secondary" onClick={() => { setVal(""); setEditing(true); }}>Replace</button>
          {onCancel && <button className="btn-secondary" onClick={onCancel}>Close</button>}
        </div>
      ) : (
        <>
          <div style={{ marginTop: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--ink-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Paste your Google AI Studio key
          </div>
          <input
            className="modal-input"
            type="password"
            placeholder="AIza..."
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSave(val)}
            autoFocus
          />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", color: "var(--ink-dim)", marginTop: "0.4rem", lineHeight: 1.8 }}>
            Get a free key at aistudio.google.com → Create API key
          </div>
          <div className="modal-actions">
            <button className="btn-primary" onClick={() => onSave(val)} disabled={!val.trim()}>Save Key</button>
            {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
          </div>
        </>
      )}
    </div>
  );
}
