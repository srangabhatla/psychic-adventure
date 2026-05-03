import { callGemini, callGeminiRaw, setAppContext } from "../../shared/lib/gemini-client";
import { useApiKey } from "../../shared/components/KeyGate";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useState, useEffect, useRef } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
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
`;

const styles = `
  ${FONTS}
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --ink:#0e0c0a; --paper:#f5f0e8; --cream:#ede8da;
    --accent:#c8432a; --gold:#b8960c; --mid:#7a6f62;
    --light:#ccc4b4; --card:#ffffff; --border:#d4cfc4;
    --green:#2a7a4a;
  }
  body { font-family:'Libre Baskerville',Georgia,serif; background:var(--paper); color:var(--ink); min-height:100vh; }
  .shell { min-height:100vh; display:flex; flex-direction:column; }

  /* HEADER */
  .hdr { border-bottom:3px double var(--ink); padding:13px 28px; display:flex; align-items:center; gap:14px; background:var(--paper); position:sticky; top:0; z-index:200; }
  .logo { font-family:'Playfair Display',serif; font-size:23px; font-weight:900; letter-spacing:-0.5px; }
  .logo span { color:var(--accent); }
  .logo-sub { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--mid); }
  .hdr-right { margin-left:auto; display:flex; align-items:center; gap:10px; }
  .vbadge { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; background:var(--ink); color:var(--paper); padding:4px 10px; border-radius:2px; }
  .tab-nav { display:flex; gap:2px; background:var(--cream); border:1px solid var(--border); border-radius:4px; padding:3px; }
  .tnb { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; padding:5px 12px; border:none; background:transparent; color:var(--mid); cursor:pointer; border-radius:3px; transition:all 0.15s; white-space:nowrap; }
  .tnb.active { background:var(--ink); color:var(--paper); }

  /* LAYOUT */
  .main { flex:1; display:grid; grid-template-columns:390px 1fr; min-height:calc(100vh - 56px); }

  /* INPUT PANEL */
  .inp { border-right:1px solid var(--border); padding:24px 24px; background:var(--cream); display:flex; flex-direction:column; gap:18px; overflow-y:auto; }
  .plbl { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--mid); margin-bottom:4px; }
  .stitle { font-family:'Playfair Display',serif; font-size:17px; font-weight:700; color:var(--ink); border-left:3px solid var(--accent); padding-left:10px; margin-bottom:3px; }
  .sdesc { font-size:12px; line-height:1.7; color:var(--mid); }

  /* INPUT MODE */
  .mode-row { display:flex; gap:6px; }
  .mbtn { flex:1; padding:8px; border:1px solid var(--border); background:var(--card); border-radius:3px; cursor:pointer; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--mid); transition:all 0.15s; text-align:center; }
  .mbtn.active { background:var(--ink); border-color:var(--ink); color:var(--paper); }

  textarea { width:100%; height:170px; padding:12px; font-family:'Libre Baskerville',serif; font-size:12px; line-height:1.8; color:var(--ink); background:var(--card); border:1px solid var(--border); border-radius:3px; resize:vertical; outline:none; transition:border-color 0.2s; }
  textarea:focus { border-color:var(--ink); }
  .cc { font-family:'DM Mono',monospace; font-size:9px; color:var(--light); text-align:right; margin-top:3px; }

  /* UPLOAD */
  .upzone { border:2px dashed var(--border); border-radius:4px; padding:24px 16px; text-align:center; cursor:pointer; transition:all 0.2s; background:var(--card); }
  .upzone:hover { border-color:var(--accent); }
  .upzone.has-img { border-style:solid; border-color:var(--gold); }
  .up-icon { font-size:28px; margin-bottom:6px; }
  .up-lbl { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; color:var(--mid); text-transform:uppercase; }
  .up-prev { max-width:100%; max-height:120px; border-radius:3px; margin-top:8px; object-fit:contain; }
  .up-clr { font-family:'DM Mono',monospace; font-size:9px; color:var(--accent); cursor:pointer; text-decoration:underline; margin-top:5px; display:block; }

  /* DOMAIN */
  select { width:100%; padding:8px 11px; font-family:'DM Mono',monospace; font-size:10px; color:var(--ink); background:var(--card); border:1px solid var(--border); border-radius:3px; outline:none; cursor:pointer; }

  /* AI REC */
  .aibox { background:linear-gradient(135deg,#fef9ef,#fdf5e4); border:1px solid var(--gold); border-radius:4px; padding:11px 13px; display:flex; gap:9px; align-items:flex-start; }
  .aibox-icon { font-size:14px; flex-shrink:0; margin-top:1px; }
  .aibox-text { font-size:11px; line-height:1.6; color:var(--ink); }
  .aibox-text strong { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--gold); display:block; margin-bottom:2px; }

  /* FORMAT */
  .fgrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; }
  .fbtn { padding:8px 7px; border:1px solid var(--border); background:var(--card); border-radius:3px; cursor:pointer; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:0.5px; text-transform:uppercase; color:var(--mid); transition:all 0.15s; text-align:left; }
  .fbtn:hover { border-color:var(--ink); color:var(--ink); }
  .fbtn.active { background:var(--ink); border-color:var(--ink); color:var(--paper); }
  .fbtn.suggested { border-color:var(--gold); }
  .ficon { display:block; font-size:13px; margin-bottom:2px; }

  /* BUTTONS */
  .genbtn { width:100%; padding:13px; background:var(--accent); color:white; border:none; border-radius:3px; font-family:'Playfair Display',serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:9px; }
  .genbtn:hover:not(:disabled) { background:#a33420; transform:translateY(-1px); }
  .genbtn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
  .savebtn { width:100%; padding:9px; background:transparent; color:var(--green); border:1px solid var(--green); border-radius:3px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; cursor:pointer; transition:all 0.15s; }
  .savebtn:hover { background:var(--green); color:white; }

  .spin { width:13px; height:13px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* OUTPUT */
  .out { padding:28px 32px; overflow-y:auto; background:var(--paper); }
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; color:var(--light); text-align:center; }
  .empty-g { font-size:52px; opacity:0.3; }
  .empty-t { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }

  .vwrap { animation:fu 0.4s ease; }
  @keyframes fu { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .vhdr { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:6px; }
  .vtitle { font-family:'Playfair Display',serif; font-size:19px; font-weight:900; }
  .vmeta { font-family:'DM Mono',monospace; font-size:9px; color:var(--mid); letter-spacing:1px; }

  /* ACTION BAR */
  .abar { display:flex; gap:7px; margin-top:18px; padding-top:14px; border-top:1px solid var(--border); }
  .abtn { padding:6px 13px; border:1px solid var(--border); background:var(--card); border-radius:3px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--mid); cursor:pointer; transition:all 0.15s; }
  .abtn:hover { border-color:var(--ink); color:var(--ink); }

  /* ANNOTATION */
  .ann-sec { margin-top:18px; padding-top:14px; border-top:1px solid var(--border); }
  .ann-lbl { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--mid); margin-bottom:7px; }
  .ann-ta { width:100%; padding:9px 11px; font-family:'Libre Baskerville',serif; font-size:12px; color:var(--ink); background:var(--card); border:1px solid var(--border); border-radius:3px; outline:none; transition:border-color 0.2s; resize:vertical; min-height:56px; }
  .ann-ta:focus { border-color:var(--ink); }

  /* VISUALS — CONCEPT MAP */
  .cmap { display:flex; flex-direction:column; gap:14px; }
  .ccore { background:var(--ink); color:var(--paper); padding:16px 22px; border-radius:4px; text-align:center; }
  .ccore-lbl { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:3px; text-transform:uppercase; color:var(--light); margin-bottom:4px; }
  .ccore-t { font-family:'Playfair Display',serif; font-size:16px; font-weight:700; }
  .cbranches { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cbranch { border:1px solid var(--border); border-radius:4px; padding:12px; background:var(--card); position:relative; overflow:hidden; }
  .cbranch::before { content:''; position:absolute; top:0; left:0; width:3px; height:100%; background:var(--gold); }
  .cbh { font-family:'Playfair Display',serif; font-size:13px; font-weight:700; margin-bottom:6px; padding-left:8px; }
  .cbpts { list-style:none; padding-left:8px; }
  .cbpts li { font-size:11.5px; line-height:1.6; color:var(--mid); padding:2px 0 2px 12px; position:relative; }
  .cbpts li::before { content:'—'; position:absolute; left:0; color:var(--light); }

  /* KEY POINTS */
  .kplist { display:flex; flex-direction:column; gap:10px; }
  .kpcard { display:flex; gap:12px; background:var(--card); border:1px solid var(--border); border-radius:4px; padding:12px 16px; align-items:flex-start; }
  .kpnum { font-family:'Playfair Display',serif; font-size:22px; font-weight:900; color:var(--accent); line-height:1; min-width:30px; }
  .kph { font-family:'Playfair Display',serif; font-size:13px; font-weight:700; margin-bottom:3px; }
  .kpd { font-size:11.5px; line-height:1.7; color:var(--mid); }

  /* HIERARCHY */
  .htree { display:flex; flex-direction:column; gap:7px; }
  .h0 { background:var(--ink); color:var(--paper); padding:11px 16px; border-radius:4px; font-family:'Playfair Display',serif; font-size:14px; font-weight:700; }
  .h1 { margin-left:18px; background:var(--cream); border:1px solid var(--border); padding:9px 14px; border-radius:4px; font-family:'Playfair Display',serif; font-size:13px; font-weight:700; position:relative; }
  .h1::before { content:''; position:absolute; left:-18px; top:50%; width:14px; height:1px; background:var(--border); }
  .h2 { margin-left:36px; padding:5px 12px; font-size:11.5px; line-height:1.6; color:var(--mid); border-left:2px solid var(--border); }

  /* TIMELINE */
  .tl { display:flex; flex-direction:column; position:relative; }
  .tl::before { content:''; position:absolute; left:14px; top:8px; bottom:8px; width:2px; background:var(--border); }
  .tli { display:flex; gap:16px; padding:9px 0; position:relative; }
  .tldot { width:30px; height:30px; border-radius:50%; background:var(--accent); color:white; font-family:'DM Mono',monospace; font-size:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; z-index:1; }
  .tlc { background:var(--card); border:1px solid var(--border); border-radius:4px; padding:10px 14px; flex:1; }
  .tlh { font-family:'Playfair Display',serif; font-size:13px; font-weight:700; margin-bottom:3px; }
  .tld { font-size:11.5px; line-height:1.6; color:var(--mid); }

  /* COMPARISON TABLE */
  .ctbl { width:100%; border-collapse:collapse; font-size:11.5px; }
  .ctbl th { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; background:var(--ink); color:var(--paper); padding:9px 12px; text-align:left; }
  .ctbl th:first-child { background:var(--cream); color:var(--ink); width:120px; }
  .ctbl td { padding:9px 12px; border:1px solid var(--border); vertical-align:top; line-height:1.6; color:var(--mid); }
  .ctbl td:first-child { font-family:'Playfair Display',serif; font-weight:700; font-size:12px; color:var(--ink); background:var(--cream); }
  .ctbl tr:nth-child(even) td { background:#fafaf7; }

  /* VENN */
  .venn { display:grid; grid-template-columns:1fr 1fr 1fr; gap:9px; }
  .vc { border-radius:4px; padding:12px; }
  .vcl { background:#fff8f0; border:2px solid #e8a87c; }
  .vcc { background:#f0fff4; border:2px solid #7cb98e; }
  .vcr { background:#f0f4ff; border:2px solid #7c8eb9; }
  .vlbl { font-family:'Playfair Display',serif; font-size:12px; font-weight:700; margin-bottom:7px; }
  .vitems { list-style:none; }
  .vitems li { font-size:11px; line-height:1.6; color:var(--mid); padding:2px 0 2px 10px; position:relative; }
  .vitems li::before { content:'·'; position:absolute; left:0; }

  /* FLASHCARDS */
  .fcgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .fc { perspective:1000px; cursor:pointer; height:120px; }
  .fci { position:relative; width:100%; height:100%; transition:transform 0.5s; transform-style:preserve-3d; }
  .fc.flipped .fci { transform:rotateY(180deg); }
  .fcf, .fcb { position:absolute; width:100%; height:100%; backface-visibility:hidden; border-radius:4px; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:12px; text-align:center; }
  .fcf { background:var(--ink); color:var(--paper); }
  .fcb { background:var(--card); border:1px solid var(--gold); transform:rotateY(180deg); }
  .fclbl { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:2px; text-transform:uppercase; margin-bottom:5px; }
  .fcf .fclbl { color:var(--light); }
  .fcb .fclbl { color:var(--gold); }
  .fcq { font-family:'Playfair Display',serif; font-size:12px; font-weight:700; line-height:1.4; }
  .fca { font-size:11.5px; line-height:1.6; color:var(--mid); }
  .fchint { font-family:'DM Mono',monospace; font-size:8px; color:var(--light); text-align:center; margin-top:6px; letter-spacing:1px; }

  /* HISTORY */
  .hpanel { padding:28px 32px; overflow-y:auto; }
  .hpanel h2 { font-family:'Playfair Display',serif; font-size:21px; font-weight:900; margin-bottom:5px; }
  .hdesc { font-size:12px; color:var(--mid); margin-bottom:22px; }
  .hempty { text-align:center; padding:60px 20px; color:var(--light); }
  .hempty-icon { font-size:44px; margin-bottom:10px; opacity:0.4; }
  .hempty-t { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }
  .sgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; }
  .scard { background:var(--card); border:1px solid var(--border); border-radius:4px; padding:16px; cursor:pointer; transition:all 0.15s; }
  .scard:hover { border-color:var(--ink); transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.06); }
  .sname { font-family:'Playfair Display',serif; font-size:14px; font-weight:700; margin-bottom:3px; }
  .smeta { font-family:'DM Mono',monospace; font-size:8px; color:var(--mid); letter-spacing:1px; text-transform:uppercase; }
  .sdel { float:right; font-size:9px; color:var(--light); cursor:pointer; font-family:'DM Mono',monospace; }
  .sdel:hover { color:var(--accent); }
  .hlbl { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--mid); margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:7px; }

  /* TOAST */
  .toast { position:fixed; bottom:22px; right:22px; background:var(--ink); color:var(--paper); font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1px; padding:9px 16px; border-radius:4px; z-index:1000; animation:ti 0.3s ease; }
  @keyframes ti { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  .errbox { background:#fff5f5; border:1px solid #fcc; border-radius:4px; padding:12px 16px; color:var(--accent); font-size:12px; font-family:'DM Mono',monospace; }
`;

// ── DATA ───────────────────────────────────────────────────────────────────
const FORMATS = [
  { id:"concept",    label:"Concept Map",   icon:"🕸" },
  { id:"keypoints",  label:"Key Points",    icon:"📌" },
  { id:"hierarchy",  label:"Hierarchy",     icon:"🌲" },
  { id:"timeline",   label:"Timeline",      icon:"📅" },
  { id:"comparison", label:"Compare",       icon:"⚖️" },
  { id:"venn",       label:"Venn",          icon:"◎" },
  { id:"flashcards", label:"Flashcards",    icon:"🃏" },
];

const DOMAINS = [
  { v:"auto",       l:"✦ Auto-detect (AI picks format)" },
  { v:"science",    l:"Science & Biology" },
  { v:"history",    l:"History & Social Studies" },
  { v:"law",        l:"Law & Policy" },
  { v:"economics",  l:"Economics & Finance" },
  { v:"philosophy", l:"Philosophy & Ethics" },
  { v:"technology", l:"Technology & CS" },
  { v:"literature", l:"Literature & Language" },
  { v:"maths",      l:"Mathematics" },
];

const DOMAIN_FMT = { science:"concept", history:"timeline", law:"hierarchy", economics:"comparison", philosophy:"venn", technology:"hierarchy", literature:"keypoints", maths:"flashcards" };

const PROMPTS = {
  concept:    `Return ONLY valid JSON: {"title":"short title","central":"5-8 words","branches":[{"heading":"Branch","points":["p1","p2","p3"]}]} 4 branches, 3 points each.`,
  keypoints:  `Return ONLY valid JSON: {"title":"short title","points":[{"heading":"Concept","detail":"1-2 sentences"}]} 5-7 points.`,
  hierarchy:  `Return ONLY valid JSON: {"title":"short title","nodes":[{"level":0,"text":"Top"},{"level":1,"text":"Sub"},{"level":2,"text":"Detail"}]} 10-14 nodes.`,
  timeline:   `Return ONLY valid JSON: {"title":"short title","items":[{"heading":"Phase","detail":"1-2 sentences"}]} 5-7 sequential items.`,
  comparison: `Return ONLY valid JSON: {"title":"short title","items":["A","B"],"attributes":["Attr"],"data":{"A":{"Attr":"val"},"B":{"Attr":"val"}}} Compare 2-3 items across 4-6 attributes.`,
  venn:       `Return ONLY valid JSON: {"title":"short title","left":{"label":"A","items":["u1","u2","u3"]},"center":{"label":"Shared","items":["s1","s2","s3"]},"right":{"label":"B","items":["u1","u2","u3"]}} Two concepts and shared traits.`,
  flashcards: `Return ONLY valid JSON: {"title":"short title","cards":[{"q":"Question?","a":"Answer."}]} 6-8 cards.`,
  recommend:  `Analyze notes. Return ONLY valid JSON: {"domain":"science|history|law|economics|philosophy|technology|literature|maths","format":"concept|keypoints|hierarchy|timeline|comparison|venn|flashcards","reason":"1 sentence"} Pick best visual format.`,
};

function parseJSON(t) {
  if (!t) return null;
  // Strip markdown fences Gemini wraps around JSON
  let s = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // Direct parse first
  try { return JSON.parse(s); } catch {}
  // Extract first {...} block — handles any leading/trailing prose
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function claude(system, content) {
  return callGeminiRaw(`${system}\n\n${content}`, 1200);
}

async function claudeMultimodal(imageB64, system) {
  const contents = [{
    role: "user",
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: imageB64 } },
      { text: system }
    ]
  }];
  return callGeminiRaw(contents, 1200);
}

// ── VISUAL RENDERERS ────────────────────────────────────────────────────────
function ConceptMap({data}) {
  return <div className="cmap">
    <div className="ccore"><div className="ccore-lbl">Core Concept</div><div className="ccore-t">{data.central}</div></div>
    <div className="cbranches">{data.branches?.map((b,i)=>(
      <div className="cbranch" key={i}>
        <div className="cbh">{b.heading}</div>
        <ul className="cbpts">{b.points?.map((p,j)=><li key={j}>{p}</li>)}</ul>
      </div>
    ))}</div>
  </div>;
}

function KeyPoints({data}) {
  return <div className="kplist">{data.points?.map((p,i)=>(
    <div className="kpcard" key={i}>
      <div className="kpnum">{String(i+1).padStart(2,"0")}</div>
      <div><div className="kph">{p.heading}</div><div className="kpd">{p.detail}</div></div>
    </div>
  ))}</div>;
}

function Hierarchy({data}) {
  return <div className="htree">{data.nodes?.map((n,i)=><div key={i} className={`h${n.level}`}>{n.text}</div>)}</div>;
}

function Timeline({data}) {
  return <div className="tl">{data.items?.map((it,i)=>(
    <div className="tli" key={i}>
      <div className="tldot">{i+1}</div>
      <div className="tlc"><div className="tlh">{it.heading}</div><div className="tld">{it.detail}</div></div>
    </div>
  ))}</div>;
}

function Comparison({data}) {
  const items = data.items||[]; const attrs = data.attributes||[];
  return <table className="ctbl">
    <thead><tr><th></th>{items.map((it,i)=><th key={i}>{it}</th>)}</tr></thead>
    <tbody>{attrs.map((a,i)=>(
      <tr key={i}><td>{a}</td>{items.map((it,j)=><td key={j}>{data.data?.[it]?.[a]||"—"}</td>)}</tr>
    ))}</tbody>
  </table>;
}

function Venn({data}) {
  return <div className="venn">
    <div className="vc vcl"><div className="vlbl">{data.left?.label}</div><ul className="vitems">{data.left?.items?.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
    <div className="vc vcc"><div className="vlbl">{data.center?.label}</div><ul className="vitems">{data.center?.items?.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
    <div className="vc vcr"><div className="vlbl">{data.right?.label}</div><ul className="vitems">{data.right?.items?.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
  </div>;
}

function Flashcards({data}) {
  const [fl,setFl]=useState({});
  return <div>
    <div className="fcgrid">{data.cards?.map((c,i)=>(
      <div key={i} className={`fc ${fl[i]?"flipped":""}`} onClick={()=>setFl(f=>({...f,[i]:!f[i]}))}>
        <div className="fci">
          <div className="fcf"><span className="fclbl">Question</span><span className="fcq">{c.q}</span></div>
          <div className="fcb"><span className="fclbl">Answer</span><span className="fca">{c.a}</span></div>
        </div>
      </div>
    ))}</div>
    <div className="fchint">Click any card to flip</div>
  </div>;
}

function renderV(fmt, data) {
  if(fmt==="concept")    return <ConceptMap data={data}/>;
  if(fmt==="keypoints")  return <KeyPoints data={data}/>;
  if(fmt==="hierarchy")  return <Hierarchy data={data}/>;
  if(fmt==="timeline")   return <Timeline data={data}/>;
  if(fmt==="comparison") return <Comparison data={data}/>;
  if(fmt==="venn")       return <Venn data={data}/>;
  if(fmt==="flashcards") return <Flashcards data={data}/>;
  return null;
}

// ── HISTORY TAB ──────────────────────────────────────────────────────────────
function HistoryTab({sets, onLoad, onDel}) {
  return <div className="hpanel">
    <h2>Study Sets</h2>
    <div className="hdesc">Your saved visuals — click any card to load it back into the generator.</div>
    {sets.length===0 ? (
      <div className="hempty"><div className="hempty-icon">◈</div><div className="hempty-t">No saved sets yet</div></div>
    ) : (
      <>
        <div className="hlbl">Saved · {sets.length} set{sets.length!==1?"s":""}</div>
        <div className="sgrid">{sets.map((s,i)=>(
          <div className="scard" key={i} onClick={()=>onLoad(s)}>
            <span className="sdel" onClick={e=>{e.stopPropagation();onDel(i);}}>✕</span>
            <div className="sname">{s.title||"Untitled"}</div>
            <div className="smeta">{FORMATS.find(f=>f.id===s.format)?.label} · {s.domain} · {s.date}</div>
            {s.annotation && <div style={{fontSize:11,color:"#7a6f62",marginTop:8,fontStyle:"italic"}}>"{s.annotation}"</div>}
          </div>
        ))}</div>
      </>
    )}
  </div>;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
function VisualMindApp() {
  const [tab,setTab]           = useState("generate");
  const [notes,setNotes]       = useState("");
  const [mode,setMode]         = useState("text");      // text | image
  const [imgB64,setImgB64]     = useState(null);
  const [imgPrev,setImgPrev]   = useState(null);
  const [domain,setDomain]     = useState("auto");
  const [format,setFormat]     = useState("concept");
  const [suggested,setSuggested]= useState(null);
  const [loading,setLoading]   = useState(false);
  const [result,setResult]     = useState(null);
  const [error,setError]       = useState(null);
  const [annotation,setAnnotation] = useState("");
  const [sets,setSets]         = useState([]);
  const [toast,setToast]       = useState(null);
  const fileRef                = useRef();

  useEffect(()=>{
    try { const r=localStorage.getItem("jl-vm-sets"); if(r) setSets(JSON.parse(r)); } catch{}
  },[]);

  function showToast(m){setToast(m);setTimeout(()=>setToast(null),2400);}

  useEffect(()=>{
    if(domain!=="auto" && DOMAIN_FMT[domain]){
      setFormat(DOMAIN_FMT[domain]); setSuggested(DOMAIN_FMT[domain]);
    } else if(domain==="auto"){ setSuggested(null); }
  },[domain]);

  function recommend(text){
    const t=(text||notes).toLowerCase();
    if(!t.trim()||domain!=="auto") return;
    let fmt="concept";
    if(/\bvs\b|compare|difference|versus|contrast/.test(t)) fmt="comparison";
    else if(/steps?|process|sequence|first.*then|stages?|procedure|phases?/.test(t)) fmt="timeline";
    else if(/types?|categor|classif|kinds?|groups?|hierarch/.test(t)) fmt="hierarchy";
    else if(/define|definition|term|meaning|vocabulary|glossary/.test(t)) fmt="flashcards";
    else if(/both|overlap|similar|common|shared/.test(t)) fmt="venn";
    else if(/key points?|summary|main|important|bullet/.test(t)) fmt="keypoints";
    setSuggested(fmt); setFormat(fmt);
  }

  function handleFile(e){
    const f=e.target.files[0]; if(!f) return;
    if(f.type==='application/pdf'){
      // For PDFs, read as text if possible, otherwise show filename
      const r=new FileReader();
      r.onload=ev=>{
        setImgPrev(null); setImgB64(null);
        setNotes(ev.target.result||''); setMode('text');
        showToast('PDF text extracted — review and generate');
      };
      r.readAsText(f);
      return;
    }
    const r=new FileReader();
    r.onload=ev=>{const full=ev.target.result;setImgPrev(full);setImgB64(full.split(',')[1]);};
    r.readAsDataURL(f);
  }

  async function generate(){
    const hasText=notes.trim().length>0;
    const hasImg=mode==="image"&&imgB64;
    if(!hasText&&!hasImg) return;
    setLoading(true); setResult(null); setError(null); setAnnotation("");
    try {
      let text=notes;
      if(hasImg){
        // Image input: use multimodal call to extract text first
        const extractedText = await callGeminiRaw("Extract and transcribe these handwritten study notes into clean readable text. Return only the transcribed text.", 1000);
        text = extractedText || notes;
        setNotes(text); setMode("text");
      }
      const system = `You are a study visual generator. Analyze the notes and ${PROMPTS[format]} Return ONLY the JSON object, no explanation.`;
      const parsed = await callGemini(system, text, 1200);
      if(!parsed || typeof parsed !== 'object') throw new Error("Could not generate visual — please try again");
      setResult({format,data:parsed});
      saveResult("visualmind", {format, data:parsed});
    } catch(e){ if (!e.message.startsWith("__COOLDOWN__")) setError(e.message); }
    setLoading(false);
  }

  async function saveSet(){
    if(!result) return;
    const entry={title:result.data.title||"Untitled",format:result.format,domain,data:result.data,notes,annotation:annotation.trim(),date:new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})};
    const updated=[entry,...sets];
    setSets(updated);
    try { localStorage.setItem("jl-vm-sets",JSON.stringify(updated)); } catch{}
    showToast("Saved to study sets ✓");
  }

  function loadSet(s){setResult({format:s.format,data:s.data});setNotes(s.notes||"");setDomain(s.domain||"auto");setFormat(s.format);setAnnotation(s.annotation||"");setTab("generate");}

  async function delSet(i){
    const updated=sets.filter((_,idx)=>idx!==i);
    setSets(updated);
    try { localStorage.setItem("jl-vm-sets",JSON.stringify(updated)); } catch{}
    showToast("Deleted");
  }

  const fmtOpt=FORMATS.find(f=>f.id===result?.format);

  return <>
    <style>{styles}</style>
    <div className="shell">

      {/* HEADER */}
      <header className="hdr">
        <div><div className="logo">Visual<span>Mind</span></div><div className="logo-sub">AI Study Visual Generator</div></div>
        <div className="hdr-right">
          <div className="tab-nav">
            <button className={`tnb ${tab==="generate"?"active":""}`} onClick={()=>setTab("generate")}>Generate</button>
            <button className={`tnb ${tab==="history"?"active":""}`} onClick={()=>setTab("history")}>Study Sets{sets.length>0?` (${sets.length})`:""}</button>
          </div>
          <div className="vbadge">v3.0</div>
        </div>
      </header>

      {tab==="history" ? (
        <HistoryTab sets={sets} onLoad={loadSet} onDel={delSet}/>
      ) : (
        <div className="main">

          {/* INPUT */}
          <div className="inp">
            <div>
              <div className="plbl">01 — Input Mode</div>
              <div className="mode-row">
                <button className={`mbtn ${mode==="text"?"active":""}`} onClick={()=>setMode("text")}>📝 Text Notes</button>
                <button className={`mbtn ${mode==="image"?"active":""}`} onClick={()=>setMode("image")}>📷 Handwritten</button>
              </div>
            </div>

            {mode==="text" ? (
              <div>
                <div className="stitle">Paste your notes</div>
                <div className="sdesc">Lecture notes, textbook excerpts, research summaries.</div>
                <div style={{marginTop:9}}>
                  <textarea placeholder="e.g. The mitochondria is the powerhouse of the cell…" value={notes} onChange={e=>{setNotes(e.target.value);recommend(e.target.value);}}/>
                  <div className="cc">{notes.length} chars</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="stitle">Upload handwritten notes</div>
                <div className="sdesc">Photo or scan — AI extracts and structures the content.</div>
                <div style={{marginTop:9}}>
                  <div className={`upzone ${imgPrev?"has-img":""}`} onClick={()=>fileRef.current.click()}>
                    {imgPrev ? <>
                      <img src={imgPrev} className="up-prev" alt="preview"/>
                      <span className="up-clr" onClick={e=>{e.stopPropagation();setImgPrev(null);setImgB64(null);}}>✕ Remove</span>
                    </> : <>
                      <div className="up-icon">📷</div>
                      <div className="up-lbl">Tap to upload image or PDF</div>
                    </>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFile}/>
                </div>
              </div>
            )}

            <div>
              <div className="plbl">02 — Subject Domain</div>
              <select value={domain} onChange={e=>setDomain(e.target.value)}>
                {DOMAINS.map(d=><option key={d.v} value={d.v}>{d.l}</option>)}
              </select>
            </div>

            {suggested && domain==="auto" && <div className="aibox"><div className="aibox-icon">✦</div><div className="aibox-text"><strong>Format detected</strong>{FORMATS.find(f=>f.id===suggested)?.label} — best match for your notes.</div></div>}

            <div>
              <div className="plbl">03 — Visual Format</div>
              <div className="fgrid">
                {FORMATS.map(opt=>(
                  <button key={opt.id} className={`fbtn ${format===opt.id?"active":""} ${suggested===opt.id&&format!==opt.id?"suggested":""}`} onClick={()=>setFormat(opt.id)}>
                    <span className="ficon">{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="genbtn" onClick={generate} disabled={loading||(!notes.trim()&&!imgB64)}>
              {loading?<><div className="spin"/>Generating…</>:"Generate Visual Summary →"}
            </button>

            {result && <button className="savebtn" onClick={saveSet}>+ Save to Study Sets</button>}
          </div>

          {/* OUTPUT */}
          <div className="out">
            {error && <div className="errbox">Error: {error}</div>}
            {!result&&!error && <div className="empty"><div className="empty-g">◈</div><div className="empty-t">Your visual will appear here</div></div>}
            {result && <div className="vwrap">
              <div className="vhdr">
                <div className="vtitle">{result.data.title}</div>
                <div className="vmeta">{fmtOpt?.label} · {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
              </div>
              {renderV(result.format, result.data)}
              <div className="ann-sec">
                <div className="ann-lbl">Your Annotation</div>
                <textarea className="ann-ta" placeholder="Add a note about this visual…" value={annotation} onChange={e=>setAnnotation(e.target.value)}/>
              </div>
              <div className="abar">
                <button className="abtn" onClick={()=>{navigator.clipboard.writeText(JSON.stringify(result.data,null,2));showToast("Copied ✓");}}>Copy JSON</button>
                <button className="abtn" onClick={()=>{setResult(null);setAnnotation("");}}>Clear</button>
                <button className="abtn" onClick={saveSet}>Save to Sets</button>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
    {toast && <div className="toast">{toast}</div>}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
  </>;
}

export default function VisualMind() {
  const { isKeySet, KeyGate, Banner } = useApiKey("visualmind");
  setAppContext("visualmind");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <VisualMindApp />
    </>
  );
}
