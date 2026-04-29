import { callGemini } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useQualityGate } from "../../shared/components/QualityGate";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState } from "react";


// ── Markdown export helper ──
function buildMarkdown(result, feature, productType, persona) {
  if (!result) return "";
  const lines = [];
  lines.push(`# SprintMind — ${feature}`);
  lines.push(`> Product: ${productType}${persona ? ` · Persona: ${persona}` : ""}`);
  lines.push("");

  if (result.prd) {
    lines.push("## PRD");
    lines.push("");
    if (result.prd.problemStatement) {
      lines.push("### Problem Statement");
      lines.push(result.prd.problemStatement);
      lines.push("");
    }
    if (result.prd.successMetrics?.length) {
      lines.push("### Success Metrics");
      result.prd.successMetrics.forEach(m => lines.push(`- ${m}`));
      lines.push("");
    }
    if (result.prd.edgeCases?.length) {
      lines.push("### Edge Cases");
      result.prd.edgeCases.forEach(e => lines.push(`- ${e}`));
      lines.push("");
    }
    if (result.prd.openQuestions?.length) {
      lines.push("### Open Questions");
      result.prd.openQuestions.forEach(q => lines.push(`- ${q}`));
      lines.push("");
    }
    if (result.prd.outOfScope?.length) {
      lines.push("### Out of Scope");
      result.prd.outOfScope.forEach(o => lines.push(`- ${o}`));
      lines.push("");
    }
  }

  if (result.jira?.epics?.length) {
    lines.push("## JIRA Hierarchy");
    lines.push("");
    result.jira.epics.forEach(epic => {
      lines.push(`## 🟦 Epic [${epic.id}]: ${epic.title}`);
      if (epic.description) lines.push(`> ${epic.description}`);
      lines.push("");
      (epic.features || []).forEach(feat => {
        lines.push(`### 🟩 Feature [${feat.id}]: ${feat.title}`);
        lines.push("");
        (feat.stories || []).forEach(story => {
          lines.push(`#### 🟨 Story [${story.id}] · ${priorityLabel(story.priority)} · ${story.points}pts`);
          lines.push(`**${story.title}**`);
          lines.push("");
          if (story.gherkin?.length) {
            lines.push("```gherkin");
            story.gherkin.forEach(g => lines.push(g));
            lines.push("```");
            lines.push("");
          }
          if (story.dependencies?.length) {
            lines.push(`**Dependencies:** ${story.dependencies.join(", ")}`);
            lines.push("");
          }
        });
      });
    });
  }
  return lines.join("\n");
}

function priorityLabel(p) {
  if (p === "P0") return "🔴 P0";
  if (p === "P1") return "🟠 P1";
  return "🟡 P2";
}

function epicPoints(epic) {
  return (epic.features || []).reduce((sum, f) =>
    sum + (f.stories || []).reduce((s2, st) => s2 + (Number(st.points) || 0), 0), 0
  );
}

// ── Copy hook ──
function useCopy() {
  const [copiedKey, setCopiedKey] = useState("");
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }).catch(() => {});
  };
  return { copiedKey, copy };
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fira+Code:wght@300;400;500&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; }

  :root {
    --bg:        #F8F9FC;
    --surface:   #FFFFFF;
    --surface2:  #F1F3F8;
    --surface3:  #E8EBF2;
    --blue:      #2563EB;
    --blue-dark: #1D4ED8;
    --blue-pale: #EFF6FF;
    --blue-mid:  #BFDBFE;
    --purple:    #7C3AED;
    --purple-pale:#F5F3FF;
    --purple-mid: #DDD6FE;
    --red:       #DC2626;
    --red-pale:  #FEF2F2;
    --amber:     #D97706;
    --amber-pale:#FFFBEB;
    --green:     #059669;
    --green-pale:#ECFDF5;
    --rule:      #E2E6F0;
    --rule2:     #CBD2E0;
    --ink:       #0F172A;
    --ink-mid:   #475569;
    --ink-dim:   #94A3B8;
    --font-head: 'Instrument Sans', sans-serif;
    --font-mono: 'Fira Code', monospace;
  }

  html, body { height:100%; }
  body { background:var(--bg); color:var(--ink); font-family:var(--font-head); }
  .app { min-height:100%; background:var(--bg); display:flex; flex-direction:column; }
  .page { flex:1; display:flex; flex-direction:column; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  /* ── HEADER ── */
  .site-header { background:var(--surface); border-bottom:2px solid var(--blue); padding:1rem 1.75rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .header-brand { display:flex; flex-direction:column; gap:0.1rem; }
  .header-eyebrow { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--blue); }
  .header-appname { font-size:1.5rem; font-weight:700; color:var(--ink); letter-spacing:-0.03em; line-height:1; }
  .header-appname span { color:var(--blue); }
  .header-tagline { font-family:var(--font-mono); font-size:0.52rem; color:var(--ink-dim); margin-top:0.15rem; }
  @media(max-width:480px){.header-tagline{display:none}}

  /* ── FOOTER ── */
  .site-footer { border-top:1px solid var(--rule); padding:1rem 1.75rem; display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap; background:var(--surface); }
  .footer-left  { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.08em; color:var(--ink-dim); }
  .footer-left strong { color:var(--blue); font-weight:600; }
  .footer-right { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.08em; color:var(--ink-dim); }

  /* ── MAIN ── */
  .main { max-width:1000px; margin:0 auto; padding:2rem 1.5rem 3rem; width:100%; flex:1; }

  /* ── INPUT FORM ── */
  .form-card { background:var(--surface); border:1px solid var(--rule); border-radius:8px; overflow:hidden; box-shadow:0 1px 12px rgba(15,23,42,0.06); margin-bottom:1.5rem; }
  .form-card-head { padding:1.1rem 1.75rem; border-bottom:1px solid var(--rule); display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; background:var(--blue-pale); }
  .form-card-title { font-size:1rem; font-weight:600; color:var(--ink); letter-spacing:-0.01em; }
  .form-card-body { padding:1.75rem; display:flex; flex-direction:column; gap:1.25rem; }

  .field { display:flex; flex-direction:column; gap:0.4rem; }
  .field-label { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--blue); font-weight:400; }
  .field-label .opt { color:var(--ink-dim); font-weight:300; text-transform:none; letter-spacing:0.04em; margin-left:0.3rem; }

  .idea-ta { width:100%; min-height:110px; resize:vertical; background:var(--surface2); border:1px solid var(--rule); border-radius:6px; padding:0.85rem 1rem; font-family:var(--font-head); font-size:0.95rem; color:var(--ink); line-height:1.65; outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
  .idea-ta:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
  .idea-ta::placeholder { color:var(--ink-dim); }

  .text-input { width:100%; padding:0.6rem 0.85rem; background:var(--surface2); border:1px solid var(--rule); border-radius:6px; font-family:var(--font-head); font-size:0.9rem; color:var(--ink); outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
  .text-input:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
  .text-input::placeholder { color:var(--ink-dim); }

  .fields-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; }
  @media(max-width:600px){ .fields-grid { grid-template-columns:1fr 1fr; } }
  @media(max-width:400px){ .fields-grid { grid-template-columns:1fr; } }

  .sel { width:100%; padding:0.6rem 0.85rem; background:var(--surface2); border:1px solid var(--rule); border-radius:6px; font-family:var(--font-head); font-size:0.9rem; color:var(--ink); outline:none; cursor:pointer; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 0.85rem center; padding-right:2.5rem; transition:border-color 0.2s,box-shadow 0.2s; }
  .sel:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,0.1); }

  /* section checkboxes */
  .section-checks { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .sec-chip { display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.75rem; border:1px solid var(--rule); border-radius:100px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.05em; cursor:pointer; user-select:none; color:var(--ink-mid); background:var(--surface2); transition:all 0.15s; }
  .sec-chip:hover { border-color:var(--blue); color:var(--blue); }
  .sec-chip.on { background:var(--blue-pale); border-color:var(--blue); color:var(--blue); }
  .sec-chip-dot { width:6px; height:6px; border-radius:50%; border:1.5px solid currentColor; flex-shrink:0; }
  .sec-chip.on .sec-chip-dot { background:var(--blue); }

  /* depth chips */
  .chips-row { display:flex; gap:0.4rem; flex-wrap:wrap; }
  .chip { padding:0.3rem 0.75rem; border:1px solid var(--rule); border-radius:4px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.05em; cursor:pointer; color:var(--ink-mid); background:var(--surface2); transition:all 0.15s; user-select:none; }
  .chip:hover { border-color:var(--blue); color:var(--blue); }
  .chip.on { background:var(--blue); border-color:var(--blue); color:white; }

  /* form footer */
  .form-footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding-top:0.5rem; border-top:1px solid var(--rule); margin-top:0.25rem; }
  .char-hint { font-family:var(--font-mono); font-size:0.5rem; color:var(--ink-dim); letter-spacing:0.06em; }
  .char-hint.warn { color:var(--amber); }
  .char-hint.ok   { color:var(--green); }

  .generate-btn { padding:0.75rem 2rem; background:var(--blue); color:white; border:none; border-radius:6px; font-family:var(--font-head); font-size:0.95rem; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap; letter-spacing:-0.01em; }
  .generate-btn:hover:not(:disabled) { background:var(--blue-dark); transform:translateY(-1px); box-shadow:0 4px 16px rgba(37,99,235,0.25); }
  .generate-btn:active:not(:disabled) { transform:translateY(0); }
  .generate-btn:disabled { background:var(--surface3); color:var(--ink-dim); cursor:not-allowed; transform:none; box-shadow:none; }
  @media(max-width:500px){ .generate-btn { width:100%; text-align:center; } }

  /* ── LOADING ── */
  .loading-wrap { background:var(--surface); border:1px solid var(--rule); border-radius:8px; padding:4rem 2rem; text-align:center; box-shadow:0 1px 12px rgba(15,23,42,0.06); }
  .loading-ring { width:44px; height:44px; border-radius:50%; border:2px solid var(--rule2); border-top-color:var(--blue); animation:spin 0.8s linear infinite; margin:0 auto 1.25rem; }
  .loading-txt  { font-size:0.95rem; font-weight:600; color:var(--ink); margin-bottom:0.3rem; }
  .loading-sub  { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-dim); }

  /* ── RESULTS TOOLBAR ── */
  .results-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
  .results-title { font-size:1.1rem; font-weight:700; color:var(--ink); letter-spacing:-0.02em; }
  .results-meta  { font-family:var(--font-mono); font-size:0.5rem; color:var(--ink-dim); letter-spacing:0.08em; margin-top:0.15rem; text-transform:uppercase; }
  .toolbar-right { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
  @media(max-width:640px){ .toolbar-right { width:100%; justify-content:flex-start; } }
  /* FIX F10: reset-btn visually separated on mobile via auto margin */
  @media(max-width:640px){ .toolbar-right .reset-btn { margin-left:auto; } }

  /* view toggle */
  .view-toggle { display:flex; background:var(--surface2); border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
  .view-btn { padding:0.4rem 1rem; font-family:var(--font-mono); font-size:0.6rem; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; color:var(--ink-mid); background:none; border:none; transition:all 0.15s; white-space:nowrap; }
  .view-btn.on { background:var(--blue); color:white; }

  .action-btn { padding:0.4rem 0.85rem; background:var(--surface); border:1px solid var(--rule); border-radius:5px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.06em; cursor:pointer; color:var(--ink-mid); transition:all 0.15s; white-space:nowrap; }
  .action-btn:hover { border-color:var(--blue); color:var(--blue); }
  .action-btn.copied { border-color:var(--green); color:var(--green); }

  .reset-btn { padding:0.4rem 0.85rem; background:none; border:1px solid var(--rule); border-radius:5px; font-family:var(--font-mono); font-size:0.58rem; letter-spacing:0.06em; cursor:pointer; color:var(--ink-dim); transition:all 0.15s; }
  .reset-btn:hover { border-color:var(--rule2); color:var(--ink); }

  /* ── PRD VIEW ── */
  .prd-grid { display:flex; flex-direction:column; gap:1rem; }
  .prd-card { background:var(--surface); border:1px solid var(--rule); border-radius:8px; overflow:hidden; animation:fadeUp 0.35s ease both; box-shadow:0 1px 8px rgba(15,23,42,0.04); }
  .prd-card:nth-child(1){animation-delay:0.04s} .prd-card:nth-child(2){animation-delay:0.08s}
  .prd-card:nth-child(3){animation-delay:0.12s} .prd-card:nth-child(4){animation-delay:0.16s}
  .prd-card:nth-child(5){animation-delay:0.2s}

  .prd-card-head { display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.25rem; background:var(--surface2); border-bottom:1px solid var(--rule); gap:0.75rem; }
  .prd-card-title { font-family:var(--font-mono); font-size:0.6rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--blue); }
  .prd-card-body { padding:1.1rem 1.25rem; }
  .prd-text { font-size:0.9rem; line-height:1.7; color:var(--ink-mid); }
  .prd-list { display:flex; flex-direction:column; gap:0.45rem; }
  .prd-item { display:flex; align-items:flex-start; gap:0.6rem; font-size:0.88rem; line-height:1.55; color:var(--ink-mid); }
  .prd-bullet { width:5px; height:5px; border-radius:50%; background:var(--blue); flex-shrink:0; margin-top:0.42rem; }

  /* ── JIRA VIEW ── */
  .jira-view { display:flex; flex-direction:column; gap:1rem; }

  /* Epic */
  .epic-block { background:var(--surface); border:1px solid var(--rule); border-radius:8px; overflow:hidden; animation:fadeUp 0.4s ease both; box-shadow:0 1px 8px rgba(15,23,42,0.04); }
  .epic-block:nth-child(1){animation-delay:0.04s} .epic-block:nth-child(2){animation-delay:0.1s}

  .epic-head { display:flex; align-items:center; gap:0.85rem; padding:0.9rem 1.25rem; cursor:pointer; user-select:none; transition:background 0.15s; }
  .epic-block:not(.open) .epic-head { border-bottom:1px solid var(--rule); }
  .epic-head:hover { background:var(--blue-pale); }
  .epic-color { width:4px; border-radius:2px; background:var(--blue); flex-shrink:0; align-self:stretch; min-height:1.2rem; }
  .epic-label { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--blue); margin-bottom:0.15rem; }
  .epic-title { font-size:1rem; font-weight:700; color:var(--ink); letter-spacing:-0.01em; }
  .epic-desc  { font-size:0.8rem; color:var(--ink-dim); margin-top:0.2rem; line-height:1.4; }
  .epic-meta  { display:flex; align-items:center; gap:0.6rem; margin-left:auto; flex-shrink:0; flex-wrap:wrap; }
  .epic-pts   { font-family:var(--font-mono); font-size:0.6rem; font-weight:700; color:var(--blue); background:var(--blue-pale); border:1px solid var(--blue-mid); border-radius:100px; padding:0.2rem 0.65rem; white-space:nowrap; }
  .epic-stories-count { font-family:var(--font-mono); font-size:0.55rem; color:var(--ink-dim); white-space:nowrap; }
  .epic-chevron { color:var(--ink-dim); font-size:0.7rem; transition:transform 0.2s; flex-shrink:0; }
  .epic-block.open .epic-chevron { transform:rotate(180deg); }
  .epic-body { padding:1rem 1.25rem 1.25rem; display:flex; flex-direction:column; gap:0.85rem; }
  .epic-body.closed { display:none; }

  /* Feature */
  .feat-block { background:var(--surface2); border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
  .feat-head { display:flex; align-items:center; gap:0.75rem; padding:0.7rem 1rem; cursor:pointer; user-select:none; transition:background 0.15s; }
  .feat-block:not(.open) .feat-head { border-bottom:1px solid var(--rule); }
  .feat-head:hover { background:var(--purple-pale); }
  .feat-color { width:3px; border-radius:2px; background:var(--purple); flex-shrink:0; align-self:stretch; min-height:1rem; }
  .feat-label { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--purple); margin-bottom:0.1rem; }
  .feat-title { font-size:0.88rem; font-weight:600; color:var(--ink); }
  .feat-chevron { color:var(--ink-dim); font-size:0.65rem; transition:transform 0.2s; margin-left:auto; flex-shrink:0; }
  .feat-block.open .feat-chevron { transform:rotate(180deg); }
  .feat-body { padding:0.85rem 1rem; display:flex; flex-direction:column; gap:0.65rem; }
  .feat-body.closed { display:none; }

  /* Story */
  .story-card { background:var(--surface); border:1px solid var(--rule); border-radius:5px; overflow:hidden; animation:fadeUp 0.3s ease both; }
  .story-head { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 1rem; }
  .story-card.has-body .story-head { border-bottom:1px solid var(--rule); }
  .story-badges { display:flex; align-items:center; gap:0.4rem; flex-shrink:0; margin-top:0.1rem; }
  .priority-badge { font-family:var(--font-mono); font-size:0.52rem; font-weight:700; letter-spacing:0.06em; padding:0.15rem 0.5rem; border-radius:3px; }
  .priority-badge.P0 { background:var(--red-pale);   color:var(--red);   border:1px solid rgba(220,38,38,0.2); }
  .priority-badge.P1 { background:var(--amber-pale); color:var(--amber); border:1px solid rgba(217,119,6,0.2); }
  .priority-badge.P2 { background:var(--green-pale); color:var(--green); border:1px solid rgba(5,150,105,0.2); }
  .points-badge { font-family:var(--font-mono); font-size:0.52rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:3px; background:var(--surface2); color:var(--ink-mid); border:1px solid var(--rule); white-space:nowrap; }
  .story-id { font-family:var(--font-mono); font-size:0.5rem; color:var(--ink-dim); white-space:nowrap; }
  .story-title { font-size:0.88rem; font-weight:500; color:var(--ink); line-height:1.45; flex:1; min-width:0; word-break:break-word; }
  .story-copy-btn { font-family:var(--font-mono); font-size:0.5rem; letter-spacing:0.06em; text-transform:uppercase; background:none; border:1px solid var(--rule); border-radius:3px; color:var(--ink-dim); padding:0.2rem 0.5rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; flex-shrink:0; }
  .story-copy-btn:hover { border-color:var(--blue); color:var(--blue); }
  .story-copy-btn.copied { border-color:var(--green); color:var(--green); }

  .story-body { padding:0.75rem 1rem; }
  .gherkin-block { background:var(--surface2); border-radius:4px; padding:0.75rem 0.9rem; font-family:var(--font-mono); font-size:0.72rem; line-height:1.8; color:var(--ink-mid); margin-bottom:0.65rem; border:1px solid var(--rule); overflow-x:auto; }
  .gherkin-given  { color:#1D4ED8; font-weight:700; }
  .gherkin-when   { color:#7C3AED; font-weight:700; }
  .gherkin-then   { color:#059669; font-weight:700; }
  .gherkin-and    { color:#475569; font-weight:700; }

  .story-deps { font-family:var(--font-mono); font-size:0.58rem; color:var(--ink-dim); display:flex; align-items:flex-start; gap:0.5rem; flex-wrap:wrap; }
  .dep-label { font-weight:700; color:var(--amber); flex-shrink:0; }
  .dep-tag { background:var(--amber-pale); border:1px solid rgba(217,119,6,0.2); border-radius:3px; padding:0.1rem 0.4rem; color:var(--amber); }

  /* ── ERROR ── */
  .error-box { background:#FEF2F2; border:1px solid rgba(220,38,38,0.25); border-radius:6px; padding:1rem 1.25rem; color:var(--red); font-size:0.88rem; line-height:1.6; margin-top:1rem; display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .error-close { font-family:var(--font-mono); font-size:0.52rem; letter-spacing:0.1em; text-transform:uppercase; background:none; border:1px solid rgba(220,38,38,0.3); border-radius:3px; color:var(--red); padding:0.25rem 0.6rem; cursor:pointer; white-space:nowrap; flex-shrink:0; }
`;

const PRODUCT_TYPES = ["B2B SaaS","Consumer App","Internal Tool","Marketplace","Mobile App"];
const PM_LEVELS     = ["Junior","Senior","Staff"];
const TEAM_SIZES    = ["Small (1–5)","Medium (6–15)","Large (16+)"];
const JIRA_DEPTHS   = ["Stories only","+ Acceptance Criteria","Full (AC + Points + Priority + Deps)"];
const PRD_SECTIONS  = ["problemStatement","successMetrics","edgeCases","openQuestions","outOfScope"];
const PRD_LABELS    = { problemStatement:"Problem Statement", successMetrics:"Success Metrics", edgeCases:"Edge Cases", openQuestions:"Open Questions", outOfScope:"Out of Scope" };

// Surprise feature: velocity estimator — calculates total sprint count based on team size
function sprintEstimate(result, teamSize) {
  if (!result?.jira?.epics) return null;
  const total = result.jira.epics.reduce((s, e) => s + epicPoints(e), 0);
  // FIX F3: hide estimator when all stories have 0pts (Stories-only depth)
  if (total === 0) return null;
  const velocity = teamSize === "Small (1–5)" ? 20 : teamSize === "Medium (6–15)" ? 45 : 80;
  const sprints = Math.ceil(total / velocity);
  return { total, velocity, sprints };
}

// Render Gherkin line with colour coding
function GherkinLine({ line }) {
  const kw = line.trim().split(" ")[0].toUpperCase();
  const cls = kw === "GIVEN" ? "gherkin-given" : kw === "WHEN" ? "gherkin-when" : kw === "THEN" ? "gherkin-then" : kw === "AND" ? "gherkin-and" : "";
  if (!cls) return <div>{line}</div>;
  const rest = line.trim().slice(kw.length);
  return <div><span className={cls}>{kw}</span>{rest}</div>;
}

function SprintMindApp() {
  const [idea, setIdea]               = useState("");
  const [productType, setProductType] = useState("B2B SaaS");
  const [pmLevel, setPmLevel]         = useState("Senior");
  const [teamSize, setTeamSize]       = useState("Medium (6–15)");
  const [persona, setPersona]         = useState("");
  const [jiraDepth, setJiraDepth]     = useState("Full (AC + Points + Priority + Deps)");
  const [prdSections, setPrdSections] = useState(new Set(PRD_SECTIONS));
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState("");
  const [view, setView]               = useState("prd"); // "prd" | "jira"
  const [openEpics, setOpenEpics]     = useState(new Set());
  const [openFeats, setOpenFeats]     = useState(new Set());
  const { copiedKey, copy }           = useCopy();

  const ideaTrim  = idea.trim();
  const canGen    = ideaTrim.length >= 20 && !loading;
  const qg = useQualityGate("sprint-mind");

  const toggleSection = (s) => setPrdSections(prev => {
    const next = new Set(prev);
    if (next.has(s)) { if (next.size > 1) next.delete(s); } else next.add(s);
    return next;
  });

  const toggleEpic = (id) => setOpenEpics(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleFeat = (id) => setOpenFeats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const generate = async () => {
    if (!canGen) return;
    setLoading(true); setError(""); setResult(null);

    const wantAC   = jiraDepth !== "Stories only";
    const wantFull = jiraDepth === "Full (AC + Points + Priority + Deps)";
    const sections = [...prdSections];

    // FIX F4: build prd fields as array, join with comma — no trailing comma risk
    const prdFields = [];
    // FIX F1: pre-build jira story field strings to avoid inline conditionals in JSON template
    const gherkinField = wantAC
      ? '"gherkin": ["Given [precondition]", "When [user action]", "Then [expected outcome]", "And [additional assertion]"]'
      : '"gherkin": []';
    const fullFields = wantFull
      ? '"points": 3, "priority": "P1", "dependencies": []'
      : '"points": 0, "priority": "P1", "dependencies": []';
    if (sections.includes("problemStatement")) prdFields.push('"problemStatement": "2-3 sentence problem statement"');
    if (sections.includes("successMetrics"))   prdFields.push('"successMetrics": ["metric 1 (quantified)", "metric 2", "metric 3"]');
    if (sections.includes("edgeCases"))        prdFields.push('"edgeCases": ["edge case 1", "edge case 2", "edge case 3"]');
    if (sections.includes("openQuestions"))    prdFields.push('"openQuestions": ["question 1", "question 2"]');
    if (sections.includes("outOfScope"))       prdFields.push('"outOfScope": ["item 1", "item 2"]');

    const prompt = `You are a Staff PM. Generate a full PRD and JIRA ticket hierarchy for this feature.

Feature: ${ideaTrim}
Product type: ${productType}
PM level calibration: ${pmLevel}
Team size: ${teamSize}
${persona ? `Primary user persona: ${persona}` : ""}

Return ONLY valid JSON, no markdown fences:
{
  "prd": {
    ${prdFields.join(",\n    ")}
  },
  "jira": {
    "epics": [
      {
        "id": "E1",
        "title": "Epic title",
        "description": "1 sentence epic description",
        "features": [
          {
            "id": "F1.1",
            "title": "Feature title",
            "stories": [
              {
                "id": "S1.1.1",
                "title": "As a [persona], I want [action] so that [outcome]",
                ${gherkinField},
                ${fullFields}
              }
            ]
          }
        ]
      }
    ]
  }
}

Rules:
- Generate 1-2 epics, 2-4 features per epic, 2-3 stories per feature
- Story points use Fibonacci: 1,2,3,5,8,13
- Priority: P0=critical/blocker, P1=high value, P2=nice to have
- Dependencies reference story IDs (e.g. "S1.1.2") that must be done first
- ${pmLevel === "Staff" ? "Include ambitious metrics, non-obvious edge cases, and systemic open questions" : pmLevel === "Senior" ? "Include realistic metrics and practical edge cases" : "Keep metrics simple and edge cases basic"}
- Gherkin: Given sets context, When describes user action, Then asserts outcome, And adds extra assertions`;

    try {
      const parsed = await callGemini(prompt, 2500);
      // Normalise jira structure
      if (parsed.jira?.epics) {
        parsed.jira.epics.forEach(ep => {
          (ep.features || []).forEach(ft => {
            (ft.stories || []).forEach(st => {
              st.points = Number(st.points) || 0;
              st.priority = ["P0","P1","P2"].includes(st.priority) ? st.priority : "P1";
              st.gherkin = Array.isArray(st.gherkin) ? st.gherkin : [];
              st.dependencies = Array.isArray(st.dependencies) ? st.dependencies : [];
            });
          });
        });
      }
      setResult(parsed);
      saveResult("sprint-mind", parsed);
      // Auto-open all epics and features
      const eIds = new Set((parsed.jira?.epics || []).map(e => e.id));
      const fIds = new Set((parsed.jira?.epics || []).flatMap(e => (e.features||[]).map(f => f.id)));
      setOpenEpics(eIds); setOpenFeats(fIds);
      setView("jira"); // default to JIRA view since that's the enhanced feature
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const exportMarkdown = () => {
    const md = buildMarkdown(result, ideaTrim, productType, persona);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprintmind-${ideaTrim.slice(0,30).replace(/\s+/g,"-").toLowerCase()}.md`;
    // FIX F9: must append to DOM for Firefox compatibility, then clean up
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const storyToText = (story) => {
    const lines = [`${story.id} · ${story.title}`, ""];
    if (story.gherkin?.length) { story.gherkin.forEach(g => lines.push(g)); lines.push(""); }
    if (story.points) lines.push(`Story Points: ${story.points}`);
    if (story.priority) lines.push(`Priority: ${story.priority}`);
    if (story.dependencies?.length) lines.push(`Dependencies: ${story.dependencies.join(", ")}`);
    return lines.join("\n");
  };

  const prdSectionText = (key, data) => {
    if (!data) return "";
    if (typeof data === "string") return `${PRD_LABELS[key]}\n\n${data}`;
    if (Array.isArray(data)) return `${PRD_LABELS[key]}\n\n${data.map(i => `• ${i}`).join("\n")}`;
    return "";
  };

  const vel = result ? sprintEstimate(result, teamSize) : null;
  const totalEpicStories = (epic) => (epic.features||[]).reduce((s,f)=>s+(f.stories||[]).length,0);

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="page">

          {/* ══ HEADER ══ */}
          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname">Sprint<span>Mind</span></h1>
              <p className="header-tagline">PRD + JIRA hierarchy from one sentence</p>
            </div>
          </header>

          <main className="main">

            {/* INPUT */}
            {!result && !loading && (
              <div className="form-card">
                <div className="form-card-head">
                  <span className="form-card-title">Describe your feature</span>
                </div>
                <div className="form-card-body">
                  <div className="field">
                    <label className="field-label" htmlFor="idea-ta">Feature idea</label>
                    <textarea id="idea-ta" className="idea-ta"
                      placeholder="e.g. Allow users to invite team members via email with role-based permissions, see pending invites, and resend or revoke them…"
                      value={idea} onChange={e => setIdea(e.target.value)} />
                  </div>

                  <div className="fields-grid">
                    <div className="field">
                      <label className="field-label">Product type</label>
                      <select className="sel" value={productType} onChange={e => setProductType(e.target.value)}>
                        {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">PM level</label>
                      <select className="sel" value={pmLevel} onChange={e => setPmLevel(e.target.value)}>
                        {PM_LEVELS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Team size</label>
                      <select className="sel" value={teamSize} onChange={e => setTeamSize(e.target.value)}>
                        {TEAM_SIZES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="persona-in">User persona <span className="opt">(optional)</span></label>
                    <input id="persona-in" className="text-input" type="text"
                      placeholder="e.g. enterprise procurement manager, solo freelancer, ops team lead…"
                      value={persona} onChange={e => setPersona(e.target.value)} />
                  </div>

                  <div className="field">
                    <label className="field-label">PRD sections to generate</label>
                    <div className="section-checks">
                      {PRD_SECTIONS.map(s => (
                        <div key={s} className={`sec-chip ${prdSections.has(s) ? "on" : ""}`} onClick={() => toggleSection(s)}>
                          <span className="sec-chip-dot" />
                          {PRD_LABELS[s]}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">JIRA depth</label>
                    <div className="chips-row">
                      {JIRA_DEPTHS.map(d => (
                        <button key={d} className={`chip ${jiraDepth === d ? "on" : ""}`} onClick={() => setJiraDepth(d)}>{d}</button>
                      ))}
                    </div>
                  </div>

                  <div className="form-footer">
                    <div className={`char-hint ${ideaTrim.length === 0 ? "" : ideaTrim.length < 20 ? "warn" : "ok"}`}>
                      {ideaTrim.length > 0 && (ideaTrim.length < 20 ? `${20 - ideaTrim.length} more chars needed` : `${ideaTrim.split(/\s+/).length} words`)}
                    </div>
                    <button className="generate-btn" style={{marginRight:"0.5rem"}}
              onClick={() => qg.analyse(ideaTrim)} disabled={qg.loading || !ideaTrim.trim() || !!qg.score}>
              {qg.loading ? "Checking…" : qg.score ? "✓ Checked" : "Check input →"}
            </button>
            {qg.score && (
              <div style={{padding:"0.5rem 0.75rem",marginBottom:"0.5rem",borderRadius:"4px",fontFamily:"var(--font-mono)",fontSize:"0.6rem",lineHeight:1.6,
                background:qg.score==="green"?"rgba(37,99,235,0.06)":qg.score==="amber"?"rgba(37,99,235,0.04)":"rgba(239,68,68,0.06)",
                border:`1px solid ${qg.score==="green"?"rgba(37,99,235,0.3)":qg.score==="amber"?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.3)"}`,
                color:qg.score==="green"?"var(--blue)":qg.score==="amber"?"#B45309":"#DC2626"}}>
                {qg.score==="green"?"✓":qg.score==="amber"?"⚠":"✕"} {qg.message}
              </div>
            )}
            <button className="generate-btn" onClick={generate} disabled={!canGen || qg.isBlocked}>
                      Generate PRD + JIRA →
                    </button>
                  </div>

                  {error && (
                    <div className="error-box" role="alert">
                      <span>{error}</span>
                      <button className="error-close" onClick={() => setError("")}>Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LOADING */}
            {loading && (
              <div className="loading-wrap" aria-live="polite">
                <div className="loading-ring" aria-hidden="true" />
                <div className="loading-txt">Generating PRD + JIRA hierarchy…</div>
                <div className="loading-sub">building epics · features · stories · gherkin</div>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <>
                {/* Toolbar */}
                <div className="results-toolbar">
                  <div>
                    <div className="results-title">{ideaTrim.length > 60 ? ideaTrim.slice(0,57)+"…" : ideaTrim}</div>
                    <div className="results-meta">
                      {productType} · {pmLevel} PM · {teamSize}
                      {vel ? ` · ~${vel.sprints} sprint${vel.sprints !== 1 ? "s" : ""} · ${vel.total}pts total` : ""}
                    </div>
                  </div>
                  <div className="toolbar-right">
                    <div className="view-toggle">
                      <button className={`view-btn ${view === "prd" ? "on" : ""}`} onClick={() => setView("prd")}>PRD</button>
                      <button className={`view-btn ${view === "jira" ? "on" : ""}`} onClick={() => setView("jira")}>JIRA</button>
                    </div>
                    <button className="action-btn" onClick={exportMarkdown}>↓ Export .md</button>
                    <button className={`action-btn ${copiedKey === "all" ? "copied" : ""}`} onClick={() => copy(buildMarkdown(result, ideaTrim, productType, persona), "all")}>
                      {copiedKey === "all" ? "Copied ✓" : "Copy all"}
                    </button>
                    <button id="notion-copy-btn" onClick={() => { const md = buildMarkdown(result, ideaTrim, productType, persona); navigator.clipboard.writeText(md).then(() => { const el = document.getElementById("notion-copy-btn"); if(el){ el.textContent = "Copied ✓"; setTimeout(()=>{ el.textContent = "Copy for Notion"; }, 2000); } }); }} style={{fontFamily:"var(--font-mono)",fontSize:"0.6rem",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.4rem 0.85rem",background:"none",border:"1px solid var(--blue)",borderRadius:"4px",color:"var(--blue)",cursor:"pointer",marginRight:"0.5rem"}}>Copy for Notion</button>
                    <button className="reset-btn" onClick={() => { setResult(null); setError(""); }}>← Edit</button>
                  </div>
                </div>

                {/* PRD VIEW */}
                {view === "prd" && result.prd && (() => {
                  const visibleSections = PRD_SECTIONS.filter(s => prdSections.has(s) && result.prd[s]);
                  if (!visibleSections.length) return (
                    <div style={{ background:"var(--surface)", border:"1px solid var(--rule)", borderRadius:"8px", padding:"2.5rem", textAlign:"center", color:"var(--ink-dim)", fontFamily:"var(--font-mono)", fontSize:"0.62rem", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                      No PRD sections selected — switch to JIRA view or go back to edit
                    </div>
                  );
                  return (
                  <div className="prd-grid">
                    {visibleSections.map(s => (
                      <div className="prd-card" key={s}>
                        <div className="prd-card-head">
                          <span className="prd-card-title">{PRD_LABELS[s]}</span>
                          <button
                            className={`action-btn ${copiedKey === s ? "copied" : ""}`}
                            onClick={() => copy(prdSectionText(s, result.prd[s]), s)}
                          >{copiedKey === s ? "Copied ✓" : "Copy"}</button>
                        </div>
                        <div className="prd-card-body">
                          {typeof result.prd[s] === "string" ? (
                            <p className="prd-text">{result.prd[s]}</p>
                          ) : (
                            <div className="prd-list">
                              {(result.prd[s] || []).map((item, i) => (
                                <div key={i} className="prd-item">
                                  <span className="prd-bullet" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  );
                })()}

                {/* JIRA VIEW */}
                {view === "jira" && result.jira?.epics && (
                  <div className="jira-view">
                    {result.jira.epics.map(epic => {
                      const isOpen = openEpics.has(epic.id);
                      const pts = epicPoints(epic);
                      const storyCount = totalEpicStories(epic);
                      return (
                        <div key={epic.id} className={`epic-block ${isOpen ? "open" : ""}`}>
                          <div className="epic-head" onClick={() => toggleEpic(epic.id)}>
                            <div className="epic-color" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="epic-label">Epic · {epic.id}</div>
                              <div className="epic-title">{epic.title}</div>
                              {epic.description && <div className="epic-desc">{epic.description}</div>}
                            </div>
                            <div className="epic-meta">
                              {pts > 0 && <span className="epic-pts">{pts} pts</span>}
                              <span className="epic-stories-count">{storyCount} stor{storyCount !== 1 ? "ies" : "y"}</span>
                              <button
                                className={`action-btn ${copiedKey === epic.id ? "copied" : ""}`}
                                style={{ fontSize: "0.5rem" }}
                                onClick={e => { e.stopPropagation(); copy(`${epic.id}: ${epic.title}\n${epic.description || ""}`, epic.id); }}
                              >{copiedKey === epic.id ? "✓" : "Copy"}</button>
                              <span className="epic-chevron">▾</span>
                            </div>
                          </div>

                          <div className={`epic-body ${isOpen ? "" : "closed"}`}>
                            {(epic.features || []).map(feat => {
                              const fOpen = openFeats.has(feat.id);
                              return (
                                <div key={feat.id} className={`feat-block ${fOpen ? "open" : ""}`}>
                                  <div className="feat-head" onClick={() => toggleFeat(feat.id)}>
                                    <div className="feat-color" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="feat-label">Feature · {feat.id}</div>
                                      <div className="feat-title">{feat.title}</div>
                                    </div>
                                    <span className="feat-chevron">▾</span>
                                  </div>

                                  <div className={`feat-body ${fOpen ? "" : "closed"}`}>
                                    {(feat.stories || []).map((story, si) => (
                                      <div key={story.id} className={`story-card${(story.gherkin?.length > 0 || story.dependencies?.length > 0) ? " has-body" : ""}`} style={{ animationDelay: `${si * 0.05}s` }}>
                                        <div className="story-head">
                                          <div className="story-badges">
                                            <span className={`priority-badge ${story.priority}`}>{story.priority}</span>
                                            {story.points > 0 && <span className="points-badge">{story.points}pt</span>}
                                            <span className="story-id">{story.id}</span>
                                          </div>
                                          <div className="story-title">{story.title}</div>
                                          <button
                                            className={`story-copy-btn ${copiedKey === story.id ? "copied" : ""}`}
                                            onClick={() => copy(storyToText(story), story.id)}
                                          >{copiedKey === story.id ? "Copied ✓" : "Copy"}</button>
                                        </div>
                                        {(story.gherkin?.length > 0 || story.dependencies?.length > 0) && (
                                          <div className="story-body">
                                            {story.gherkin?.length > 0 && (
                                              <div className="gherkin-block">
                                                {story.gherkin.map((line, li) => (
                                                  <GherkinLine key={li} line={line} />
                                                ))}
                                              </div>
                                            )}
                                            {story.dependencies?.length > 0 && (
                                              <div className="story-deps">
                                                <span className="dep-label">Blocked by:</span>
                                                {story.dependencies.map((d, di) => (
                                                  <span key={di} className="dep-tag">{d}</span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* SURPRISE: Velocity Estimator */}
                    {vel && (
                      <div style={{ background:"var(--blue-pale)", border:"1px solid var(--blue-mid)", borderRadius:"8px", padding:"1rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem", animation:"fadeUp 0.4s ease 0.3s both" }}>
                        <div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.52rem", letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--blue)", marginBottom:"0.25rem" }}>⚡ Velocity Estimate</div>
                          <div style={{ fontSize:"0.9rem", fontWeight:"600", color:"var(--ink)" }}>
                            ~{vel.sprints} sprint{vel.sprints !== 1 ? "s" : ""} to ship
                          </div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.52rem", color:"var(--ink-dim)", marginTop:"0.15rem" }}>
                            {vel.total}pts total · {vel.velocity}pts/sprint ({teamSize.split(" ")[0].toLowerCase()} team)
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
                          {result.jira.epics.map(e => (
                            <div key={e.id} style={{ textAlign:"center" }}>
                              <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.9rem", fontWeight:"700", color:"var(--blue)" }}>{epicPoints(e)}</div>
                              <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.5rem", color:"var(--ink-dim)", letterSpacing:"0.06em" }}>{e.id} pts</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </main>

          {/* ══ FOOTER ══ */}
          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
        </div>
      </div>
    </>
  );
}

export default function SprintMind() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("sprint-mind");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <SprintMindApp />
    </>
  );
}
