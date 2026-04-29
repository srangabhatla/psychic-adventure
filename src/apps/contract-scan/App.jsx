import { callGemini } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState, useRef } from "react";


// ── Copy hook ──
function useCopy() {
  const [key, setKey] = useState("");
  const copy = (text, k) => {
    navigator.clipboard.writeText(text).then(() => { setKey(k); setTimeout(() => setKey(""), 2000); }).catch(() => {});
  };
  return { copiedKey: key, copy };
}

// ── Read file as base64 ──
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── Read file as text ──
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ── HTML report export ──
function exportReport(result) {
  const rc = (r) => r === "High" ? "#E53E3E" : r === "Medium" ? "#DD6B20" : "#38A169";
  const esc = (s) => (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const li = (arr) => (arr||[]).map(i=>`<li>${esc(i)}</li>`).join("");
  const flags = (result.riskFlags||[]).map(f=>`
    <div style="border-left:3px solid ${rc(f.risk)};padding:10px 14px;margin-bottom:10px;background:#f7f7f7;border-radius:0 4px 4px 0">
      <div style="margin-bottom:5px"><span style="font-size:10px;font-weight:700;color:${rc(f.risk)};text-transform:uppercase;letter-spacing:1px">${esc(f.risk)} RISK</span>${f.isUnusual?' &nbsp;<span style="font-size:10px;color:#666;border:1px solid #ccc;padding:1px 6px;border-radius:10px">Unusual clause</span>':''}</div>
      <p style="font-size:11px;color:#333;line-height:1.6;margin:0 0 6px">${esc(f.explanation)}</p>
      ${f.clause?`<p style="font-size:10px;color:#888;font-style:italic;margin:0;border-top:1px solid #e5e5e5;padding-top:6px">"${esc(f.clause.slice(0,200))}${f.clause.length>200?"…":""}"</p>`:""}
    </div>`).join("");
  const neg = (result.negotiation||[]).map(n=>`
    <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e5e5;border-radius:6px">
      <p style="font-size:12px;font-weight:600;color:#111;margin:0 0 5px">${esc(n.clause)}</p>
      <p style="font-size:11px;color:#555;margin:0 0 8px">${esc(n.why)}</p>
      ${n.suggestion?`<div style="background:#EBF8FF;padding:8px 10px;border-radius:4px;font-size:11px;color:#1a56db;font-style:italic">"${esc(n.suggestion)}"</div>`:""}
    </div>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ContractScan Report</title>
<style>body{font-family:Georgia,serif;color:#111;margin:0;padding:0;background:#fff}.page{max-width:700px;margin:0 auto;padding:48px 40px}
h1{font-size:22px;color:#0f2419;margin:0 0 4px}
.meta{font-size:11px;color:#666;font-family:monospace;margin-bottom:28px}
.disc{background:#fffde7;border:1px solid #f0c040;border-radius:6px;padding:10px 14px;font-size:11px;color:#7a5c00;margin-bottom:28px;line-height:1.6}
.sec{margin-bottom:28px}h2{font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2419;border-bottom:2px solid #10B981;padding-bottom:5px;margin-bottom:14px}
ul{padding-left:18px;margin:0}li{margin-bottom:5px;font-size:12px;line-height:1.6;color:#333}
.foot{margin-top:40px;padding-top:14px;border-top:1px solid #e5e5e5;font-size:10px;color:#aaa;font-family:monospace;display:flex;justify-content:space-between}
</style></head><body><div class="page">
<h1>ContractScan Report</h1>
<div class="meta">${esc(result._snapType)} · ${esc(result._snapRole)} · ${esc(result._snapJuri !== "Not specified" ? result._snapJuri : "")} · ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
<div class="disc">⚠ This report is for informational purposes only and does not constitute legal advice. Consult a qualified lawyer before signing any legally binding document.</div>
<div class="sec"><h2>Plain English Summary</h2><ul>${li(result.summary)}</ul></div>
<div class="sec"><h2>Risk Flags (${(result.riskFlags||[]).length})</h2>${flags}</div>
<div class="sec"><h2>What You're Actually Agreeing To</h2><ul>${li(result.commitments)}</ul></div>
<div class="sec"><h2>Negotiation Leverage</h2>${neg}</div>
<div class="sec"><h2>Questions to Ask Before Signing</h2><ul>${li(result.questions)}</ul></div>
<div class="foot"><span>Janardhan Labs · ContractScan</span><span>Made with intent by Sriharsha</span></div>
</div></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `contract-scan-${Date.now()}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }

  :root {
    /* NEW PALETTE — Legal Clarity: deep charcoal-green + jade */
    --bg:          #0B1610;
    --surface:     #111E16;
    --surface2:    #182A1E;
    --surface3:    #1F3527;
    --jade:        #10B981;
    --jade-dark:   #059669;
    --jade-pale:   #0A2016;
    --jade-glow:   rgba(16,185,129,0.12);
    --coral:       #F87171;
    --coral-dim:   #7F1D1D;
    --coral-pale:  #1A0A0A;
    --amber:       #FBBF24;
    --amber-pale:  #1A1400;
    --sky:         #38BDF8;
    --rule:        #1A2E20;
    --rule2:       #243D2C;
    --ink:         #EDF2EE;
    --ink-mid:     #8BAF95;
    --ink-dim:     #4A6B54;
    --font-serif:  'Lora', Georgia, serif;
    --font-mono:   'Space Mono', monospace;
  }

  html,body{height:100%}
  body{background:var(--bg);color:var(--ink);font-family:var(--font-serif);}
  .app{min-height:100%;background:var(--bg);display:flex;flex-direction:column;}

  /* Subtle diagonal line texture */
  .app::before{
    content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:repeating-linear-gradient(
      -45deg,transparent,transparent 40px,rgba(16,185,129,0.015) 40px,rgba(16,185,129,0.015) 41px
    );
  }
  /* Jade glow bottom-left */
  .app::after{
    content:'';position:fixed;bottom:-180px;left:-180px;
    width:550px;height:550px;border-radius:50%;
    background:radial-gradient(circle,rgba(16,185,129,0.06) 0%,transparent 65%);
    pointer-events:none;z-index:0;
  }

  .page{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;}

  /* ══ HEADER ══ */
  .site-header{background:var(--surface);border-bottom:2px solid var(--jade);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;}
  .header-brand{display:flex;flex-direction:column;gap:0.1rem;}
  .header-eyebrow{font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--jade);}
  .header-appname{font-family:var(--font-serif);font-size:1.5rem;font-weight:700;color:var(--ink);letter-spacing:-0.02em;line-height:1;}
  .header-appname span{color:var(--jade);font-style:italic;}
  .header-tagline{font-family:var(--font-mono);font-size:0.52rem;color:var(--ink-dim);margin-top:0.15rem;letter-spacing:0.04em;}
  @media(max-width:480px){.header-tagline{display:none}}

  /* ══ FOOTER ══ */
  .site-footer{border-top:1px solid var(--rule);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;background:var(--surface);}
  .footer-left{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim);}
  .footer-left strong{color:var(--jade);font-weight:700;}
  .footer-right{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--ink-dim);}

  /* ── Main ── */
  .main{max-width:900px;margin:0 auto;padding:2rem 1.5rem 3rem;width:100%;flex:1;}

  /* ── Disclaimer — FIX N1: readable contrast ── */
  .disclaimer{background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.25);border-radius:4px;padding:0.75rem 1.1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.05em;color:var(--ink-mid);margin-bottom:1.5rem;line-height:1.65;display:flex;gap:0.6rem;align-items:flex-start;}
  .disclaimer-icon{flex-shrink:0;color:var(--jade);}

  /* ── Input card ── */
  .input-card{background:var(--surface);border:1px solid var(--rule2);border-radius:6px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,0.3);}
  .input-card-head{padding:1.1rem 1.75rem;background:var(--surface2);border-bottom:1px solid var(--rule2);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;}
  .input-card-title{font-family:var(--font-serif);font-size:1.05rem;font-weight:600;color:var(--ink);font-style:italic;}
  .input-card-body{padding:1.75rem;display:flex;flex-direction:column;gap:1.25rem;}

  /* ── Input mode tabs ── */
  .input-tabs{display:flex;background:var(--surface2);border:1px solid var(--rule2);border-radius:5px;overflow:hidden;}
  .input-tab{flex:1;padding:0.55rem 1rem;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;color:var(--ink-dim);background:none;border:none;transition:all 0.15s;text-align:center;}
  .input-tab.on{background:var(--jade);color:var(--bg);font-weight:700;}
  .input-tab:hover:not(.on){color:var(--jade);}

  /* ── Upload zone ── */
  .upload-zone{border:2px dashed var(--rule2);border-radius:6px;padding:2.5rem 1.5rem;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--surface2);}
  .upload-zone:hover,.upload-zone.drag{border-color:var(--jade);background:var(--jade-pale);}
  .upload-zone.has-file{border-color:var(--jade);border-style:solid;background:var(--jade-pale);}
  .upload-icon{font-size:2rem;margin-bottom:0.75rem;display:block;line-height:1;}
  .upload-label{font-family:var(--font-serif);font-size:0.95rem;color:var(--ink-mid);font-style:italic;margin-bottom:0.3rem;}
  .upload-sub{font-family:var(--font-mono);font-size:0.52rem;color:var(--ink-dim);letter-spacing:0.06em;}
  .upload-file-name{font-family:var(--font-mono);font-size:0.65rem;color:var(--jade);margin-top:0.5rem;letter-spacing:0.05em;}
  .upload-clear{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;text-transform:uppercase;background:none;border:1px solid var(--rule2);border-radius:3px;color:var(--ink-dim);padding:0.25rem 0.6rem;cursor:pointer;margin-top:0.5rem;transition:all 0.15s;}
  .upload-clear:hover{border-color:var(--coral-dim);color:var(--coral);}

  .field{display:flex;flex-direction:column;gap:0.4rem;}
  .field-label{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--jade);font-weight:400;}
  .field-label .opt{color:var(--ink-dim);font-weight:400;text-transform:none;letter-spacing:0.04em;margin-left:0.35rem;}

  .contract-ta{width:100%;min-height:180px;resize:vertical;background:var(--surface2);border:1px solid var(--rule2);border-radius:4px;padding:1rem 1.1rem;font-family:var(--font-serif);font-size:0.93rem;color:var(--ink);line-height:1.7;outline:none;transition:border-color 0.2s,box-shadow 0.2s;}
  .contract-ta:focus{border-color:var(--jade-dark);box-shadow:0 0 0 3px var(--jade-glow);}
  .contract-ta::placeholder{color:var(--ink-dim);font-style:italic;}

  /* FIX N7: char hint only in one place — removed from inside field, kept only in form-footer */
  .char-hint{font-family:var(--font-mono);font-size:0.5rem;color:var(--ink-dim);letter-spacing:0.06em;}
  .char-hint.warn{color:var(--amber);}
  .char-hint.ok{color:var(--jade);}

  .fields-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;}
  @media(max-width:640px){.fields-row{grid-template-columns:1fr 1fr;}}
  @media(max-width:420px){.fields-row{grid-template-columns:1fr;}}

  .sel{width:100%;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--rule2);border-radius:4px;font-family:var(--font-serif);font-size:0.9rem;color:var(--ink);outline:none;cursor:pointer;-webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238BAF95' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 0.85rem center;padding-right:2.5rem;transition:border-color 0.2s,box-shadow 0.2s;}
  .sel:focus{border-color:var(--jade-dark);box-shadow:0 0 0 3px var(--jade-glow);}
  .sel option{background:var(--surface2);color:var(--ink);}

  .form-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding-top:0.75rem;border-top:1px solid var(--rule2);}

  .scan-btn{padding:0.75rem 2rem;background:var(--jade);color:var(--bg);border:none;border-radius:4px;font-family:var(--font-serif);font-size:1rem;font-weight:700;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
  .scan-btn:hover:not(:disabled){background:var(--jade-dark);transform:translateY(-1px);box-shadow:0 4px 20px var(--jade-glow);}
  .scan-btn:active:not(:disabled){transform:translateY(0);}
  .scan-btn:disabled{background:var(--surface3);color:var(--ink-dim);cursor:not-allowed;transform:none;box-shadow:none;}
  @media(max-width:500px){.scan-btn{width:100%;text-align:center;}}

  /* ── Loading ── */
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

  .loading-wrap{background:var(--surface);border:1px solid var(--rule2);border-radius:6px;padding:4rem 2rem;text-align:center;box-shadow:0 2px 24px rgba(0,0,0,0.3);}
  .loading-ring{width:44px;height:44px;border-radius:50%;border:2px solid var(--rule2);border-top-color:var(--jade);border-right-color:var(--jade-dark);animation:spin 0.9s linear infinite;margin:0 auto 1.25rem;}
  .loading-txt{font-family:var(--font-serif);font-size:1rem;font-style:italic;color:var(--ink);margin-bottom:0.3rem;}
  .loading-sub{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-dim);}

  /* ── Results toolbar ── */
  .results-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;}
  .results-title{font-family:var(--font-serif);font-size:1.15rem;font-weight:600;color:var(--ink);font-style:italic;}
  .results-meta{font-family:var(--font-mono);font-size:0.5rem;color:var(--ink-dim);letter-spacing:0.08em;text-transform:uppercase;margin-top:0.2rem;}

  /* FIX N6: toolbar actions stack cleanly on mobile */
  .toolbar-actions{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;}
  .toolbar-filters{display:flex;gap:0.4rem;flex-wrap:wrap;width:100%;margin-bottom:0.4rem;}
  .toolbar-btns{display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;}
  @media(min-width:641px){.toolbar-filters{width:auto;margin-bottom:0;}.toolbar-actions{flex-wrap:wrap;}.toolbar-btns .reset-btn{margin-left:0.25rem;}}
  @media(max-width:640px){.toolbar-actions{width:100%;flex-direction:column;align-items:flex-start;}}

  .chip{padding:0.28rem 0.75rem;border:1px solid var(--rule2);border-radius:100px;font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.05em;cursor:pointer;color:var(--ink-mid);background:var(--surface2);transition:all 0.15s;user-select:none;}
  .chip:hover{border-color:var(--jade-dark);color:var(--jade);}
  .chip.on{background:var(--jade-pale);border-color:var(--jade);color:var(--jade);}

  .action-btn{padding:0.4rem 0.85rem;background:var(--surface);border:1px solid var(--rule2);border-radius:4px;font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.06em;cursor:pointer;color:var(--ink-mid);transition:all 0.15s;white-space:nowrap;}
  .action-btn:hover{border-color:var(--jade-dark);color:var(--jade);}
  .action-btn.copied{border-color:var(--jade);color:var(--jade);}

  .reset-btn{padding:0.4rem 0.85rem;background:none;border:1px solid var(--rule2);border-radius:4px;font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.06em;cursor:pointer;color:var(--ink-dim);transition:all 0.15s;white-space:nowrap;}
  .reset-btn:hover{border-color:var(--rule2);color:var(--ink);}

  /* ── Risk summary bar ── */
  .risk-bar{display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.5rem;padding:0.9rem 1.25rem;background:var(--surface);border:1px solid var(--rule2);border-radius:6px;align-items:center;animation:riseIn 0.3s ease;}
  .risk-count{display:flex;align-items:center;gap:0.5rem;}
  .risk-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .risk-dot.high{background:var(--coral);}
  .risk-dot.med{background:var(--amber);}
  .risk-dot.low{background:var(--jade);}
  .risk-count-label{font-family:var(--font-mono);font-size:0.58rem;color:var(--ink-mid);}
  .risk-count-num{font-family:var(--font-mono);font-size:0.7rem;font-weight:700;}
  .risk-count-num.high{color:var(--coral);}
  .risk-count-num.med{color:var(--amber);}
  .risk-count-num.low{color:var(--jade);}
  .risk-bar-sep{width:1px;height:20px;background:var(--rule2);}
  .risk-bar-words{font-family:var(--font-mono);font-size:0.52rem;color:var(--ink-dim);margin-left:auto;}

  /* ── Panels ── */
  .panels{display:flex;flex-direction:column;gap:1rem;}
  .panel{background:var(--surface);border:1px solid var(--rule2);border-radius:6px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.2);animation:riseIn 0.4s ease both;}
  .panel:nth-child(1){animation-delay:0.04s}.panel:nth-child(2){animation-delay:0.09s}
  .panel:nth-child(3){animation-delay:0.14s}.panel:nth-child(4){animation-delay:0.19s}
  .panel:nth-child(5){animation-delay:0.24s}

  .panel-head{display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1.25rem;background:var(--surface2);border-bottom:1px solid var(--rule2);gap:0.75rem;flex-wrap:wrap;}
  .panel-title{font-family:var(--font-mono);font-size:0.6rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--jade);}
  .panel-body{padding:1.1rem 1.25rem;}

  .bullet-list{display:flex;flex-direction:column;gap:0.55rem;}
  .bullet-item{display:flex;align-items:flex-start;gap:0.65rem;font-size:0.9rem;line-height:1.65;color:var(--ink-mid);}
  .bullet-jade{width:5px;height:5px;border-radius:50%;background:var(--jade);flex-shrink:0;margin-top:0.5rem;}

  /* Risk flags */
  .flags-list{display:flex;flex-direction:column;gap:0.75rem;}
  .flag-item{border-radius:4px;overflow:hidden;border:1px solid;}
  .flag-item.High{border-color:var(--coral-dim);background:var(--coral-pale);}
  .flag-item.Medium{border-color:rgba(251,191,36,0.3);background:rgba(251,191,36,0.05);}
  .flag-item.Low{border-color:rgba(16,185,129,0.25);background:rgba(16,185,129,0.05);}

  .flag-head{display:flex;align-items:center;gap:0.65rem;padding:0.6rem 1rem;border-bottom:1px solid;}
  .flag-item.High .flag-head{border-color:var(--coral-dim);}
  .flag-item.Medium .flag-head{border-color:rgba(251,191,36,0.2);}
  .flag-item.Low .flag-head{border-color:rgba(16,185,129,0.15);}

  .flag-risk{font-family:var(--font-mono);font-size:0.52rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:0.15rem 0.5rem;border-radius:2px;}
  .flag-risk.High{background:rgba(248,113,113,0.15);color:var(--coral);}
  .flag-risk.Medium{background:rgba(251,191,36,0.15);color:var(--amber);}
  .flag-risk.Low{background:rgba(16,185,129,0.12);color:var(--jade);}
  .flag-unusual{font-family:var(--font-mono);font-size:0.5rem;color:var(--ink-dim);border:1px solid var(--rule2);padding:0.1rem 0.5rem;border-radius:100px;}

  .flag-body{padding:0.65rem 1rem;}
  .flag-explanation{font-size:0.88rem;line-height:1.6;color:var(--ink-mid);margin-bottom:0.5rem;}
  /* FIX N2: removed italic from monospace font-clause */
  .flag-clause{font-family:var(--font-mono);font-size:0.62rem;color:var(--ink-dim);padding-top:0.5rem;border-top:1px solid var(--rule);line-height:1.5;word-break:break-word;}

  .no-flags{font-family:var(--font-mono);font-size:0.65rem;color:var(--jade);letter-spacing:0.1em;padding:0.5rem 0;}

  /* Negotiation — FIX N3: suggestion bg distinct from surface */
  .neg-list{display:flex;flex-direction:column;gap:0.85rem;}
  .neg-item{border:1px solid var(--rule2);border-radius:4px;overflow:hidden;}
  .neg-clause{font-size:0.9rem;font-weight:600;color:var(--ink);padding:0.65rem 1rem;background:var(--surface2);}
  .neg-why{font-size:0.86rem;color:var(--ink-mid);padding:0.6rem 1rem;line-height:1.6;border-bottom:1px solid var(--rule2);}
  .neg-suggestion{font-family:var(--font-mono);font-size:0.68rem;color:var(--sky);padding:0.6rem 1rem;line-height:1.55;background:rgba(56,189,248,0.06);border-left:3px solid rgba(56,189,248,0.4);word-break:break-word;}

  .questions-list{display:flex;flex-direction:column;gap:0.55rem;}
  .question-item{display:flex;align-items:flex-start;gap:0.75rem;font-size:0.9rem;line-height:1.65;color:var(--ink-mid);}
  .q-num{font-family:var(--font-mono);font-size:0.65rem;font-weight:700;color:var(--jade);flex-shrink:0;margin-top:0.28rem;min-width:1.2rem;}

  .error-box{background:var(--coral-pale);border:1px solid var(--coral-dim);border-radius:4px;padding:1rem 1.25rem;color:#FCA5A5;font-size:0.88rem;line-height:1.6;margin-top:1rem;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;animation:riseIn 0.25s ease;}
  .error-close{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.1em;text-transform:uppercase;background:none;border:1px solid var(--coral-dim);border-radius:3px;color:#FCA5A5;padding:0.25rem 0.6rem;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:border-color 0.15s;}
  .error-close:hover{border-color:var(--coral);}

  .bottom-actions{display:flex;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;}
  .bottom-actions .reset-btn,.bottom-actions .action-btn{flex:1;text-align:center;padding:0.65rem;}
  @media(max-width:500px){.bottom-actions{flex-direction:column;}}
`;

const CONTRACT_TYPES = ["Auto-detect","NDA","Employment Contract","Freelance / Service Agreement","Rental / Lease","SaaS / Software Terms","Investment / Equity","Partnership Agreement","General Contract"];
const ROLES          = ["I am the employee / worker","I am the employer / client","I am the service provider","I am the customer / user","I am the tenant","I am the landlord","I am the investor","I am the founder / company"];
const JURISDICTIONS  = ["Not specified","India","United States","United Kingdom","European Union","Other"];
const RISK_FILTERS   = ["All risks","High only","High + Medium"];
const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp,.txt";

function ContractScanApp() {
  const [inputMode, setInputMode]       = useState("paste"); // "paste" | "upload"
  const [contractText, setContractText] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);   // { name, type, base64 or text }
  const [isDragging, setIsDragging]     = useState(false);
  const [contractType, setContractType] = useState("Auto-detect");
  const [role, setRole]                 = useState("I am the employee / worker");
  const [jurisdiction, setJurisdiction] = useState("Not specified");
  const [riskFilter, setRiskFilter]     = useState("All risks");
  const [loading, setLoading]           = useState(false);
  const [loadingMsg, setLoadingMsg]     = useState("");
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState("");
  const fileInputRef                    = useRef(null);
  const { copiedKey, copy }             = useCopy();

  const trimmed   = contractText.trim();
  // canScan: paste mode needs 100 chars, upload mode needs a file
  const canScan   = !loading && (inputMode === "paste" ? trimmed.length >= 100 : !!uploadedFile);
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  // ── File handling ──
  const processFile = async (file) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) { setError("File too large — maximum 10MB"); return; }
    const isImage = file.type.startsWith("image/");
    const isPDF   = file.type === "application/pdf";
    const isText  = file.type === "text/plain";
    if (!isImage && !isPDF && !isText) { setError("Unsupported file type — use PDF, PNG, JPG, or TXT"); return; }
    try {
      if (isText) {
        const text = await readFileAsText(file);
        setUploadedFile({ name: file.name, type: "text", content: text });
      } else {
        const base64 = await readFileAsBase64(file);
        setUploadedFile({ name: file.name, type: isImage ? "image" : "pdf", base64, mediaType: file.type });
      }
      setError("");
    } catch (e) { setError(e.message); }
  };

  const onFileChange = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const clearFile = () => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  // ── Build API message(s) ──
  const buildMessages = (snapText, snapFile, snapType, snapRole, snapJuri) => {
    const systemPart = `You are an expert contract lawyer. Analyse this contract from the perspective of: ${snapRole}.
Contract type: ${snapType === "Auto-detect" ? "Identify from context" : snapType}
${snapJuri !== "Not specified" ? `Jurisdiction: ${snapJuri}` : ""}

Return ONLY valid JSON, no markdown fences:
{
  "detectedType": "what type of contract this is",
  "summary": ["bullet 1","bullet 2","bullet 3","bullet 4","bullet 5"],
  "riskFlags": [{"risk":"High","clause":"excerpt","explanation":"plain-English risk explanation","isUnusual":true}],
  "commitments": ["commitment 1","commitment 2","commitment 3"],
  "negotiation": [{"clause":"clause name","why":"reason to push back","suggestion":"replacement language"}],
  "questions": ["question 1","question 2","question 3"]
}
Rules: risk = exactly "High","Medium","Low". summary = exactly 5 items. commitments = 3-5 items. negotiation = 2-4 items. questions = 3-5 items. Frame all from perspective of ${snapRole}.`;

    if (snapFile?.type === "text") {
      // Text file — send as text message
      return [{ role: "user", content: `${systemPart}\n\nContract text:\n---\n${snapFile.content.slice(0,8000)}${snapFile.content.length>8000?"\n[truncated]":""}` }];
    }
    if (snapFile?.type === "image") {
      // Image — use vision API
      return [{ role: "user", content: [
        { inlineData: { mimeType: snapFile.mediaType, data: snapFile.base64 } },
        { type: "text", text: `${systemPart}\n\nAnalyse the contract shown in this image.` }
      ]}];
    }
    if (snapFile?.type === "pdf") {
      // PDF — use document API
      return [{ role: "user", content: [
       { inlineData: { mimeType: "application/pdf", data: snapFile.base64 } },
        { type: "text", text: systemPart }
      ]}];
    }
    // Paste mode
    return [{ role: "user", content: `${systemPart}\n\nContract text:\n---\n${snapText.slice(0,8000)}${snapText.length>8000?"\n[truncated]":""}` }];
  };

  const scan = async () => {
    if (!canScan) return;
    // Snapshot all inputs at call time
    const snapText = trimmed;
    const snapFile = uploadedFile;
    const snapType = contractType;
    const snapRole = role;
    const snapJuri = jurisdiction;

    setLoading(true);
    setLoadingMsg(snapFile ? `Reading ${snapFile.name}…` : "Reading the contract…");
    setError(""); setResult(null);

    try {
      const messages = buildMessages(snapText, snapFile, snapType, snapRole, snapJuri);
      const parsed = await callGemini(messages, 2000);
      // Normalise all arrays
      parsed.summary     = Array.isArray(parsed.summary)     ? parsed.summary     : [];
      parsed.riskFlags   = Array.isArray(parsed.riskFlags)   ? parsed.riskFlags.map(f => ({ ...f, risk: ["High","Medium","Low"].includes(f.risk) ? f.risk : "Low" })) : [];
      parsed.commitments = Array.isArray(parsed.commitments) ? parsed.commitments : [];
      parsed.negotiation = Array.isArray(parsed.negotiation) ? parsed.negotiation : [];
      parsed.questions   = Array.isArray(parsed.questions)   ? parsed.questions   : [];
      // Snapshot metadata on result for export
      parsed._snapType = snapType === "Auto-detect" ? (parsed.detectedType || "Contract") : snapType;
      parsed._snapRole = snapRole;
      parsed._snapJuri = snapJuri; // FIX F4: snapshot jurisdiction
      parsed._wordCount = snapFile ? (snapFile.content ? snapFile.content.split(/\s+/).length : 0) : snapText.split(/\s+/).length;
      parsed._fileName  = snapFile?.name || null;
      setResult(parsed);
      saveResult("contract-scan", parsed);
      setRiskFilter("All risks"); // FIX F2: reset risk filter on each new scan
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(""); }
  };

  // FIX F2: reset() also resets riskFilter
  const reset = () => { setResult(null); setError(""); setRiskFilter("All risks"); };
  const fullReset = () => { setResult(null); setError(""); setContractText(""); setUploadedFile(null); setRiskFilter("All risks"); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const filteredFlags = (result?.riskFlags || []).filter(f => {
    if (riskFilter === "High only") return f.risk === "High";
    if (riskFilter === "High + Medium") return f.risk === "High" || f.risk === "Medium";
    return true;
  });

  const highCount = (result?.riskFlags || []).filter(f => f.risk === "High").length;
  const medCount  = (result?.riskFlags || []).filter(f => f.risk === "Medium").length;
  const lowCount  = (result?.riskFlags || []).filter(f => f.risk === "Low").length;

  const panelText = (title, arr) => !arr?.length ? "" : `${title}\n\n${arr.map(i => `• ${i}`).join("\n")}`;

  // FIX F1: guard n.suggestion against null/undefined in allText
  const allText = result ? [
    panelText("PLAIN ENGLISH SUMMARY", result.summary),
    panelText("WHAT YOU'RE AGREEING TO", result.commitments),
    `RISK FLAGS\n\n${(result.riskFlags||[]).map(f=>`[${f.risk}] ${f.explanation}`).join("\n\n")}`,
    `NEGOTIATION LEVERAGE\n\n${(result.negotiation||[]).map(n=>`${n.clause}: ${n.why}${n.suggestion?`\n→ ${n.suggestion}`:""}`).join("\n\n")}`,
    panelText("QUESTIONS TO ASK", result.questions),
  ].join("\n\n---\n\n") : "";

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="page">

          <header className="site-header">
            <div className="header-brand">
              <span className="header-eyebrow">Janardhan Labs</span>
              <h1 className="header-appname">Contract<span>Scan</span></h1>
              <p className="header-tagline">Know what you're signing before you sign it</p>
            </div>
          </header>

          <main className="main">
            <div className="disclaimer">
              <span className="disclaimer-icon">⚠</span>
              <span>Informational analysis only — not legal advice. Always consult a qualified lawyer before signing legally binding documents.</span>
            </div>

            {/* INPUT */}
            {!result && !loading && (
              <div className="input-card">
                <div className="input-card-head">
                  <span className="input-card-title">Paste or upload your contract</span>
                </div>
                <div className="input-card-body">
                  {/* Mode tabs */}
                  <div className="input-tabs">
                    <button className={`input-tab ${inputMode === "paste" ? "on" : ""}`} onClick={() => setInputMode("paste")}>✎ Paste text</button>
                    <button className={`input-tab ${inputMode === "upload" ? "on" : ""}`} onClick={() => setInputMode("upload")}>↑ Upload file</button>
                  </div>

                  {/* Paste mode */}
                  {inputMode === "paste" && (
                    <div className="field">
                      <label className="field-label" htmlFor="contract-ta">Contract text</label>
                      <textarea id="contract-ta" className="contract-ta"
                        placeholder="Paste the full contract text here — NDA, employment offer, freelance agreement, rental terms, SaaS terms…"
                        value={contractText} onChange={e => setContractText(e.target.value)} />
                    </div>
                  )}

                  {/* Upload mode */}
                  {inputMode === "upload" && (
                    <div>
                      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={onFileChange} style={{ display:"none" }} />
                      <div
                        className={`upload-zone ${isDragging ? "drag" : ""} ${uploadedFile ? "has-file" : ""}`}
                        onClick={() => !uploadedFile && fileInputRef.current?.click()}
                        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                      >
                        <span className="upload-icon">{uploadedFile ? "✓" : "📄"}</span>
                        {uploadedFile ? (
                          <>
                            <div className="upload-file-name">{uploadedFile.name}</div>
                            <div className="upload-sub" style={{ marginTop:"0.25rem" }}>
                              {uploadedFile.type === "pdf" ? "PDF document" : uploadedFile.type === "image" ? "Image — text will be extracted" : "Text file"}
                            </div>
                            <button className="upload-clear" onClick={e => { e.stopPropagation(); clearFile(); }}>✕ Remove</button>
                          </>
                        ) : (
                          <>
                            <div className="upload-label">Drop a file or click to browse</div>
                            <div className="upload-sub">PDF · PNG · JPG · TXT · up to 10MB</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="fields-row">
                    <div className="field">
                      <label className="field-label">Contract type</label>
                      <select className="sel" value={contractType} onChange={e => setContractType(e.target.value)}>
                        {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Your role</label>
                      <select className="sel" value={role} onChange={e => setRole(e.target.value)}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Jurisdiction <span className="opt">(optional)</span></label>
                      <select className="sel" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
                        {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* FIX N7: char hint ONLY here in form-footer, not duplicated in field */}
                  <div className="form-footer">
                    <div className={`char-hint ${inputMode === "upload" ? (uploadedFile ? "ok" : "") : trimmed.length === 0 ? "" : trimmed.length < 100 ? "warn" : "ok"}`}>
                      {inputMode === "paste" && trimmed.length > 0 && (trimmed.length < 100 ? `${100 - trimmed.length} more characters needed` : `${wordCount} words · ready to scan`)}
                      {inputMode === "upload" && uploadedFile && "File ready to scan"}
                    </div>
                    <button className="scan-btn" onClick={scan} disabled={!canScan}>
                      Scan contract →
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
                <div className="loading-txt">{loadingMsg || "Reading the contract…"}</div>
                <div className="loading-sub">identifying risk · flagging clauses · building report</div>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <>
                <div className="results-bar">
                  <div>
                    <div className="results-title">{result.detectedType || result._snapType}</div>
                    {/* FIX F4+N5: use snapshotted jurisdiction */}
                    <div className="results-meta">
                      {result._snapRole} · {result._snapJuri !== "Not specified" ? result._snapJuri : "Jurisdiction not specified"}
                      {result._fileName ? ` · ${result._fileName}` : ""}
                    </div>
                  </div>
                  {/* FIX N6: filters on own row, buttons separate */}
                  <div className="toolbar-actions">
                    <div className="toolbar-filters">
                      {RISK_FILTERS.map(f => (
                        <button key={f} className={`chip ${riskFilter === f ? "on" : ""}`} onClick={() => setRiskFilter(f)}>{f}</button>
                      ))}
                    </div>
                    <div className="toolbar-btns">
                      <button className={`action-btn ${copiedKey === "all" ? "copied" : ""}`} onClick={() => copy(allText, "all")}>
                        {copiedKey === "all" ? "Copied ✓" : "Copy all"}
                      </button>
                      <button className="action-btn" onClick={() => exportReport(result)}>↓ Export report</button>
                      <button className="reset-btn" onClick={fullReset}>← New scan</button>
                    </div>
                  </div>
                </div>

                {/* Risk summary bar */}
                <div className="risk-bar">
                  <div className="risk-count"><div className="risk-dot high" /><span className="risk-count-num high">{highCount}</span><span className="risk-count-label">high risk</span></div>
                  <div className="risk-bar-sep" />
                  <div className="risk-count"><div className="risk-dot med" /><span className="risk-count-num med">{medCount}</span><span className="risk-count-label">medium risk</span></div>
                  <div className="risk-bar-sep" />
                  <div className="risk-count"><div className="risk-dot low" /><span className="risk-count-num low">{lowCount}</span><span className="risk-count-label">low risk</span></div>
                  <div className="risk-bar-sep" />
                  {/* FIX F3: use snapshotted wordCount */}
                  <span className="risk-bar-words">{result._wordCount} words scanned</span>
                </div>

                <div className="panels">
                  {/* Summary */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Plain English Summary</span>
                      <button className={`action-btn ${copiedKey==="summary"?"copied":""}`} onClick={() => copy(panelText("PLAIN ENGLISH SUMMARY", result.summary), "summary")}>{copiedKey==="summary"?"Copied ✓":"Copy"}</button>
                    </div>
                    <div className="panel-body">
                      <div className="bullet-list">
                        {result.summary.map((s,i) => <div key={i} className="bullet-item"><span className="bullet-jade"/><span>{s}</span></div>)}
                      </div>
                    </div>
                  </div>

                  {/* Risk flags */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Risk Flags ({filteredFlags.length}{filteredFlags.length!==result.riskFlags.length?` of ${result.riskFlags.length}`:""})</span>
                      <button className={`action-btn ${copiedKey==="flags"?"copied":""}`} onClick={() => copy(`RISK FLAGS\n\n${filteredFlags.map(f=>`[${f.risk}] ${f.explanation}`).join("\n\n")}`, "flags")}>{copiedKey==="flags"?"Copied ✓":"Copy"}</button>
                    </div>
                    <div className="panel-body">
                      {filteredFlags.length === 0 ? (
                        <div className="no-flags">✓ No flags match the selected filter</div>
                      ) : (
                        <div className="flags-list">
                          {filteredFlags.map((f,i) => (
                            <div key={i} className={`flag-item ${f.risk}`}>
                              <div className="flag-head">
                                <span className={`flag-risk ${f.risk}`}>{f.risk} risk</span>
                                {f.isUnusual && <span className="flag-unusual">Unusual clause</span>}
                              </div>
                              <div className="flag-body">
                                <p className="flag-explanation">{f.explanation}</p>
                                {f.clause && <p className="flag-clause">"{f.clause.length>250?f.clause.slice(0,250)+"…":f.clause}"</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commitments */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">What You're Actually Agreeing To</span>
                      <button className={`action-btn ${copiedKey==="commit"?"copied":""}`} onClick={() => copy(panelText("WHAT YOU'RE AGREEING TO", result.commitments), "commit")}>{copiedKey==="commit"?"Copied ✓":"Copy"}</button>
                    </div>
                    <div className="panel-body">
                      <div className="bullet-list">
                        {result.commitments.map((c,i) => <div key={i} className="bullet-item"><span className="bullet-jade"/><span>{c}</span></div>)}
                      </div>
                    </div>
                  </div>

                  {/* Negotiation */}
                  {result.negotiation.length > 0 && (
                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Negotiation Leverage</span>
                        {/* FIX F1: guard n.suggestion */}
                        <button className={`action-btn ${copiedKey==="neg"?"copied":""}`} onClick={() => copy(`NEGOTIATION LEVERAGE\n\n${result.negotiation.map(n=>`${n.clause}: ${n.why}${n.suggestion?`\n→ ${n.suggestion}`:""}`).join("\n\n")}`, "neg")}>{copiedKey==="neg"?"Copied ✓":"Copy"}</button>
                      </div>
                      <div className="panel-body">
                        <div className="neg-list">
                          {result.negotiation.map((n,i) => (
                            <div key={i} className="neg-item">
                              <div className="neg-clause">{n.clause}</div>
                              <div className="neg-why">{n.why}</div>
                              {n.suggestion && <div className="neg-suggestion">"{n.suggestion}"</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Questions to Ask Before Signing</span>
                      <button className={`action-btn ${copiedKey==="qs"?"copied":""}`} onClick={() => copy(panelText("QUESTIONS TO ASK", result.questions), "qs")}>{copiedKey==="qs"?"Copied ✓":"Copy"}</button>
                    </div>
                    <div className="panel-body">
                      <div className="questions-list">
                        {result.questions.map((q,i) => (
                          <div key={i} className="question-item">
                            <span className="q-num">{String(i+1).padStart(2,"0")}</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bottom-actions">
                  <button className="reset-btn" onClick={reset}>← Scan another</button>
                  <button className="action-btn" onClick={() => exportReport(result)}>↓ Download report</button>
                </div>
              </>
            )}
          </main>

          <footer className="site-footer">
            <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
            <div className="footer-right">Janardhan Labs © 2026</div>
          </footer>
        </div>
      </div>
    </>
  );
}

export default function ContractScan() {
  const { apiKey, isKeySet, KeyGate, Banner } = useApiKey("contract-scan");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <ContractScanApp />
    </>
  );
}
