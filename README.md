# Janardhan Labs v2

14 production-grade AI utility apps. BYOK (Bring Your Own Key) — no server, no auth, no token quotas. Built by Sriharsha.

## Apps

| App | Description | Route |
|-----|-------------|-------|
| VisualMind | Turn notes into visual understanding | /visualmind |
| FeedbackTranslator | Decode what feedback actually means | /feedback-translator |
| DebateCoach | Master both sides of any argument | /debate-coach |
| GiftIntelligence | The perfect gift for every person | /gift-intelligence |
| ExamSimulator | Test yourself before the test tests you | /exam-simulator |
| ClaimLens | Verify any claim with evidence | /claim-lens |
| Aperture | See research papers through 6 lenses | /aperture |
| StyleMirror | Extract your voice. Rewrite anything in it. | /style-mirror |
| SprintMind | PRD + JIRA hierarchy from one sentence | /sprint-mind |
| ContractScan | Know what you're signing before you sign it | /contract-scan |
| SkinStack | Your skin, your stack, no guesswork | /skinstack |
| StoryBibleBuilder | Five sacred steps. One complete world. | /story-bible |
| PM Studio | 17 tools for every PM workflow | /pm-studio |
| SignalPost | LinkedIn Content OS | /signal-post |

## Architecture

- **Framework**: React 18 + Vite
- **AI**: Google Gemini 2.0 Flash (direct browser → API, no proxy)
- **Auth**: None — BYOK via `localStorage`
- **Persistence**: `localStorage` for results and session data
- **Deployment**: Vercel (static, no serverless functions)

## BYOK Model

Users bring their own Gemini API key. Key is stored in `localStorage` under `jl-gemini-key` and shared across all 14 apps. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Local Development

```bash
npm install
npm run dev
```

## Deploy

Push to GitHub. Connect to Vercel. Select Vite preset. No environment variables needed.

## Structure

```
src/
  shared/
    lib/
      gemini-client.js   # Direct Gemini calls, key management
      storage.js         # localStorage persistence utility
      themes.js          # Per-app visual themes
    components/
      KeyGate.jsx        # Themed per-app key setup
      QualityGate.jsx    # Pre-call input quality scorer
  apps/
    [14 app directories]
  Home.jsx               # Portal
  main.jsx               # Router + error boundary
```
