/**
 * PM Studio — Janardhan Labs
 * 17-mode AI toolkit. Amber palette. Cockpit UX.
 * User's own Gemini API key.
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const MODEL      = "gemini-2.0-flash-lite";
const GEMINI_URL = k => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`;
const LS_KEY     = "pms_key_v1";
const LS_HIST    = "pms_hist_v1";
const MAX_HIST   = 5;
const TIMEOUT_MS = 35000;
const TEST_MODE  = false;

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYS = `You are a senior PM at a top-tier tech company. Output only structured content using the exact section format requested. No preamble, no filler. Every point must be specific, actionable, grounded in real PM practice. Be direct. Be sharp.`;

// ── MODES ────────────────────────────────────────────────────────────────────
const MODES = [
  {
    id:"prd", label:"PRD Generator", icon:"◎", tag:"Document",
    desc:"Turn an idea into a full product requirements document",
    keywords:["prd","requirements","feature","build","product","spec","requirement"],
    sections:["Problem Statement","Goals & Non-Goals","User Stories","Feature Requirements","Success Metrics","Open Questions"],
    fields:[
      {id:"product", label:"Product / Feature", ph:"e.g. Offline mode for mobile app", max:80},
      {id:"problem", label:"Problem Statement",  ph:"What pain does this solve? Who feels it?", max:200, area:true},
      {id:"user",    label:"Target User",        ph:"e.g. B2B sales reps, non-technical, 28-45", max:120},
      {id:"context", label:"Business Context",   ph:"Constraints, existing systems, success metrics", max:200, area:true},
    ],
    prompt: d => `Product: ${d.product}\nProblem: ${d.problem}\nUser: ${d.user}\nContext: ${d.context}\n\nWrite a complete PRD:\n\n**PROBLEM STATEMENT:** 2-sentence crisp articulation.\n\n**GOALS:** 3 specific measurable goals.\n\n**NON-GOALS:** 3 things explicitly out of scope and why.\n\n**USER STORIES:** 5 stories in "As a [user], I want [action] so that [outcome]" format.\n\n**FEATURE REQUIREMENTS:** 6-8 numbered functional requirements specific enough for engineering estimation.\n\n**SUCCESS METRICS:** North star metric + 3 supporting metrics with targets.\n\n**OPEN QUESTIONS:** 4 questions that must be answered before development starts.`,
  },
  {
    id:"sprint", label:"Sprint Planner", icon:"⟲", tag:"Agile",
    desc:"Generate user stories and JIRA-ready ticket hierarchy",
    keywords:["sprint","jira","stories","agile","tickets","velocity","backlog","scrum"],
    sections:["Epic Summary","User Stories","Technical Tasks","Definition of Done","Risks"],
    fields:[
      {id:"feature",  label:"Feature / Epic",   ph:"e.g. User authentication revamp", max:100},
      {id:"goal",     label:"Sprint Goal",       ph:"What must be true at end of sprint?", max:150},
      {id:"team",     label:"Team Composition",  ph:"e.g. 2 BE, 2 FE, 1 mobile, 1 QA", max:100},
      {id:"duration", label:"Sprint Duration",   ph:"e.g. 2 weeks", max:30},
    ],
    prompt: d => `Feature: ${d.feature}\nGoal: ${d.goal}\nTeam: ${d.team}\nDuration: ${d.duration}\n\nGenerate a complete sprint plan:\n\n**EPIC SUMMARY:** One sentence with business value.\n\n**USER STORIES:** 4-6 stories each with: title, 3 acceptance criteria, story points (Fibonacci), dependencies.\n\n**TECHNICAL TASKS:** Break first story into specific engineering tasks with estimated hours.\n\n**DEFINITION OF DONE:** 6 criteria that must be met for sprint completion.\n\n**RISKS:** 3 risks that could derail this sprint with mitigation for each.`,
  },
  {
    id:"stakeholder", label:"Stakeholder Brief", icon:"◈", tag:"Communication",
    desc:"Tailor any brief to your specific audience in seconds",
    keywords:["stakeholder","brief","exec","communicate","present","align","leadership"],
    sections:["Executive Summary","Key Points","The Ask","Supporting Context","What Success Looks Like"],
    fields:[
      {id:"feature",  label:"Feature / Initiative", ph:"What are you communicating about?", max:100},
      {id:"context",  label:"Key Details",           ph:"Status, impact, timeline, decisions needed", max:200, area:true},
      {id:"audience", label:"Audience",              ph:"e.g. CEO, Engineering Lead, Sales team", max:80},
      {id:"goal",     label:"Your Goal",             ph:"What do you need from this audience?", max:120},
    ],
    prompt: d => `Feature: ${d.feature}\nDetails: ${d.context}\nAudience: ${d.audience}\nGoal: ${d.goal}\n\nWrite a stakeholder brief calibrated for this audience:\n\n**EXECUTIVE SUMMARY:** 3 sentences max. What, why it matters, what you need.\n\n**KEY POINTS:** 4 bullets framed in this audience's language and priorities.\n\n**THE ASK:** One clear sentence — what decision, action, or approval is needed.\n\n**SUPPORTING CONTEXT:** 3 pieces of context this audience specifically needs.\n\n**WHAT SUCCESS LOOKS LIKE:** How you will report progress back to them.`,
  },
  {
    id:"competitive", label:"Competitive Teardown", icon:"◉", tag:"Strategy",
    desc:"Map your competitive landscape and find differentiation angles",
    keywords:["competitor","competitive","market","differentiation","positioning","landscape","rivals"],
    sections:["Competitive Landscape","Competitor Breakdown","Whitespace Analysis","Differentiation Check","Positioning"],
    fields:[
      {id:"product",        label:"Your Product",       ph:"e.g. B2B project management for agencies", max:100},
      {id:"competitors",    label:"Key Competitors",    ph:"e.g. Asana, Monday, Notion, Linear", max:100},
      {id:"segment",        label:"Target Segment",     ph:"Who are you competing for?", max:100},
      {id:"differentiator", label:"Your Claimed Edge",  ph:"What do you think makes you different?", max:150},
    ],
    prompt: d => `Product: ${d.product}\nCompetitors: ${d.competitors}\nSegment: ${d.segment}\nClaimed edge: ${d.differentiator}\n\nDeliver a sharp competitive teardown:\n\n**COMPETITIVE LANDSCAPE:** 2-sentence summary of market dynamics and the real battleground.\n\n**COMPETITOR BREAKDOWN:** For each competitor: core strength, core weakness, who they are really built for.\n\n**WHITESPACE ANALYSIS:** 3 genuine gaps none of the listed competitors fill well.\n\n**DIFFERENTIATION REALITY CHECK:** Honest assessment of whether the claimed differentiator is defensible.\n\n**POSITIONING RECOMMENDATION:** One sharp positioning statement and 2 competitors to focus on winning against.`,
  },
  {
    id:"metrics", label:"Metrics Framework", icon:"◆", tag:"Analytics",
    desc:"Define your north star, input metrics, and guardrails",
    keywords:["metric","kpi","north star","measure","analytics","data","tracking","dashboard"],
    sections:["North Star Metric","Input Metrics","Guardrail Metrics","Counter-Metrics","Measurement Cadence"],
    fields:[
      {id:"product", label:"Product / Feature",        ph:"e.g. Social feed algorithm", max:100},
      {id:"goal",    label:"Business Goal",             ph:"What outcome matters to the business?", max:150},
      {id:"user",    label:"Healthy User Behaviour",    ph:"What do healthy users do?", max:120},
      {id:"risks",   label:"Known Risks",               ph:"What could go wrong that metrics should catch?", max:120},
    ],
    prompt: d => `Product: ${d.product}\nGoal: ${d.goal}\nHealthy behaviour: ${d.user}\nRisks: ${d.risks}\n\nBuild a complete metrics framework:\n\n**NORTH STAR METRIC:** Name, formula, why this captures long-term value, realistic target.\n\n**INPUT METRICS:** 4 leading indicators. Each: name, formula, how to measure, expected direction.\n\n**GUARDRAIL METRICS:** 3 metrics that must NOT degrade. Each: threshold, what it protects, alert condition.\n\n**COUNTER-METRICS:** 2 metrics to ensure you are not gaming the north star.\n\n**MEASUREMENT CADENCE:** Review frequency per metric type and who owns it.`,
  },
  {
    id:"interview", label:"Interview Script", icon:"◐", tag:"Research",
    desc:"Generate sharp user research questions from a problem statement",
    keywords:["user research","interview","discovery","usability","test","validate","qualitative","user study"],
    sections:["Session Intro","Warm-Up","Discovery Questions","Hypothesis Testing","Wrap-Up"],
    fields:[
      {id:"problem",  label:"Problem / Hypothesis", ph:"What are you trying to learn or validate?", max:200, area:true},
      {id:"user",     label:"Interview Subject",    ph:"Who are you talking to?", max:100},
      {id:"duration", label:"Session Duration",     ph:"e.g. 45 minutes", max:30},
      {id:"stage",    label:"Research Stage",       ph:"e.g. Discovery, Validation, Usability", max:60},
    ],
    prompt: d => `Hypothesis: ${d.problem}\nSubject: ${d.user}\nDuration: ${d.duration}\nStage: ${d.stage}\n\nWrite a complete interview script:\n\n**SESSION INTRO:** Welcome script and consent language. Put participant at ease without biasing them.\n\n**WARM-UP (5 min):** 3 questions to establish context and rapport.\n\n**DISCOVERY (15-20 min):** 6 open-ended questions with 1 probing follow-up each.\n\n**HYPOTHESIS TESTING (10-15 min):** 4 questions including one that specifically invites disagreement.\n\n**WRAP-UP:** 3 closing questions including the magic wand question.\n\n**OBSERVER NOTES TEMPLATE:** 4 things observers should watch for during the session.`,
  },
  {
    id:"launch", label:"Launch Checklist", icon:"◑", tag:"GTM",
    desc:"Generate a complete go-to-market checklist for any release",
    keywords:["launch","release","gtm","go to market","ship","deploy","announcement","rollout"],
    sections:["Pre-Launch","Launch Day","Communication Plan","Success Criteria","Rollback Plan"],
    fields:[
      {id:"feature",  label:"Feature / Release",  ph:"What are you launching?", max:100},
      {id:"audience", label:"Target Audience",     ph:"Who will receive this?", max:100},
      {id:"date",     label:"Launch Date",         ph:"e.g. 2 weeks from now", max:40},
      {id:"channels", label:"Available Channels",  ph:"e.g. Email, in-app, blog, sales team", max:100},
    ],
    prompt: d => `Feature: ${d.feature}\nAudience: ${d.audience}\nDate: ${d.date}\nChannels: ${d.channels}\n\nGenerate a complete launch checklist:\n\n**PRE-LAUNCH (T-14 to T-1):** 8 specific tasks with owner role and deadline offset (e.g. T-7: QA sign-off).\n\n**LAUNCH DAY (T-0):** 6 time-sequenced tasks with exact timing.\n\n**COMMUNICATION PLAN:** Draft 3 key messages: internal announcement, customer-facing, sales enablement.\n\n**SUCCESS CRITERIA:** Which metrics in the first 48 hours confirm a healthy launch.\n\n**ROLLBACK PLAN:** Decision criteria, who makes the call, 4 steps to execute.`,
  },
  {
    id:"postmortem", label:"Postmortem", icon:"◒", tag:"Operations",
    desc:"Turn an incident or failure into structured learning",
    keywords:["postmortem","incident","outage","failure","bug","retrospective","root cause","down"],
    sections:["Incident Summary","Detailed Timeline","Root Cause Analysis","What Went Well","Action Items","Prevention"],
    fields:[
      {id:"incident", label:"What Happened",   ph:"Brief description of the incident", max:200, area:true},
      {id:"impact",   label:"Impact",           ph:"Users affected, revenue impact, duration", max:120},
      {id:"timeline", label:"Key Timeline",     ph:"When started, detected, resolved", max:150},
      {id:"actions",  label:"Actions Taken",    ph:"What did the team do to resolve it?", max:150},
    ],
    prompt: d => `Incident: ${d.incident}\nImpact: ${d.impact}\nTimeline: ${d.timeline}\nActions: ${d.actions}\n\nWrite a complete postmortem:\n\n**INCIDENT SUMMARY:** 3 sentences — what happened, impact in numbers, how resolved.\n\n**DETAILED TIMELINE:** With timestamps. Mark Detection, Escalation, Resolution, All-clear.\n\n**ROOT CAUSE ANALYSIS:** Apply 5-Whys. List contributing factors separately.\n\n**WHAT WENT WELL:** 3 things the team did right during the incident.\n\n**ACTION ITEMS:** 6 specific items: What, Owner role, Priority (P0/P1/P2), Due date.\n\n**PREVENTION MEASURES:** 3 systemic changes that prevent this class of incident.`,
  },
  {
    id:"meeting", label:"Meeting Prep", icon:"◓", tag:"Meetings",
    desc:"Walk into every meeting with sharp talking points and a clear goal",
    keywords:["meeting","agenda","sync","presentation","review","align","prep","standup","1:1"],
    sections:["Proposed Agenda","Talking Points","Questions to Ask","Anticipated Pushback","Exit Criteria"],
    fields:[
      {id:"meeting",   label:"Meeting Type & Topic",  ph:"e.g. Sprint review, Q3 roadmap alignment", max:120},
      {id:"attendees", label:"Key Attendees",          ph:"Roles and their likely priorities", max:120},
      {id:"context",   label:"Your Context",           ph:"What you are bringing in, decisions needed", max:200, area:true},
      {id:"goal",      label:"Desired Outcome",        ph:"What must be true when you leave?", max:120},
    ],
    prompt: d => `Meeting: ${d.meeting}\nAttendees: ${d.attendees}\nContext: ${d.context}\nOutcome: ${d.goal}\n\nPrepare me for this meeting:\n\n**PROPOSED AGENDA:** 4-5 items with time allocations ordered to protect your outcome.\n\n**TALKING POINTS:** 5 specific points with the "so what" for this audience.\n\n**QUESTIONS TO ASK:** 4 questions including one that could surface hidden opposition.\n\n**ANTICIPATED PUSHBACK:** 3 likely objections and how to address each.\n\n**EXIT CRITERIA:** What must be agreed, decided, or assigned before closing.`,
  },
  {
    id:"rewriter", label:"Audience Rewriter", icon:"⟳", tag:"Communication",
    desc:"Rewrite any PM document instantly for a different audience",
    keywords:["rewrite","audience","translate","engineer","exec","sales","simplify","adapt","rephrase"],
    sections:["Rewritten Version","What Changed & Why","Framing Notes"],
    fields:[
      {id:"content", label:"Original Content",   ph:"Paste your document, feature description, or update", max:800, area:true, rows:6},
      {id:"from",    label:"Written For",         ph:"e.g. Engineering team, internal", max:60},
      {id:"to",      label:"Rewrite For",         ph:"e.g. CEO, Sales team, Customer-facing", max:60},
      {id:"goal",    label:"Communication Goal",  ph:"What should they do or feel after reading?", max:100},
    ],
    prompt: d => `Original: ${d.content}\nCurrently for: ${d.from}\nRewrite for: ${d.to}\nGoal: ${d.goal}\n\n**REWRITTEN VERSION:** Full rewrite calibrated for the new audience. Change language, emphasis, detail level, and frame — not just tone.\n\n**WHAT CHANGED AND WHY:** 4 specific changes and the reasoning behind each.\n\n**FRAMING NOTES:** 2 additional things to consider when presenting this to the new audience beyond the written word.`,
  },
  {
    id:"assumptions", label:"Assumption Mapper", icon:"◎", tag:"Strategy",
    desc:"Surface every hidden assumption in your PRD before you build",
    keywords:["assumption","risk","validate","unknown","hypothesis","discovery","lean","assumption mapping"],
    sections:["Assumption Inventory","Risk Ranking","Validation Plan","The One Assumption"],
    fields:[
      {id:"content",   label:"PRD / Idea / Plan",      ph:"Paste your PRD, idea, or plan here", max:800, area:true, rows:6},
      {id:"stage",     label:"Stage",                   ph:"e.g. Early idea, PRD complete, In development", max:60},
      {id:"resources", label:"Validation Resources",    ph:"What can you run? e.g. survey, prototype, data pull", max:120},
    ],
    prompt: d => `Plan: ${d.content}\nStage: ${d.stage}\nResources: ${d.resources}\n\nMap every assumption:\n\n**ASSUMPTION INVENTORY:** Every assumption grouped into: User, Market, Technical, Business. State each explicitly.\n\n**RISK RANKING:** Top 6 assumptions by Impact if wrong x Confidence we are right. Highlight 2 critical unknowns.\n\n**VALIDATION PLAN:** For each high-risk assumption: cheapest validation method, confirming signal, time needed.\n\n**THE ONE ASSUMPTION:** If you could validate only one before building — which one and why.`,
  },
  {
    id:"effort", label:"Effort Estimator", icon:"◈", tag:"Planning",
    desc:"Get a realistic effort estimate with confidence intervals",
    keywords:["estimate","effort","timeline","capacity","points","scope","complexity","velocity","story points"],
    sections:["T-Shirt Estimate","Component Breakdown","Hidden Complexity","Blocker Questions","Phasing"],
    fields:[
      {id:"feature",  label:"Feature Description",  ph:"Describe what needs to be built in detail", max:200, area:true},
      {id:"team",     label:"Team Composition",      ph:"e.g. 2 senior BE, 1 junior FE, 1 mobile", max:100},
      {id:"stack",    label:"Tech Stack / Context",  ph:"e.g. React, Node, existing auth system", max:100},
      {id:"unknowns", label:"Known Unknowns",        ph:"What do you not know yet?", max:120},
    ],
    prompt: d => `Feature: ${d.feature}\nTeam: ${d.team}\nStack: ${d.stack}\nUnknowns: ${d.unknowns}\n\nProvide a realistic effort estimate:\n\n**T-SHIRT ESTIMATE:** S/M/L/XL with week range and confidence %. What pushes it to the higher end.\n\n**COMPONENT BREAKDOWN:** 5-7 engineering components each with: description, estimated days, complexity flag (Green/Amber/Red).\n\n**HIDDEN COMPLEXITY:** 3 things typically underestimated in this type of feature.\n\n**BLOCKER QUESTIONS:** 4 questions that must be answered for a reliable estimate, and what each answer changes.\n\n**PHASING RECOMMENDATION:** How to break into 2-3 phases to de-risk delivery and get earlier feedback.`,
  },
  {
    id:"okr", label:"OKR Writer", icon:"◆", tag:"Planning",
    desc:"Write well-formed OKRs that are measurable and motivating",
    keywords:["okr","objective","key result","quarterly","goal","planning","kpi","q1","q2","q3","q4"],
    sections:["Objectives","Key Results","Failure Modes","Alignment Check","What Good Looks Like"],
    fields:[
      {id:"team",       label:"Team / Function",      ph:"e.g. Growth PM, Platform team", max:80},
      {id:"mission",    label:"Team Mission",          ph:"What is this team fundamentally here to do?", max:150},
      {id:"priorities", label:"Quarter Priorities",   ph:"Top 3 things that must happen this quarter", max:200, area:true},
      {id:"context",    label:"Company Context",       ph:"Company OKRs this ladders up to", max:150},
    ],
    prompt: d => `Team: ${d.team}\nMission: ${d.mission}\nPriorities: ${d.priorities}\nContext: ${d.context}\n\nWrite complete OKRs:\n\n**OBJECTIVES:** 2-3 objectives. Each must be: inspiring, directional, qualitative, achievable in one quarter. No metrics in objectives.\n\n**KEY RESULTS:** 3 KRs per objective. Each: specific, measurable, outcome-focused. Include baseline and target.\n\n**FAILURE MODES:** For each KR, one way it could be gamed without real impact and how to guard against it.\n\n**ALIGNMENT CHECK:** How these OKRs ladder up to the company context. Flag any gaps.\n\n**WHAT GOOD LOOKS LIKE:** At 70% completion, what does the team's world look like at quarter end?`,
  },
  {
    id:"sql", label:"SQL Query Builder", icon:"◐", tag:"Analytics",
    desc:"Describe a metric in plain English, get the SQL",
    keywords:["sql","query","data","metric","database","analytics","bigquery","postgres","snowflake","mysql"],
    sections:["Primary Query","Query Explanation","Assumptions Made","Query Variations","Validation Check"],
    fields:[
      {id:"metric",    label:"Metric to Measure",    ph:"e.g. 7-day retention for users who completed onboarding", max:200, area:true},
      {id:"tables",    label:"Available Tables",      ph:"e.g. users, events, sessions — describe key columns", max:200, area:true},
      {id:"dialect",   label:"SQL Dialect",           ph:"e.g. BigQuery, PostgreSQL, Snowflake, MySQL", max:40},
      {id:"timeframe", label:"Time Frame",            ph:"e.g. last 30 days, rolling 7-day window", max:60},
    ],
    prompt: d => `Metric: ${d.metric}\nTables: ${d.tables}\nDialect: ${d.dialect}\nTimeframe: ${d.timeframe}\n\nGenerate the SQL:\n\n**PRIMARY QUERY:** Complete runnable SQL with comments explaining each section. Use CTEs for readability. Optimise for the specified dialect.\n\n**QUERY EXPLANATION:** Plain-English walkthrough step by step.\n\n**ASSUMPTIONS MADE:** Table structure, column names, and business logic assumptions.\n\n**QUERY VARIATIONS:** 2 alternatives — one simpler approximation for performance, one with useful segmentation added.\n\n**VALIDATION CHECK:** A simple query to sanity-check the output of the main query.`,
  },
  {
    id:"raci", label:"RACI Generator", icon:"◑", tag:"Planning",
    desc:"Generate a RACI matrix for any project or initiative",
    keywords:["raci","responsible","accountable","matrix","project","ownership","governance","decision rights"],
    sections:["RACI Matrix","Decision Rights","Tension Points","Escalation Path","Health Check"],
    fields:[
      {id:"project",    label:"Project / Initiative", ph:"e.g. Mobile app redesign, API v2 launch", max:100},
      {id:"activities", label:"Key Activities",       ph:"List the main activities or workstreams", max:200, area:true},
      {id:"roles",      label:"Available Roles",      ph:"e.g. PM, Engineering, Design, Legal, Marketing", max:150},
      {id:"decisions",  label:"Key Decisions",        ph:"Major decisions that need clear ownership", max:150},
    ],
    prompt: d => `Project: ${d.project}\nActivities: ${d.activities}\nRoles: ${d.roles}\nDecisions: ${d.decisions}\n\nGenerate a complete RACI:\n\n**RACI MATRIX:** For each activity assign R/A/C/I per role. Flag multiple R owners and missing A owners as red flags.\n\n**DECISION RIGHTS:** For each key decision: who decides, who is consulted, who is informed, timeframe.\n\n**TENSION POINTS:** 3 areas where this RACI might create friction and how to address them in practice.\n\n**ESCALATION PATH:** When a decision cannot be made at the assigned level, the escalation chain with SLA at each level.\n\n**RACI HEALTH CHECK:** 3 signs it is working and 3 signs it has broken down in practice.`,
  },
  // ── INTERACTIVE ─────────────────────────────────────────────────────────
  {
    id:"experiment", label:"Experiment Designer", icon:"◒", tag:"Analytics",
    desc:"Calculate sample size, runtime and get AI interpretation",
    interactive: true,
    keywords:["ab test","experiment","sample size","significance","conversion","hypothesis","split test"],
    sections:["Feasibility Assessment","Setup Recommendations","Validity Risks","Decision Framework","Alternatives"],
    fields:[
      {id:"baseline",     label:"Baseline Conversion (%)",  ph:"e.g. 3.2",  max:10, numeric:true},
      {id:"mde",          label:"Min Detectable Effect (%)", ph:"e.g. 10",  max:10, numeric:true},
      {id:"confidence",   label:"Confidence Level (%)",     ph:"95",        max:5,  numeric:true},
      {id:"power",        label:"Statistical Power (%)",    ph:"80",        max:5,  numeric:true},
      {id:"variants",     label:"Number of Variants",       ph:"2",         max:3,  numeric:true},
      {id:"dailytraffic", label:"Daily Traffic (users)",    ph:"e.g. 5000", max:10, numeric:true},
      {id:"hypothesis",   label:"Hypothesis / Context",     ph:"What are you testing and why?", max:200, area:true},
    ],
    calculate: f => {
      const b = parseFloat(f.baseline)/100 || 0.03;
      const mde = parseFloat(f.mde)/100 || 0.1;
      const conf = parseFloat(f.confidence) || 95;
      const pow  = parseFloat(f.power) || 80;
      const variants = parseInt(f.variants) || 2;
      const daily = parseInt(f.dailytraffic) || 1000;
      const zC = conf>=99?2.576:conf>=95?1.96:1.645;
      const zP = pow>=90?1.282:pow>=80?0.842:0.524;
      const p2 = b*(1+mde);
      const pool = (b+p2)/2;
      const n = Math.ceil(Math.pow(zC+zP,2)*(pool*(1-pool)*2)/Math.pow(p2-b,2));
      const total = n*variants;
      const days = Math.ceil(total/daily);
      return { n:n.toLocaleString(), total:total.toLocaleString(), days, weeks:(days/7).toFixed(1), target:(p2*100).toFixed(2) };
    },
    prompt: (f, calc) => `Test: ${f.hypothesis||"Not specified"}\nBaseline: ${f.baseline||0}% | MDE: ${f.mde||0}% | Variants: ${f.variants||2}\nSample needed: ${calc.n||"?"} per variant | Runtime: ${calc.days||"?"} days | Daily traffic: ${f.dailytraffic||0}\n\n**FEASIBILITY ASSESSMENT:** Is this experiment feasible given the runtime vs traffic reality? Be honest.\n\n**SETUP RECOMMENDATIONS:** 3 specific recommendations to make this experiment more reliable.\n\n**VALIDITY RISKS:** 3 threats to internal validity specific to this setup.\n\n**DECISION FRAMEWORK:** Specific thresholds — what result means ship, iterate, or kill.\n\n**ALTERNATIVES:** If runtime is too long, 2 faster ways to get signal on this hypothesis.`,
  },
  {
    id:"prioritization", label:"Prioritisation Matrix", icon:"◓", tag:"Planning",
    desc:"Score and rank your backlog using RICE with AI analysis",
    interactive: true,
    keywords:["prioritize","rice","ice","backlog","rank","roadmap","impact","effort","prioritization"],
    sections:["RICE Scoring","Ranked List","Top 3 Deep Dive","Strategic Alignment","What to Defer"],
    fields:[
      {id:"items",       label:"Features to Prioritise",  ph:"List features, one per line", max:400, area:true, rows:5},
      {id:"timeframe",   label:"Planning Timeframe",      ph:"e.g. Q3 2025, next 6 months", max:60},
      {id:"constraints", label:"Key Constraints",         ph:"e.g. team size, budget, dependencies", max:150},
      {id:"context",     label:"Strategic Context",       ph:"What is the team optimising for this period?", max:150},
    ],
    calculate: () => null,
    prompt: f => `Features: ${f.items}\nTimeframe: ${f.timeframe}\nConstraints: ${f.constraints}\nContext: ${f.context}\n\n**RICE SCORING:** For each feature estimate Reach (users/quarter), Impact (0.25-3), Confidence (%), Effort (person-weeks). Show RICE = (R x I x C) / E.\n\n**RANKED LIST:** Features ordered by RICE score with scores shown.\n\n**TOP 3 DEEP DIVE:** Key assumptions and what would change the ranking for the top 3.\n\n**STRATEGIC ALIGNMENT:** Which features ladder up to stated context. Flag high-RICE items that do not align.\n\n**WHAT TO DEFER:** Bottom 2-3 features with honest reason — is it low impact or high effort?`,
  },
];

// ── KEYWORD DETECTION ────────────────────────────────────────────────────────
function detectModes(text, currentId) {
  if (!text || text.length < 8) return [];
  const lower = text.toLowerCase();
  return MODES
    .filter(m => m.id !== currentId)
    .map(m => ({ id: m.id, label: m.label, icon: m.icon, score: m.keywords.filter(k => lower.includes(k)).length }))
    .filter(m => m.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 3);
}

// ── PM LENS DATA ─────────────────────────────────────────────────────────────
const LENS = {
  prd:            { fw:["Jobs-to-be-Done","MoSCoW Prioritisation","Opportunity Solution Tree"], q:["What is the riskiest assumption here?","What is the simplest version that proves value?","What breaks for the user if this does not ship?"] },
  sprint:         { fw:["INVEST Criteria","Three Amigos","Definition of Ready"], q:["Is the sprint goal specific enough to test?","What creates cross-team dependencies?","Who is the hidden bottleneck?"] },
  stakeholder:    { fw:["Pyramid Principle","SCQA Framework","Audience Mapping"], q:["What does this audience fear most?","What single number matters to them?","What are they NOT saying in the room?"] },
  competitive:    { fw:["Porter's Five Forces","Jobs vs Features","Blue Ocean Strategy"], q:["Who are you not competing with but should be?","What is the real switching cost?","What does the market look like in 3 years?"] },
  metrics:        { fw:["North Star Framework","HEART Metrics","Pirate Metrics (AARRR)"], q:["Which metric is most gameable?","What lags by 30+ days and could mislead?","What would you regret not measuring at launch?"] },
  interview:      { fw:["The Mom Test","TEDW Probing","Continuous Discovery"], q:["Are you asking about the past or hypothetical?","What follow-up reveals the real story?","What result would make you throw out the findings?"] },
  launch:         { fw:["DACI Framework","Dual-track Agile","Feature Flag Rollout"], q:["Who has the power to stop this launch?","What is the minimum viable rollout?","Who finds out last — and should they?"] },
  postmortem:     { fw:["5 Whys Analysis","Fishbone Diagram","Blameless Culture"], q:["What system enabled this failure?","What would have caught this 24 hours earlier?","Is this a 1-time event or a systemic pattern?"] },
  meeting:        { fw:["Jeff Bezos 6-Pager","RACI","Disagreement Ladder"], q:["What is the real decision being made here?","Who in the room has misaligned incentives?","What are they not saying out loud?"] },
  rewriter:       { fw:["Pyramid Principle","BLUF Writing","Audience Empathy Map"], q:["What is the one thing they must remember?","What jargon does not cross the audience boundary?","What is their relationship to risk and change?"] },
  assumptions:    { fw:["Assumption Mapping Matrix","Two-by-Two Risk Grid","Lean Startup Validation"], q:["Which assumption failure is fatal to the plan?","What is the fastest zero-cost test you can run?","When did you stop questioning this assumption?"] },
  effort:         { fw:["T-shirt Sizing","3-Point Estimation (PERT)","Reference Class Forecasting"], q:["What is the hidden integration work not in scope?","When was the last similar feature estimated correctly?","What does the team not know that they do not know?"] },
  okr:            { fw:["Ambitious vs Roofshot OKRs","Cascade Alignment","Weekly OKR Check-ins"], q:["Is each KR a lagging or leading indicator?","Who will feel genuinely accountable for this?","What would make this KR meaningless to hit?"] },
  sql:            { fw:["Funnel Analysis","Cohort Analysis","Event-based Tracking"], q:["What rows get double-counted in this query?","Is this measuring activity or actual outcome?","What granularity is truly needed vs nice to have?"] },
  raci:           { fw:["DACI Decision Framework","Decision Matrix","Stakeholder Power-Interest Grid"], q:["Who has veto power that is not listed in the RACI?","What happens when R and A disagree?","Is this RACI simple enough to be remembered?"] },
  experiment:     { fw:["Frequentist vs Bayesian Testing","Multi-armed Bandit","Sequential Testing"], q:["Are you peeking at results before significance?","What is the novelty effect timeline for this change?","Is this truly random assignment across variants?"] },
  prioritization: { fw:["RICE Scoring","Kano Model","Opportunity Scoring"], q:["Is Reach based on real data or gut feel?","Who would disagree with these scores — and why?","What would double the impact score for the top item?"] },
};

// ── STYLES ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg:        #0C0A08;
    --surf:      #141210;
    --surf2:     #1C1916;
    --border:    rgba(240,165,0,0.10);
    --border2:   rgba(240,165,0,0.20);
    --amber:     #F0A500;
    --amber-d:   #A67300;
    --ember:     #E85D26;
    --parch:     #F5ECD7;
    --dim:       #7A6A52;
    --dim2:      #4A3D2C;
    --green:     #52C97A;
    --font:      'DM Sans', system-ui, sans-serif;
    --serif:     'DM Serif Display', Georgia, serif;
    --mono:      'JetBrains Mono', monospace;
    --r:         10px;
    --rs:        7px;
    --safe:      env(safe-area-inset-bottom, 0px);
  }

  .pms * { box-sizing:border-box; margin:0; padding:0; }

  .pms {
    min-height:100vh;
    background:var(--bg);
    color:var(--parch);
    font-family:var(--font);
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }

  /* BACK */
  .pms-back {
    position:fixed; top:14px; right:16px; z-index:500;
    background:rgba(12,10,8,0.92); border:1px solid var(--border2);
    color:var(--dim); font-size:11px; font-weight:500;
    letter-spacing:0.05em; padding:6px 14px; border-radius:20px;
    cursor:pointer; transition:all 0.2s; backdrop-filter:blur(8px);
    font-family:var(--font);
  }
  .pms-back:hover { color:var(--amber); border-color:rgba(240,165,0,0.4); }

  /* COCKPIT */
  .pms-cockpit { min-height:100vh; display:flex; flex-direction:column; }

  /* COMMAND BAR */
  .pms-cmd {
    background:var(--surf); border-bottom:1px solid var(--border);
    padding:16px 24px 0; position:sticky; top:0; z-index:200;
    flex-shrink:0;
  }

  .pms-brand-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .pms-brand-mark {
    width:30px; height:30px; border-radius:7px; flex-shrink:0;
    background:linear-gradient(135deg,var(--amber),var(--ember));
    display:flex; align-items:center; justify-content:center; font-size:15px;
  }
  .pms-brand-name { font-family:var(--serif); font-size:17px; color:var(--parch); letter-spacing:-0.02em; }
  .pms-brand-name em { color:var(--amber); font-style:normal; }
  .pms-brand-count { margin-left:auto; font-family:var(--mono); font-size:9px; color:var(--dim2); letter-spacing:0.08em; }

  /* MODE RAIL */
  .pms-rail-wrap { overflow-x:auto; scrollbar-width:none; }
  .pms-rail-wrap::-webkit-scrollbar { display:none; }
  .pms-rail { display:flex; gap:0; min-width:max-content; }

  .pms-rail-btn {
    display:flex; align-items:center; gap:6px;
    padding:8px 14px 10px; font-size:12px; font-weight:500;
    color:var(--dim); cursor:pointer; transition:all 0.15s;
    white-space:nowrap; border-bottom:2px solid transparent;
    margin-bottom:-1px; position:relative; background:none; border-top:none; border-left:none; border-right:none;
    font-family:var(--font);
  }
  .pms-rail-btn:hover { color:var(--parch); }
  .pms-rail-btn.on { color:var(--amber); border-bottom-color:var(--amber); }
  .pms-rail-badge {
    position:absolute; top:7px; right:5px;
    width:5px; height:5px; border-radius:50%; background:var(--amber);
    animation:pms-pulse 1.5s ease infinite;
  }

  /* STAGE */
  .pms-stage { display:grid; grid-template-columns:1fr 320px; flex:1; min-height:0; }
  @media(max-width:900px) { .pms-stage { grid-template-columns:1fr; } }

  /* LEFT */
  .pms-left { padding:26px 28px 120px; overflow-y:auto; }
  @media(max-width:768px) { .pms-left { padding:18px 16px 120px; } }
  .pms-left::-webkit-scrollbar { width:3px; }
  .pms-left::-webkit-scrollbar-thumb { background:rgba(240,165,0,0.12); border-radius:2px; }

  /* RIGHT */
  .pms-right {
    background:var(--surf); border-left:1px solid var(--border);
    padding:22px 18px; overflow-y:auto; display:flex;
    flex-direction:column; gap:18px;
  }
  .pms-right::-webkit-scrollbar { width:3px; }
  .pms-right::-webkit-scrollbar-thumb { background:rgba(240,165,0,0.12); border-radius:2px; }
  @media(max-width:900px) {
    .pms-right { border-left:none; border-top:1px solid var(--border); padding:16px; }
  }

  /* KEY CARD */
  .pms-key-card { background:var(--surf2); border:1px solid var(--border2); border-radius:var(--r); padding:18px; margin-bottom:22px; }
  .pms-key-title { font-family:var(--serif); font-size:16px; color:var(--parch); margin-bottom:3px; }
  .pms-key-sub { font-size:12px; color:var(--dim); margin-bottom:14px; line-height:1.5; }
  .pms-key-steps { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .pms-key-step { display:flex; align-items:flex-start; gap:8px; padding:7px 10px; background:rgba(240,165,0,0.04); border:1px solid var(--border); border-radius:var(--rs); }
  .pms-key-num { width:18px; height:18px; min-width:18px; border-radius:50%; background:var(--amber); display:flex; align-items:center; justify-content:center; font-size:9px; color:#000; font-weight:700; }
  .pms-key-step-txt { font-size:12px; color:var(--dim); line-height:1.45; }
  .pms-btn-studio { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; padding:9px; background:rgba(240,165,0,0.07); border:1px solid rgba(240,165,0,0.22); border-radius:var(--rs); color:var(--amber); font-size:11px; font-weight:600; text-decoration:none; cursor:pointer; transition:all 0.2s; margin-bottom:11px; font-family:var(--font); }
  .pms-btn-studio:hover { background:rgba(240,165,0,0.13); }
  .pms-key-div { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
  .pms-key-div::before,.pms-key-div::after { content:''; flex:1; height:1px; background:var(--border); }
  .pms-key-div span { font-size:10px; color:var(--dim2); }
  .pms-key-row { display:flex; gap:6px; margin-bottom:6px; }
  .pms-key-inp { flex:1; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--rs); padding:9px 11px; color:var(--parch); font-family:var(--mono); font-size:12px; outline:none; transition:border-color 0.2s; min-width:0; -webkit-appearance:none; }
  .pms-key-inp:focus { border-color:rgba(240,165,0,0.42); }
  .pms-key-inp::placeholder { color:var(--dim2); }
  .pms-key-tog { background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--rs); padding:9px; color:var(--dim2); cursor:pointer; font-size:12px; line-height:1; transition:color 0.15s; }
  .pms-key-tog:hover { color:var(--dim); }
  .pms-btn-save { background:var(--amber); color:#000; border:none; border-radius:var(--rs); padding:9px 13px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap; transition:background 0.2s; font-family:var(--font); }
  .pms-btn-save:hover { background:#D49400; }
  .pms-key-st { font-size:11px; min-height:15px; margin-bottom:3px; }
  .pms-key-st.ok { color:var(--green); }
  .pms-key-st.err { color:var(--ember); }
  .pms-key-warn { font-size:11px; color:#D4A017; padding:6px 10px; background:rgba(212,160,23,0.08); border:1px solid rgba(212,160,23,0.2); border-radius:var(--rs); margin-bottom:5px; }
  .pms-key-note { font-size:11px; color:var(--dim2); line-height:1.5; padding:7px 10px; background:rgba(255,255,255,0.02); border-radius:var(--rs); border-left:2px solid var(--amber-d); }

  /* KEY BANNER */
  .pms-banner { display:flex; align-items:center; gap:9px; background:rgba(82,201,122,0.06); border:1px solid rgba(82,201,122,0.18); border-radius:var(--rs); padding:9px 13px; margin-bottom:22px; }
  .pms-banner-dot { width:6px; height:6px; border-radius:50%; background:var(--green); flex-shrink:0; }
  .pms-banner-txt { flex:1; font-size:12px; color:var(--dim); }
  .pms-banner-txt strong { color:var(--parch); font-weight:500; }
  .pms-btn-chg { background:transparent; border:1px solid var(--border2); color:var(--dim); border-radius:var(--rs); padding:4px 9px; font-size:10px; cursor:pointer; transition:all 0.15s; font-family:var(--font); }
  .pms-btn-chg:hover { color:var(--parch); }

  /* MODE HERO */
  .pms-hero { margin-bottom:18px; }
  .pms-hero-eyebrow { display:flex; align-items:center; gap:7px; margin-bottom:7px; }
  .pms-hero-icon { width:32px; height:32px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:15px; background:rgba(240,165,0,0.08); border:1px solid var(--border2); }
  .pms-hero-tag { font-size:10px; font-weight:600; letter-spacing:0.06em; padding:3px 8px; border-radius:4px; text-transform:uppercase; background:rgba(240,165,0,0.10); color:var(--amber); }
  .pms-hero-title { font-family:var(--serif); font-size:clamp(19px,3.5vw,25px); color:var(--parch); letter-spacing:-0.02em; margin-bottom:4px; line-height:1.2; }
  .pms-hero-desc { font-size:13px; color:var(--dim); line-height:1.5; }

  /* CHIPS */
  .pms-chips { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:18px; }
  .pms-chip { font-size:10px; font-weight:500; letter-spacing:0.02em; padding:3px 9px; border-radius:20px; background:rgba(255,255,255,0.03); border:1px solid var(--border); color:var(--dim); }

  /* HISTORY */
  .pms-hist { margin-bottom:16px; }
  .pms-hist-lbl { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--dim2); margin-bottom:6px; }
  .pms-hist-list { display:flex; flex-direction:column; gap:4px; }
  .pms-hist-row { display:flex; align-items:center; gap:7px; padding:6px 9px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:var(--rs); cursor:pointer; transition:border-color 0.15s; }
  .pms-hist-row:hover { border-color:var(--border2); }
  .pms-hist-name { flex:1; font-size:12px; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pms-hist-del { background:none; border:none; color:var(--dim2); cursor:pointer; font-size:13px; padding:0 2px; transition:color 0.15s; flex-shrink:0; }
  .pms-hist-del:hover { color:var(--ember); }

  /* FORM */
  .pms-form { margin-bottom:16px; }
  .pms-field { margin-bottom:12px; }
  .pms-field-lbl { display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; }
  .pms-field-lbl-txt { font-size:11px; font-weight:600; color:var(--dim); letter-spacing:0.03em; }
  .pms-char { font-size:10px; color:var(--dim2); }
  .pms-char.warn { color:var(--ember); }
  .pms-inp, .pms-ta, .pms-sel {
    width:100%; background:rgba(255,255,255,0.03); border:1px solid var(--border);
    border-radius:var(--rs); padding:10px 12px; color:var(--parch);
    font-family:var(--font); font-size:14px; outline:none;
    transition:border-color 0.2s, background 0.15s; resize:vertical;
    -webkit-appearance:none;
  }
  .pms-inp:focus,.pms-ta:focus,.pms-sel:focus { border-color:rgba(240,165,0,0.40); background:rgba(240,165,0,0.03); }
  .pms-inp::placeholder,.pms-ta::placeholder { color:var(--dim2); }
  .pms-sel option { background:var(--bg); }
  .pms-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media(max-width:480px) { .pms-row { grid-template-columns:1fr; } }

  /* CALC GRID */
  .pms-calc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-bottom:12px; }
  @media(max-width:480px) { .pms-calc-grid { grid-template-columns:1fr 1fr; } }

  /* CALC LIVE */
  .pms-calc-live { background:rgba(240,165,0,0.05); border:1px solid rgba(240,165,0,0.15); border-radius:var(--r); padding:14px; margin-bottom:16px; }
  .pms-calc-live-lbl { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--amber-d); margin-bottom:11px; }
  .pms-calc-stats { display:grid; grid-template-columns:1fr 1fr; gap:11px; }
  .pms-calc-val { font-family:var(--serif); font-size:22px; color:var(--parch); line-height:1; margin-bottom:2px; }
  .pms-calc-label { font-size:11px; color:var(--dim); }

  /* GEN BUTTON */
  .pms-btn-gen { width:100%; background:var(--amber); color:#000; border:none; border-radius:var(--r); padding:13px; font-family:var(--font); font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s; margin-bottom:7px; display:flex; align-items:center; justify-content:center; gap:8px; letter-spacing:0.02em; }
  .pms-btn-gen:hover:not(:disabled) { background:#D49400; box-shadow:0 4px 20px rgba(240,165,0,0.22); transform:translateY(-1px); }
  .pms-btn-gen:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
  .pms-btn-spin { width:13px; height:13px; border:2px solid rgba(0,0,0,0.2); border-top-color:#000; border-radius:50%; animation:pms-spin 0.7s linear infinite; }
  .pms-fn { font-size:10px; color:var(--dim2); text-align:center; margin-bottom:15px; }

  /* PROGRESS */
  .pms-prog { display:flex; align-items:center; gap:11px; padding:12px 14px; background:rgba(240,165,0,0.05); border:1px solid rgba(240,165,0,0.14); border-radius:var(--rs); margin-bottom:16px; }
  .pms-prog-spin { width:15px; height:15px; flex-shrink:0; border:2px solid rgba(240,165,0,0.18); border-top-color:var(--amber); border-radius:50%; animation:pms-spin 0.75s linear infinite; }
  .pms-prog-txt { font-size:13px; color:var(--dim); font-style:italic; }

  /* ERROR */
  .pms-err { background:rgba(232,93,38,0.07); border:1px solid rgba(232,93,38,0.22); border-radius:var(--rs); padding:11px 13px; margin-bottom:15px; font-size:13px; color:#FFAB8A; line-height:1.6; }

  /* OUTPUT */
  .pms-out { animation:pms-up 0.35s ease both; }
  .pms-out-hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:13px; gap:10px; flex-wrap:wrap; }
  .pms-out-title { font-family:var(--serif); font-size:clamp(14px,2.5vw,18px); color:var(--parch); flex:1; line-height:1.3; }
  .pms-out-title em { display:block; font-family:var(--font); font-size:10px; color:var(--dim2); font-style:normal; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; margin-top:2px; }
  .pms-out-acts { display:flex; gap:5px; flex-wrap:wrap; flex-shrink:0; }
  .pms-btn-act { background:transparent; border:1px solid var(--border2); color:var(--dim); border-radius:var(--rs); padding:5px 10px; font-size:10px; font-weight:600; cursor:pointer; transition:all 0.15s; text-transform:uppercase; letter-spacing:0.04em; font-family:var(--font); }
  .pms-btn-act:hover { background:rgba(255,255,255,0.04); color:var(--parch); }
  .pms-btn-act.red { border-color:rgba(232,93,38,0.3); color:var(--ember); }
  .pms-btn-act.red:hover { background:rgba(232,93,38,0.06); }

  /* OUTPUT CARD */
  .pms-card { background:var(--surf2); border:1px solid var(--border); border-radius:var(--r); margin-bottom:7px; overflow:hidden; }
  .pms-card-hdr { padding:10px 13px; display:flex; align-items:center; gap:8px; cursor:pointer; transition:background 0.15s; user-select:none; -webkit-tap-highlight-color:transparent; }
  .pms-card-hdr:hover { background:rgba(240,165,0,0.04); }
  .pms-card-pip { width:5px; height:5px; border-radius:50%; background:var(--dim2); flex-shrink:0; transition:background 0.3s; }
  .pms-card-pip.lit { background:var(--amber); }
  .pms-card-lbl { font-size:11px; font-weight:700; color:var(--dim); text-transform:uppercase; letter-spacing:0.06em; flex:1; }
  .pms-card-chev { color:var(--dim2); font-size:10px; transition:transform 0.2s; flex-shrink:0; }
  .pms-card-chev.open { transform:rotate(180deg); }
  .pms-card-body { padding:13px; font-size:13px; line-height:1.85; color:var(--parch); white-space:pre-wrap; border-top:1px solid var(--border); }

  /* Streaming cursor */
  .pms-cur { display:inline-block; width:2px; height:13px; background:var(--amber); margin-left:2px; vertical-align:middle; animation:pms-blink 1s step-end infinite; }

  /* Output label */
  .pms-lbl { display:block; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--amber); margin-top:12px; margin-bottom:4px; }
  .pms-lbl:first-child { margin-top:0; }

  /* TEST MODE */
  .pms-test { background:rgba(240,165,0,0.07); border:1px solid rgba(240,165,0,0.2); border-radius:var(--rs); padding:7px 12px; margin-bottom:14px; font-size:11px; color:var(--amber); text-align:center; }

  /* PM LENS */
  .pms-lens-title { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--amber-d); margin-bottom:8px; }
  .pms-lens-sec-lbl { font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--dim2); margin-bottom:6px; }
  .pms-fw-pill { padding:7px 10px; background:rgba(240,165,0,0.05); border:1px solid var(--border); border-radius:var(--rs); font-size:11px; color:var(--dim); line-height:1.4; margin-bottom:5px; }
  .pms-q-row { display:flex; align-items:flex-start; gap:6px; margin-bottom:6px; font-size:12px; color:var(--dim); line-height:1.5; }
  .pms-q-dot { width:4px; height:4px; border-radius:50%; flex-shrink:0; margin-top:6px; }
  .pms-lens-empty { font-size:12px; color:var(--dim2); font-style:italic; line-height:1.6; padding:10px; border:1px dashed var(--border); border-radius:var(--rs); text-align:center; }
  .pms-lens-gen { font-size:12px; color:var(--dim); font-style:italic; line-height:1.7; }

  /* SUGGESTED */
  .pms-sug-lbl { font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--dim2); margin-bottom:6px; }
  .pms-sug-item { display:flex; align-items:center; gap:7px; padding:7px 10px; background:rgba(240,165,0,0.04); border:1px solid rgba(240,165,0,0.11); border-radius:var(--rs); cursor:pointer; transition:all 0.15s; margin-bottom:4px; }
  .pms-sug-item:hover { background:rgba(240,165,0,0.09); border-color:rgba(240,165,0,0.24); }
  .pms-sug-icon { font-size:13px; }
  .pms-sug-lbl-text { font-size:12px; color:var(--parch); font-weight:500; flex:1; }
  .pms-sug-arrow { font-size:10px; color:var(--amber-d); }

  /* MOBILE BOTTOM NAV */
  .pms-mob-nav {
    display:none; position:fixed; bottom:0; left:0; right:0;
    background:var(--surf); border-top:1px solid var(--border);
    padding:6px 8px calc(6px + var(--safe)); z-index:300;
    overflow-x:auto; scrollbar-width:none;
  }
  .pms-mob-nav::-webkit-scrollbar { display:none; }
  .pms-mob-inner { display:flex; gap:2px; min-width:max-content; }
  @media(max-width:768px) { .pms-mob-nav { display:block; } }
  .pms-mob-btn { display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 10px; border-radius:var(--rs); cursor:pointer; transition:all 0.15s; min-width:52px; background:none; border:none; font-family:var(--font); }
  .pms-mob-btn.on { background:rgba(240,165,0,0.10); }
  .pms-mob-icon { font-size:14px; }
  .pms-mob-lbl { font-size:8px; font-weight:600; letter-spacing:0.03em; color:var(--dim2); text-transform:uppercase; white-space:nowrap; }
  .pms-mob-btn.on .pms-mob-lbl { color:var(--amber); }

  /* ANIMATIONS */
  @keyframes pms-spin   { to { transform:rotate(360deg); } }
  @keyframes pms-up     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pms-blink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes pms-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

  /* FOCUS */
  button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible {
    outline:2px solid var(--amber); outline-offset:2px;
  }
`;

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmtOut(raw) {
  return raw
    .replace(/\*\*([^*\n]{1,80}):\*\*/g,'<span class="pms-lbl">$1</span>')
    .replace(/\*\*([^*\n]+)\*\*/g,'<strong style="color:var(--parch)">$1</strong>')
    .replace(/^#{1,3}\s+(.+)$/gm,'<span class="pms-lbl">$1</span>')
    .trim();
}

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getHist() {
  try { return JSON.parse(localStorage.getItem(LS_HIST)||"[]"); } catch { return []; }
}

function saveHist(modeId, label, secs, raw) {
  let h = getHist().filter(x=>!(x.modeId===modeId&&x.label===label));
  h.unshift({id:Date.now(),modeId,label,secs,raw});
  if (h.length>MAX_HIST) h=h.slice(0,MAX_HIST);
  try { localStorage.setItem(LS_HIST,JSON.stringify(h)); } catch {}
}

function parseSecs(raw) {
  const secs=[]; const lines=raw.split("\n");
  let cur=null, buf=[];
  for (const ln of lines) {
    const bm=ln.match(/^\*\*([^*:]{2,80}):\*\*\s*$/);
    const hm=ln.match(/^#{1,3}\s+(.+)$/);
    const lbl=bm?.[1]||hm?.[1];
    if (lbl) { if(cur) secs.push({title:cur,content:buf.join("\n").trim()}); cur=lbl; buf=[]; }
    else buf.push(ln);
  }
  if (cur) secs.push({title:cur,content:buf.join("\n").trim()});
  return secs.length ? secs : [{title:"Output",content:raw.trim()}];
}

// ── GEMINI ───────────────────────────────────────────────────────────────────
async function callGemini(prompt, key) {
  if (TEST_MODE) {
    await new Promise(r=>setTimeout(r,1100));
    return `**SECTION ONE:**\nTest mode active. UI, history, PM lens, streaming cursor, and mobile nav all functional. Amber palette rendering correctly.\n\n**SECTION TWO:**\nAll 17 modes verified. Interactive calculator live. Keyword detection working. Suggested modes panel operational.\n\n**SECTION THREE:**\nFlip TEST_MODE = false to go live. Token budget: ~900 per run at temperature 0.5.`;
  }
  const ctrl=new AbortController();
  const tmr=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  let res;
  try {
    res=await fetch(GEMINI_URL(key),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:ctrl.signal,
      body:JSON.stringify({
        system_instruction:{parts:[{text:SYS}]},
        contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{temperature:0.5,topP:0.90,maxOutputTokens:900},
        safetySettings:[
          {category:"HARM_CATEGORY_HARASSMENT",        threshold:"BLOCK_ONLY_HIGH"},
          {category:"HARM_CATEGORY_HATE_SPEECH",       threshold:"BLOCK_ONLY_HIGH"},
          {category:"HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold:"BLOCK_ONLY_HIGH"},
          {category:"HARM_CATEGORY_DANGEROUS_CONTENT", threshold:"BLOCK_ONLY_HIGH"},
        ],
      }),
    });
  } catch(e) {
    clearTimeout(tmr);
    if(e.name==="AbortError") throw new Error("Request timed out. Check your connection and retry.");
    throw new Error("Network error — check your connection.");
  }
  clearTimeout(tmr);
  if(!res.ok){
    let msg=`HTTP ${res.status}`;
    try{const j=await res.json();msg=j?.error?.message||msg;}catch{}
    if(res.status===429) throw new Error("Rate limit hit. Wait 60 seconds — or get a fresh key at aistudio.google.com/apikey");
    if(res.status===403) throw new Error("API key invalid or expired. Click Change to update.");
    throw new Error(msg);
  }
  const data=await res.json();
  const cand=data.candidates?.[0];
  if(!cand)                         throw new Error("No response received. Try again.");
  if(cand.finishReason==="SAFETY")  throw new Error("Content blocked. Rephrase your input.");
  const text=cand.content?.parts?.[0]?.text?.trim()||"";
  if(!text||text.length<20)         throw new Error("Empty response. Please try again.");
  return text;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode,      setMode]      = useState(MODES[0].id);
  const [apiKey,    setApiKey]    = useState(()=>localStorage.getItem(LS_KEY)||"");
  const [keyIn,     setKeyIn]     = useState(()=>localStorage.getItem(LS_KEY)||"");
  const [keyVis,    setKeyVis]    = useState(false);
  const [keyOn,     setKeyOn]     = useState(()=>!!localStorage.getItem(LS_KEY));
  const [keySt,     setKeySt]     = useState({msg:"",ok:true});
  const [keyWarn,   setKeyWarn]   = useState(false);
  const [fields,    setFields]    = useState({});
  const [running,   setRunning]   = useState(false);
  const [progMsg,   setProgMsg]   = useState("");
  const [secs,      setSecs]      = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [calcRes,   setCalcRes]   = useState(null);
  const [hist,      setHist]      = useState(()=>getHist());
  const [err,       setErr]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const [suggested, setSuggested] = useState([]);

  const outRef  = useRef(null);
  const progRef = useRef(null);
  const railRef = useRef(null);

  const M    = MODES.find(m=>m.id===mode)||MODES[0];
  const lens = LENS[mode]||{fw:[],q:[]};

  // Reset on mode change
  useEffect(()=>{
    setFields({}); setSecs(null); setErr("");
    setCalcRes(null); setCollapsed({}); setStreaming(false); setSuggested([]);
  },[mode]);

  // Live calc
  useEffect(()=>{
    if(M.interactive&&M.calculate){
      try{setCalcRes(M.calculate(fields));}catch{setCalcRes(null);}
    }
  },[fields,mode]);

  // Scroll active into rail
  useEffect(()=>{
    const el=railRef.current?.querySelector(".on");
    el?.scrollIntoView({inline:"nearest",block:"nearest",behavior:"smooth"});
  },[mode]);

  // KEY
  function saveKey(){
    const k=keyIn.trim();
    if(!k)                    return setKeySt({msg:"Paste your key first.",ok:false});
    if(!k.startsWith("AIza")) return setKeySt({msg:'Key should start with "AIza".',ok:false});
    if(k.length<30)            return setKeySt({msg:"Key looks too short.",ok:false});
    const isNew=!localStorage.getItem(LS_KEY);
    localStorage.setItem(LS_KEY,k);
    setApiKey(k);setKeyOn(true);
    setKeySt({msg:"Key saved ✓",ok:true});
    if(isNew) setKeyWarn(true);
  }
  function changeKey(){ setKeyOn(false);setKeySt({msg:"",ok:true});setKeyWarn(false); }

  // VALIDATE
  function validate(){
    for(const f of M.fields.filter(x=>!x.numeric)){
      if(!(fields[f.id]||"").trim()) return `${f.label} is required.`;
    }
    if(TEST_MODE) return null;
    const k=localStorage.getItem(LS_KEY)||keyIn.trim();
    if(!k)                    return "Save your Gemini API key first.";
    if(!k.startsWith("AIza")) return "Invalid API key format.";
    return null;
  }

  // GENERATE
  async function generate(){
    const e=validate(); if(e){setErr(e);return;} if(running) return;
    const key=localStorage.getItem(LS_KEY)||keyIn.trim();
    setRunning(true);setErr("");setSecs(null);setStreaming(false);
    setTimeout(()=>progRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),150);
    try{
      const prompt=M.interactive?M.prompt(fields,calcRes||{}):M.prompt(fields);
      setProgMsg("Generating "+M.label+"...");
      const raw=await callGemini(prompt,key);
      const parsed=parseSecs(raw);
      const lbl=fields[M.fields[0]?.id]||M.label;
      saveHist(M.id,lbl,parsed,raw);
      setHist(getHist());
      setStreaming(true); setSecs(parsed); setCollapsed({});
      setTimeout(()=>setStreaming(false),1800);
      setTimeout(()=>outRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
    }catch(e){setErr(e.message);}
    finally{setRunning(false);setProgMsg("");}
  }

  // HISTORY
  function loadHist(h){ setSecs(h.secs);setCollapsed({});setStreaming(false);setTimeout(()=>outRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100); }
  function delHist(id,e){ e.stopPropagation();const u=getHist().filter(h=>h.id!==id);try{localStorage.setItem(LS_HIST,JSON.stringify(u));}catch{}setHist(u); }

  // EXPORT
  function fullTxt(){
    if(!secs) return "";
    const lbl=fields[M.fields[0]?.id]||M.label;
    let t=`${M.label.toUpperCase()}: ${lbl}\n${"=".repeat(60)}\n\n`;
    secs.forEach(s=>{t+=`[ ${s.title.toUpperCase()} ]\n${"-".repeat(40)}\n${s.content}\n\n\n`;});
    t+=`${"=".repeat(60)}\nJanardhan Labs — PM Studio\n`;
    return t;
  }
  function copyOut(){ navigator.clipboard.writeText(fullTxt()).catch(()=>{}); }
  function dlOut(){
    const lbl=(fields[M.fields[0]?.id]||"output").replace(/[^a-z0-9]/gi,"_").slice(0,40);
    const b=new Blob([fullTxt()],{type:"text/plain;charset=utf-8"});
    const u=URL.createObjectURL(b);
    const a=Object.assign(document.createElement("a"),{href:u,download:`${lbl}_${M.id}.txt`});
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);
  }

  // BACK
  function goBack(){ window.history.pushState({},"","/");window.dispatchEvent(new PopStateEvent("popstate",{state:{}})); }

  // FIELD HELPERS
  const sf=(id,val)=>{
    setFields(f=>({...f,[id]:val}));
    const all=Object.values({...fields,[id]:val}).join(" ");
    setSuggested(detectModes(all,mode));
  };
  const rem=(id,max)=>max-(fields[id]||"").length;
  const cc=(id,max)=>"pms-char"+(rem(id,max)<20?" warn":"");

  // RENDER FORM FIELDS (pair short fields)
  function renderFields(){
    const out=[]; let i=0;
    while(i<M.fields.length){
      const f=M.fields[i];
      const nxt=M.fields[i+1];
      const pair=!f.area&&nxt&&!nxt.area;
      if(pair){
        out.push(
          <div className="pms-row" key={f.id}>
            {[f,nxt].map(ff=>(
              <div className="pms-field" key={ff.id}>
                <div className="pms-field-lbl"><span className="pms-field-lbl-txt">{ff.label}</span><span className={cc(ff.id,ff.max)}>{rem(ff.id,ff.max)}</span></div>
                <input className="pms-inp" placeholder={ff.ph} maxLength={ff.max} value={fields[ff.id]||""} onChange={e=>sf(ff.id,e.target.value)}/>
              </div>
            ))}
          </div>
        );
        i+=2;
      } else {
        out.push(
          <div className="pms-field" key={f.id}>
            <div className="pms-field-lbl"><span className="pms-field-lbl-txt">{f.label}</span><span className={cc(f.id,f.max)}>{rem(f.id,f.max)}</span></div>
            {f.area
              ?<textarea className="pms-ta" rows={f.rows||3} placeholder={f.ph} maxLength={f.max} value={fields[f.id]||""} onChange={e=>sf(f.id,e.target.value)}/>
              :<input className="pms-inp" placeholder={f.ph} maxLength={f.max} value={fields[f.id]||""} onChange={e=>sf(f.id,e.target.value)}/>
            }
          </div>
        );
        i++;
      }
    }
    return out;
  }

  const modeHist = hist.filter(h=>h.modeId===mode);
  const txtModes = MODES.filter(m=>!m.interactive);
  const calcModes= MODES.filter(m=> m.interactive);

  return(
    <>
      <style>{STYLES}</style>
      <div className="pms">
        <button className="pms-back" onClick={goBack}>← Labs</button>

        <div className="pms-cockpit">

          {/* COMMAND BAR */}
          <div className="pms-cmd">
            <div className="pms-brand-row">
              <div className="pms-brand-mark">⚡</div>
              <div className="pms-brand-name">PM <em>Studio</em></div>
              <div className="pms-brand-count">17 modes</div>
            </div>
            <div className="pms-rail-wrap">
              <div className="pms-rail" ref={railRef}>
                {MODES.map(m=>(
                  <button key={m.id} className={`pms-rail-btn ${mode===m.id?"on":""}`} onClick={()=>setMode(m.id)}>
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                    {suggested.some(s=>s.id===m.id)&&mode!==m.id&&<span className="pms-rail-badge"/>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STAGE */}
          <div className="pms-stage">

            {/* LEFT */}
            <div className="pms-left">
              {TEST_MODE&&<div className="pms-test">⚗ Test Mode — set TEST_MODE = false to go live</div>}

              {/* KEY */}
              {!keyOn?(
                <div className="pms-key-card">
                  <div className="pms-key-title">Connect Gemini</div>
                  <div className="pms-key-sub">Free API key from Google. No credit card needed.</div>
                  <div className="pms-key-steps">
                    {["Open Google AI Studio","Sign in with Google","Click Create API Key — copy it","Paste below and tap Save"].map((s,i)=>(
                      <div className="pms-key-step" key={i}>
                        <div className="pms-key-num">{i+1}</div>
                        <div className="pms-key-step-txt">{s}</div>
                      </div>
                    ))}
                  </div>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="pms-btn-studio">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                    Get Free Gemini API Key
                  </a>
                  <div className="pms-key-div"><span>paste key here</span></div>
                  <div className="pms-key-row">
                    <input type={keyVis?"text":"password"} className="pms-key-inp" placeholder="AIza..."
                      value={keyIn} onChange={e=>setKeyIn(e.target.value.trim())}
                      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}/>
                    <button className="pms-key-tog" onClick={()=>setKeyVis(v=>!v)}>{keyVis?"🙈":"👁"}</button>
                    <button className="pms-btn-save" onClick={saveKey}>Save</button>
                  </div>
                  {keySt.msg&&<div className={`pms-key-st ${keySt.ok?"ok":"err"}`}>{keySt.msg}</div>}
                  {keyWarn&&<div className="pms-key-warn">⚠ Save your key somewhere safe — clearing browser data removes it.</div>}
                  <div className="pms-key-note">Stored only in your browser. Free tier: 1,500 requests/day.</div>
                </div>
              ):(
                <div className="pms-banner">
                  <div className="pms-banner-dot"/>
                  <div className="pms-banner-txt"><strong>Gemini connected</strong> · {apiKey.slice(0,8)}...{apiKey.slice(-4)}</div>
                  <button className="pms-btn-chg" onClick={changeKey}>Change</button>
                </div>
              )}

              {/* MODE HERO */}
              <div className="pms-hero">
                <div className="pms-hero-eyebrow">
                  <div className="pms-hero-icon">{M.icon}</div>
                  <span className="pms-hero-tag">{M.tag}</span>
                </div>
                <div className="pms-hero-title">{M.label}</div>
                <div className="pms-hero-desc">{M.desc}</div>
              </div>

              {/* OUTPUT PREVIEW CHIPS */}
              <div className="pms-chips">{M.sections.map((s,i)=><span key={i} className="pms-chip">{s}</span>)}</div>

              {/* HISTORY */}
              {modeHist.length>0&&(
                <div className="pms-hist">
                  <div className="pms-hist-lbl">Recent</div>
                  <div className="pms-hist-list">
                    {modeHist.map(h=>(
                      <div className="pms-hist-row" key={h.id} onClick={()=>loadHist(h)}>
                        <span className="pms-hist-name">{h.label}</span>
                        <button className="pms-hist-del" onClick={e=>delHist(h.id,e)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FORM */}
              <div className="pms-form">
                {M.interactive?(
                  <>
                    <div className="pms-calc-grid">
                      {M.fields.filter(f=>f.numeric).map(f=>(
                        <div className="pms-field" key={f.id}>
                          <div className="pms-field-lbl"><span className="pms-field-lbl-txt">{f.label}</span></div>
                          <input className="pms-inp" type="number" placeholder={f.ph} value={fields[f.id]||""} onChange={e=>sf(f.id,e.target.value)}/>
                        </div>
                      ))}
                    </div>
                    {M.fields.filter(f=>!f.numeric).map(f=>(
                      <div className="pms-field" key={f.id}>
                        <div className="pms-field-lbl"><span className="pms-field-lbl-txt">{f.label}</span><span className={cc(f.id,f.max)}>{rem(f.id,f.max)}</span></div>
                        {f.area?<textarea className="pms-ta" rows={f.rows||3} placeholder={f.ph} maxLength={f.max} value={fields[f.id]||""} onChange={e=>sf(f.id,e.target.value)}/>
                               :<input className="pms-inp" placeholder={f.ph} maxLength={f.max} value={fields[f.id]||""} onChange={e=>sf(f.id,e.target.value)}/>}
                      </div>
                    ))}
                  </>
                ):renderFields()}
              </div>

              {/* CALC LIVE RESULT */}
              {M.interactive&&calcRes&&(
                <div className="pms-calc-live">
                  <div className="pms-calc-live-lbl">Live Calculation</div>
                  <div className="pms-calc-stats">
                    <div><div className="pms-calc-val">{calcRes.n}</div><div className="pms-calc-label">Per variant</div></div>
                    <div><div className="pms-calc-val">{calcRes.total}</div><div className="pms-calc-label">Total users</div></div>
                    <div><div className="pms-calc-val">{calcRes.days}d</div><div className="pms-calc-label">Runtime ({calcRes.weeks} wks)</div></div>
                    <div><div className="pms-calc-val">{calcRes.target}%</div><div className="pms-calc-label">Target rate</div></div>
                  </div>
                </div>
              )}

              {/* GENERATE */}
              <button className="pms-btn-gen" onClick={generate} disabled={running}>
                {running&&<div className="pms-btn-spin"/>}
                <span>{running?"Generating...":"Generate "+M.label}</span>
              </button>
              <div className="pms-fn">{TEST_MODE?"Test mode — no API call":"Gemini 2.0 Flash Lite · ~900 tokens · Janardhan Labs"}</div>

              {/* PROGRESS */}
              {running&&(
                <div className="pms-prog" ref={progRef}>
                  <div className="pms-prog-spin"/>
                  <div className="pms-prog-txt">{progMsg}</div>
                </div>
              )}

              {/* ERROR */}
              {err&&<div className="pms-err">⚠ {err}</div>}

              {/* OUTPUT */}
              {secs&&(
                <div className="pms-out" ref={outRef}>
                  <div className="pms-out-hdr">
                    <div className="pms-out-title">
                      {esc(fields[M.fields[0]?.id]||M.label)}
                      <em>{M.label}</em>
                    </div>
                    <div className="pms-out-acts">
                      <button className="pms-btn-act" onClick={copyOut}>Copy</button>
                      <button className="pms-btn-act" onClick={dlOut}>Save</button>
                      <button className="pms-btn-act red" onClick={()=>{setSecs(null);window.scrollTo({top:0,behavior:"smooth"});}}>Clear</button>
                    </div>
                  </div>
                  {secs.map((s,i)=>(
                    <div className="pms-card" key={i}>
                      <div className="pms-card-hdr" onClick={()=>setCollapsed(c=>({...c,[i]:!c[i]}))}>
                        <div className={`pms-card-pip ${i===0&&!collapsed[0]?"lit":""}`}/>
                        <span className="pms-card-lbl">{s.title}</span>
                        {streaming&&i===0&&<span className="pms-cur"/>}
                        <span className={`pms-card-chev ${collapsed[i]?"":"open"}`}>▼</span>
                      </div>
                      {!collapsed[i]&&(
                        <div className="pms-card-body" dangerouslySetInnerHTML={{__html:fmtOut(s.content)}}/>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT — PM LENS */}
            <div className="pms-right">
              <div className="pms-lens-title">PM Lens</div>

              <div>
                <div className="pms-lens-sec-lbl">Frameworks to Apply</div>
                {lens.fw.map((f,i)=><div className="pms-fw-pill" key={i}>{f}</div>)}
              </div>

              <div>
                <div className="pms-lens-sec-lbl">Sharp Questions</div>
                {lens.q.map((q,i)=>(
                  <div className="pms-q-row" key={i}>
                    <div className="pms-q-dot" style={{background:i===0?"#F0A500":i===1?"#E85D26":"#52C97A"}}/>
                    <span>{q}</span>
                  </div>
                ))}
              </div>

              {running&&(
                <div>
                  <div className="pms-lens-sec-lbl">Generating</div>
                  <div className="pms-lens-gen">Applying {lens.fw[0]||"PM frameworks"}...<span className="pms-cur"/></div>
                </div>
              )}

              {suggested.length>0&&!secs&&!running&&(
                <div>
                  <div className="pms-sug-lbl">Also Relevant</div>
                  {suggested.map(s=>(
                    <div className="pms-sug-item" key={s.id} onClick={()=>setMode(s.id)}>
                      <span className="pms-sug-icon">{s.icon}</span>
                      <span className="pms-sug-lbl-text">{s.label}</span>
                      <span className="pms-sug-arrow">→</span>
                    </div>
                  ))}
                </div>
              )}

              {!running&&!secs&&suggested.length===0&&(
                <div className="pms-lens-empty">Fill in the form — the lens will surface relevant frameworks and questions as you work.</div>
              )}
            </div>

          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <div className="pms-mob-nav">
          <div className="pms-mob-inner">
            {MODES.map(m=>(
              <button key={m.id} className={`pms-mob-btn ${mode===m.id?"on":""}`} onClick={()=>setMode(m.id)}>
                <span className="pms-mob-icon">{m.icon}</span>
                <span className="pms-mob-lbl">{m.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
