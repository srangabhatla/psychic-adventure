import { callGemini, setAppContext } from "../../shared/lib/gemini-client";
import { saveResult, loadResults } from "../../shared/lib/storage";
import { useQualityGate } from "../../shared/components/QualityGate";
import { useApiKey } from "../../shared/components/KeyGate";
import { useState } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cream: #F7F0E6;
    --warm-white: #FBF7F2;
    --terracotta: #C4674A;
    --terracotta-dark: #A3503A;
    --terracotta-light: #E8896E;
    --umber: #5C3D2E;
    --umber-light: #8B6355;
    --sage: #7A8C6E;
    --gold: #C9A84C;
    --ink: #2C1F14;
    --ink-light: #4A3728;
    --dust: #DDD0C2;
    --font-serif: 'Cormorant Garamond', Georgia, serif;
    --font-mono: 'DM Mono', monospace;
  }

  body { background: var(--cream); font-family: var(--font-serif); color: var(--ink); }

  .app { min-height: 100vh; background: var(--cream); position: relative; overflow: hidden; }

  .bg-texture {
    position: fixed; inset: 0;
    background-image:
      radial-gradient(ellipse at 20% 10%, rgba(196,103,74,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(201,168,76,0.07) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }

  .content { position: relative; z-index: 1; }

  .header {
    padding: 2.5rem 2rem 1.5rem; text-align: center;
    border-bottom: 1px solid var(--dust);
    background: rgba(247,240,230,0.85); backdrop-filter: blur(8px);
    position: sticky; top: 0; z-index: 10;
  }
  .header-eyebrow { font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--terracotta); margin-bottom: 0.4rem; }
  .header-title { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 300; line-height: 1; color: var(--umber); letter-spacing: -0.01em; }
  .header-title em { font-style: italic; color: var(--terracotta); }
  .header-sub { margin-top: 0.5rem; font-size: 1rem; color: var(--umber-light); font-weight: 300; font-style: italic; }

  .main { max-width: 860px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

  .section-label { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--terracotta); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--dust); }

  .input-card { background: var(--warm-white); border: 1px solid var(--dust); border-radius: 2px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 20px rgba(44,31,20,0.06); }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
  .form-field { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-field.full { grid-column: 1 / -1; }

  .field-label { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--umber-light); }

  .field-input, .field-select, .field-textarea {
    background: var(--cream); border: 1px solid var(--dust); border-radius: 2px;
    padding: 0.65rem 0.85rem; font-family: var(--font-serif); font-size: 1rem; color: var(--ink);
    transition: border-color 0.2s, box-shadow 0.2s; width: 100%; outline: none; -webkit-appearance: none;
  }
  .field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--terracotta); box-shadow: 0 0 0 3px rgba(196,103,74,0.12); }
  .field-textarea { min-height: 90px; resize: vertical; line-height: 1.6; }
  .field-select { cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238B6355' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.85rem center; padding-right: 2.5rem; }

  .toggles-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem; }
  .toggle-chip { padding: 0.3rem 0.85rem; border: 1px solid var(--dust); border-radius: 100px; font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.08em; cursor: pointer; color: var(--umber-light); background: var(--cream); transition: all 0.15s; user-select: none; }
  .toggle-chip:hover { border-color: var(--terracotta-light); color: var(--terracotta); }
  .toggle-chip.active { background: var(--terracotta); border-color: var(--terracotta); color: white; }

  .count-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .count-btn { width: 2.2rem; height: 2.2rem; border: 1px solid var(--dust); border-radius: 2px; font-family: var(--font-mono); font-size: 0.75rem; cursor: pointer; color: var(--umber-light); background: var(--cream); transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .count-btn:hover { border-color: var(--terracotta-light); color: var(--terracotta); }
  .count-btn.active { background: var(--terracotta); border-color: var(--terracotta); color: white; }

  .submit-btn { width: 100%; padding: 1rem; background: var(--terracotta); color: white; border: none; border-radius: 2px; font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; font-style: italic; cursor: pointer; transition: all 0.2s; margin-top: 1.5rem; letter-spacing: 0.02em; position: relative; overflow: hidden; }
  .submit-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent); pointer-events: none; }
  .submit-btn:hover:not(:disabled) { background: var(--terracotta-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(196,103,74,0.3); }
  .submit-btn:disabled { background: var(--dust); color: var(--umber-light); cursor: not-allowed; }

  .loading-state { text-align: center; padding: 3rem 1rem; }
  .loading-ornament { font-size: 2.5rem; animation: sway 2.5s ease-in-out infinite; display: block; margin-bottom: 1rem; }
  @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
  .loading-text { font-size: 1.1rem; font-style: italic; color: var(--umber-light); }
  .loading-sub { font-family: var(--font-mono); font-size: 0.65rem; color: var(--dust); letter-spacing: 0.1em; margin-top: 0.5rem; }

  .results-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem; }
  .results-title { font-size: 1.5rem; font-weight: 300; color: var(--umber); font-style: italic; }
  .reset-btn { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--umber-light); background: none; border: 1px solid var(--dust); border-radius: 2px; padding: 0.35rem 0.75rem; cursor: pointer; transition: all 0.15s; }
  .reset-btn:hover { border-color: var(--terracotta); color: var(--terracotta); }

  .gifts-grid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }

  .gift-card { background: var(--warm-white); border: 1px solid var(--dust); border-radius: 2px; overflow: hidden; box-shadow: 0 2px 16px rgba(44,31,20,0.06); animation: riseIn 0.5s ease both; transition: transform 0.2s, box-shadow 0.2s; }
  .gift-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(44,31,20,0.1); }
  @keyframes riseIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .gift-card:nth-child(1) { animation-delay: 0.05s; }
  .gift-card:nth-child(2) { animation-delay: 0.12s; }
  .gift-card:nth-child(3) { animation-delay: 0.19s; }
  .gift-card:nth-child(4) { animation-delay: 0.26s; }
  .gift-card:nth-child(5) { animation-delay: 0.33s; }
  .gift-card:nth-child(6) { animation-delay: 0.4s; }
  .gift-card:nth-child(7) { animation-delay: 0.47s; }
  .gift-card:nth-child(8) { animation-delay: 0.54s; }

  .gift-card-top { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--dust); }
  .gift-emoji { font-size: 2rem; flex-shrink: 0; line-height: 1; }
  .gift-name-area { flex: 1; min-width: 0; }
  .gift-name { font-size: 1.35rem; font-weight: 500; color: var(--umber); line-height: 1.2; }
  .gift-why-tag { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--terracotta); margin-top: 0.2rem; }
  .gift-price { font-family: var(--font-mono); font-size: 0.85rem; color: var(--umber-light); background: var(--cream); border: 1px solid var(--dust); border-radius: 2px; padding: 0.3rem 0.6rem; white-space: nowrap; }
  .gift-card-body { padding: 1.1rem 1.5rem 1.3rem; }
  .gift-reasoning { font-size: 1rem; line-height: 1.7; color: var(--ink-light); font-weight: 300; }

  .error-box { background: #FFF5F2; border: 1px solid var(--terracotta-light); border-radius: 2px; padding: 1.25rem 1.5rem; color: var(--terracotta-dark); font-size: 0.95rem; line-height: 1.6; }
  .ornament-divider { text-align: center; color: var(--dust); font-size: 1rem; margin: 1.5rem 0; letter-spacing: 0.5em; }

  /* ══ FOOTER ══ */
  .site-footer{border-top:1px solid var(--dust);padding:1rem 1.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;background:var(--warm-white);}
  .footer-left{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--umber-light);}
  .footer-left strong{color:var(--terracotta);font-weight:500;}
  .footer-right{font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;color:var(--umber-light);}
`;

const OCCASIONS = ["Birthday","Anniversary","Wedding","Baby Shower","Graduation","Holidays / Christmas","Mother's Day","Father's Day","Valentine's Day","Housewarming","Farewell / Going Away","Just Because"];
const BUDGETS = ["Under ₹500","₹500–₹1,500","₹1,500–₹5,000","₹5,000–₹15,000","₹15,000–₹50,000","No limit"];
const RELATIONSHIPS = ["Partner / Spouse","Parent","Sibling","Child","Best Friend","Close Friend","Colleague / Boss","Acquaintance","Mentor","In-law"];
const INTERESTS = ["Books","Music","Gaming","Cooking","Fitness","Travel","Art & Design","Tech & Gadgets","Fashion","Outdoors / Nature","Film & TV","Wellness","Coffee & Tea","Plants & Gardening","Pets"];


// ── Shared API helper ──

function GiftIntelligenceApp() {
  const [person, setPerson] = useState("");
  const [occasion, setOccasion] = useState("");
  const [budget, setBudget] = useState("");
  const [relationship, setRelationship] = useState("");
  const [wildcard, setWildcard] = useState("");
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [giftCount, setGiftCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const toggleInterest = (i) => setSelectedInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  const canSubmit = person.trim() && occasion && budget && relationship && !loading;
  const qg = useQualityGate("gift-intelligence");

  const generate = async () => {
    setLoading(true); setError(""); setResults(null);
    const prompt = `You are a thoughtful gift curator. Generate exactly ${giftCount} personalised gift ideas.
Person description: ${person}
Relationship: ${relationship}
Occasion: ${occasion}
Budget: ${budget}
Known interests: ${selectedInterests.length ? selectedInterests.join(", ") : "Not specified"}
Wildcard / extra context: ${wildcard || "None"}
Return ONLY valid JSON, no explanation, no markdown. Format:
{"gifts":[{"emoji":"🎁","name":"Specific product or experience name","price":"Approx India price","why_tag":"3-5 words why this fits","reasoning":"2-3 sentence explanation personalised to them","where":"Where to find it in India (e.g. Amazon.in, local store, Nykaa, Etsy India)"}]}
Rules: Be hyper-specific (name actual products, brands, experiences). No generic gifts like "a book". Tailor deeply to the person described. Vary gift types across the list. reasoning: maximum 2 concise sentences.`;
    const maxTokens = 500 * giftCount + 500;
    try {
      const parsed = await callGemini(prompt, maxTokens);
      setResults(parsed.gifts || []);
      saveResult("gift-intelligence", parsed.gifts || []);
    } catch (e) { if (!e.message.startsWith("__COOLDOWN__")) setError(e.message || "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="bg-texture" />
        <div className="content">
          <header className="header">
            <div className="header-eyebrow">Janardhan Labs</div>
            <h1 className="header-title">Gift <em>Intelligence</em></h1>
            <p className="header-sub">Thoughtful gifts, found with precision</p>
          </header>
          <main className="main">
            {!results && !loading && (
              <div className="input-card">
                <div className="section-label">About the person</div>
                <div className="form-grid">
                  <div className="form-field full">
                    <label className="field-label">Describe them</label>
                    <textarea className="field-textarea" placeholder="e.g. My mum, 58, loves gardening and strong filter coffee, recently retired, very practical but deserves something special…" value={person} onChange={e => setPerson(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Relationship</label>
                    <select className="field-select" value={relationship} onChange={e => setRelationship(e.target.value)}>
                      <option value="">Choose…</option>
                      {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="field-label">Occasion</label>
                    <select className="field-select" value={occasion} onChange={e => setOccasion(e.target.value)}>
                      <option value="">Choose…</option>
                      {OCCASIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-field full">
                    <label className="field-label">Budget</label>
                    <select className="field-select" value={budget} onChange={e => setBudget(e.target.value)}>
                      <option value="">Choose…</option>
                      {BUDGETS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-field full">
                    <label className="field-label">Their interests (optional — pick any)</label>
                    <div className="toggles-row">
                      {INTERESTS.map(i => (
                        <button key={i} className={`toggle-chip ${selectedInterests.includes(i) ? "active" : ""}`} onClick={() => toggleInterest(i)}>{i}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-field full">
                    <label className="field-label">Wildcard — anything else that might help?</label>
                    <input className="field-input" placeholder="e.g. They just moved to a new city, mentioned a bucket list trip, or have been stressed at work…" value={wildcard} onChange={e => setWildcard(e.target.value)} />
                  </div>
                  <div className="form-field full">
                    <label className="field-label">How many ideas?</label>
                    <div className="count-selector">
                      {[3, 4, 5, 6, 8].map(n => (
                        <button key={n} className={`count-btn ${giftCount === n ? "active" : ""}`} onClick={() => setGiftCount(n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:"1rem"}}>
                  {canSubmit && !qg.score && (
                    <button className="submit-btn" style={{background:"var(--sage)",marginBottom:"0.5rem"}}
                      onClick={() => qg.analyse(`${person} ${occasion} ${budget} ${selectedInterests.join(" ")}`)}
                      disabled={qg.loading}>
                      {qg.loading ? "Checking input…" : "↗ Check input quality first"}
                    </button>
                  )}
                  {qg.score && (
                    <div style={{padding:"0.65rem 0.85rem",marginBottom:"0.5rem",borderRadius:"4px",fontFamily:"var(--font-mono)",fontSize:"0.65rem",lineHeight:1.6,
                      background:qg.score==="green"?"rgba(122,140,110,0.12)":qg.score==="amber"?"rgba(201,168,76,0.12)":"rgba(196,103,74,0.12)",
                      border:`1px solid ${qg.score==="green"?"rgba(122,140,110,0.4)":qg.score==="amber"?"rgba(201,168,76,0.4)":"rgba(196,103,74,0.4)"}`,
                      color:qg.score==="green"?"var(--sage)":qg.score==="amber"?"var(--gold)":"var(--terracotta)"}}>
                      {qg.score==="green"?"✓":qg.score==="amber"?"⚠":"✕"} {qg.message}
                    </div>
                  )}
                  <button className="submit-btn" onClick={generate}
                    disabled={!canSubmit || qg.isBlocked}>
                    {qg.isBlocked ? "Fix input above first" : canSubmit ? `Find ${giftCount} perfect gifts →` : "Fill in the details above"}
                  </button>
                </div>
              </div>
            )}
            {loading && (
              <div className="loading-state">
                <span className="loading-ornament">🎁</span>
                <p className="loading-text">Thinking about what they'd truly love…</p>
                <p className="loading-sub">curating {giftCount} ideas</p>
              </div>
            )}
            {error && (
              <div className="error-box">
                <strong>Something went wrong:</strong> {error}
                <br /><br />
                <button className="reset-btn" onClick={() => setError("")}>← Try again</button>
              </div>
            )}
            {results && (
              <>
                <div className="results-header">
                  <span className="results-title">{results.length} ideas for {occasion.toLowerCase()}</span>
                  <button className="reset-btn" onClick={() => { setResults(null); setError(""); }}>← Start over</button>
                </div>
                <div className="gifts-grid">
                  {results.map((gift, i) => (
                    <div className="gift-card" key={i}>
                      <div className="gift-card-top">
                        <span className="gift-emoji">{gift.emoji}</span>
                        <div className="gift-name-area">
                          <div className="gift-name">{gift.name}</div>
                          <div className="gift-why-tag">{gift.why_tag}</div>
                        </div>
                        <div className="gift-price">{gift.price}</div>
                      </div>
                      <div className="gift-card-body">
                        <p className="gift-reasoning">{gift.reasoning}</p>
                        {gift.where && (
                          <p style={{ fontFamily:"var(--font-mono)", fontSize:"0.6rem", color:"var(--umber-light)", marginTop:"0.65rem", letterSpacing:"0.05em" }}>
                            📍 {gift.where}
                          </p>
                        )}
                        <div style={{display:"flex",gap:"0.5rem",marginTop:"0.75rem",flexWrap:"wrap"}}>
                          <a href={`https://www.amazon.in/s?k=${encodeURIComponent(gift.name)}`} target="_blank" rel="noopener noreferrer"
                            style={{fontFamily:"var(--font-mono)",fontSize:"0.58rem",letterSpacing:"0.06em",textTransform:"uppercase",
                            padding:"0.25rem 0.65rem",borderRadius:"2px",border:"1px solid var(--dust)",color:"var(--umber-light)",
                            textDecoration:"none",transition:"all 0.15s",display:"inline-block"}}
                            onMouseOver={e=>{e.target.style.borderColor="var(--terracotta)";e.target.style.color="var(--terracotta)"}}
                            onMouseOut={e=>{e.target.style.borderColor="var(--dust)";e.target.style.color="var(--umber-light)"}}>
                            Search Amazon.in →
                          </a>
                          <a href={`https://www.flipkart.com/search?q=${encodeURIComponent(gift.name)}`} target="_blank" rel="noopener noreferrer"
                            style={{fontFamily:"var(--font-mono)",fontSize:"0.58rem",letterSpacing:"0.06em",textTransform:"uppercase",
                            padding:"0.25rem 0.65rem",borderRadius:"2px",border:"1px solid var(--dust)",color:"var(--umber-light)",
                            textDecoration:"none",transition:"all 0.15s",display:"inline-block"}}
                            onMouseOver={e=>{e.target.style.borderColor="var(--terracotta)";e.target.style.color="var(--terracotta)"}}
                            onMouseOut={e=>{e.target.style.borderColor="var(--dust)";e.target.style.color="var(--umber-light)"}}>
                            Search Flipkart →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ornament-divider">✦ ✦ ✦</div>
                <button className="submit-btn" style={{ marginTop: 0 }} onClick={() => setResults(null)}>← Refine the search</button>
              </>
            )}
          </main>
        </div>
        <footer className="site-footer">
          <div className="footer-left">Made with intent by <strong>Sriharsha</strong></div>
          <div className="footer-right">Janardhan Labs © 2026</div>
        </footer>
      </div>
    </>
  );
}

export default function GiftIntelligence() {
  const { isKeySet, KeyGate, Banner } = useApiKey("gift-intelligence");
  setAppContext("gift-intelligence");
  if (!isKeySet) return <KeyGate />;
  return (
    <>
      <Banner />
      <GiftIntelligenceApp />
    </>
  );
}
