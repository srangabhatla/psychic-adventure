import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// ── Lazy load all apps ────────────────────────────────────────────────────
const Home               = lazy(() => import("./Home"));
const VisualMind         = lazy(() => import("./apps/visualmind/App"));
const FeedbackTranslator = lazy(() => import("./apps/feedback-translator/App"));
const DebateCoach        = lazy(() => import("./apps/debate-coach/App"));
const GiftIntelligence   = lazy(() => import("./apps/gift-intelligence/App"));
const ExamSimulator      = lazy(() => import("./apps/exam-simulator/App"));
const ClaimLens          = lazy(() => import("./apps/claim-lens/App"));
const Aperture           = lazy(() => import("./apps/aperture/App"));
const StyleMirror        = lazy(() => import("./apps/style-mirror/App"));
const SprintMind         = lazy(() => import("./apps/sprint-mind/App"));
const ContractScan       = lazy(() => import("./apps/contract-scan/App"));
const SkinStack          = lazy(() => import("./apps/skinstack/App"));
const StoryBible         = lazy(() => import("./apps/story-bible/App"));
const PMStudio           = lazy(() => import("./apps/pm-studio/App"));
const SignalPost         = lazy(() => import("./apps/signal-post/App"));

// ── Page loader ───────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0A0A0A",
      fontFamily: "monospace", fontSize: "0.7rem",
      letterSpacing: "0.2em", textTransform: "uppercase", color: "#F5A623",
    }}>
      Loading…
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "2rem",
          background: "#0A0A0A", fontFamily: "sans-serif",
          textAlign: "center", gap: "1rem",
        }}>
          <div style={{ fontSize: "2.5rem" }}>⚠️</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#F0EDE8" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: "0.85rem", color: "#A09890", maxWidth: "400px", lineHeight: "1.6" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
            style={{
              marginTop: "0.5rem", padding: "0.65rem 1.5rem",
              background: "#F5A623", color: "#000",
              border: "none", borderRadius: "6px",
              cursor: "pointer", fontSize: "0.85rem", fontWeight: "700",
            }}
          >
            ← Back to home
          </button>
          <div style={{ fontSize: "0.6rem", color: "#5A5550", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Janardhan Labs
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 404 ───────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "2rem",
      background: "#0A0A0A", fontFamily: "sans-serif",
      textAlign: "center", gap: "1rem",
    }}>
      <div style={{ fontSize: "3rem" }}>🔍</div>
      <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#F0EDE8" }}>Page not found</div>
      <div style={{ fontSize: "0.85rem", color: "#A09890" }}>That route doesn't exist in Janardhan Labs.</div>
      <a href="/" style={{
        marginTop: "0.5rem", padding: "0.65rem 1.5rem",
        background: "#F5A623", color: "#000",
        borderRadius: "6px", textDecoration: "none",
        fontSize: "0.85rem", fontWeight: "700",
      }}>← View all apps</a>
    </div>
  );
}

// ── Route map ─────────────────────────────────────────────────────────────
const ROUTES = {
  "/":                    <Home />,
  "/visualmind":          <VisualMind />,
  "/feedback-translator": <FeedbackTranslator />,
  "/debate-coach":        <DebateCoach />,
  "/gift-intelligence":   <GiftIntelligence />,
  "/exam-simulator":      <ExamSimulator />,
  "/claim-lens":          <ClaimLens />,
  "/aperture":            <Aperture />,
  "/style-mirror":        <StyleMirror />,
  "/sprint-mind":         <SprintMind />,
  "/contract-scan":       <ContractScan />,
  "/skinstack":           <SkinStack />,
  "/story-bible":         <StoryBible />,
  "/pm-studio":           <PMStudio />,
  "/signal-post":         <SignalPost />,
};

// ── Router ────────────────────────────────────────────────────────────────
function Router() {
  const [path, setPath] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const component = ROUTES[path];

  return (
    <ErrorBoundary key={path}>
      <Suspense fallback={<PageLoader />}>
        {component !== undefined ? component : <NotFound />}
      </Suspense>
    </ErrorBoundary>
  );
}

// ── Navigate helper (used by Home + apps) ─────────────────────────────────
export function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
