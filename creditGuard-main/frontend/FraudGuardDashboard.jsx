import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import "./fraud-guard.css";
import { API_URL, FEATURES, emptyTransaction, fetchWithTimeout } from "./utils";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CheckTransactionPage = lazy(() => import("./pages/CheckTransactionPage"));
const BatchAnalysisPage = lazy(() => import("./pages/BatchAnalysisPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"));
const ModelPage = lazy(() => import("./pages/ModelPage"));

// Route table replaces the old `page === "..."` conditional-render switch.
// Each entry drives both the nav link and the <Route> below, so adding a
// page only ever means editing this one array.
const NAV_ITEMS = [
  { path: "/", label: "🏠 Dashboard", end: true },
  { path: "/check", label: "🔍 Check Transaction" },
  { path: "/batch", label: "📂 Batch Analysis" },
  { path: "/history", label: "📜 Transaction History" },
  { path: "/monitoring", label: "📈 Monitoring" },
  { path: "/model", label: "🤖 Model" },
];

export default function FraudGuardDashboard() {
  const [apiOnline, setApiOnline] = useState(null); // null = checking

  // Session-wide monitoring counters (mirrors st.session_state.monitor_*)
  const [monitor, setMonitor] = useState({
    total: 0,
    fraud: 0,
    errors: 0,
    times: [], // per-transaction response times in ms (single + normalized batch)
    history: [], // recent activity rows shown on the Monitoring page
  });

  // Persisted across route changes, like st.session_state.single. Lives
  // here (above the <Routes>) rather than inside CheckTransactionPage so a
  // detour to another page and back doesn't lose the in-progress form.
  const [singleForm, setSingleForm] = useState(emptyTransaction());

  // Persisted batch results, like st.session_state.batch
  const [batchState, setBatchState] = useState(null);

  const checkHealth = async () => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/fraud/health`, {}, 3000);
      setApiOnline(res.ok);
    } catch {
      setApiOnline(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 15000);
    return () => clearInterval(id);
  }, []);

  function logActivity(entry) {
    setMonitor((m) => ({ ...m, history: [entry, ...m.history].slice(0, 50) }));
  }

  function recordSingleResult(result, elapsedMs, amount) {
    setMonitor((m) => ({
      ...m,
      total: m.total + 1,
      fraud: m.fraud + (result.prediction === 1 ? 1 : 0),
      times: [...m.times, elapsedMs],
    }));
    logActivity({
      Type: "Single",
      Amount: amount,
      Decision: result.result,
      "Fraud Probability (%)": Number(result.fraud_probability_percent).toFixed(2),
      Risk: result.risk_level,
      "Response (ms)": Math.round(elapsedMs * 100) / 100,
    });
  }

  function recordSingleError() {
    setMonitor((m) => ({ ...m, errors: m.errors + 1 }));
  }

  // Bug fix: in the original Streamlit app, batch runs updated the total/fraud
  // counters but never recorded a response time or an activity-log row. That
  // silently skewed "Average Prediction Response" on the Monitoring page (it
  // only ever reflected single-transaction latency even though the
  // transaction counter included bulk runs) and left batch jobs with no
  // audit trail. Both are fixed here: batch latency is normalized per
  // transaction before being folded into the same average, and a summary
  // row is logged to Recent Activity.
  function recordBatchResult(results, elapsedMs, fraudCount, errored) {
    if (errored) {
      setMonitor((m) => ({ ...m, errors: m.errors + 1 }));
      return;
    }
    const perTxnMs = results.length ? elapsedMs / results.length : elapsedMs;
    setMonitor((m) => ({
      ...m,
      total: m.total + results.length,
      fraud: m.fraud + fraudCount,
      times: [...m.times, perTxnMs],
    }));
    logActivity({
      Type: "Batch",
      Amount: `${results.length} txns`,
      Decision: `${fraudCount} flagged`,
      "Fraud Probability (%)": "—",
      Risk: "—",
      "Response (ms)": Math.round(elapsedMs * 100) / 100,
    });
  }

  function resetMonitoring() {
    setMonitor({ total: 0, fraud: 0, errors: 0, times: [], history: [] });
  }

  return (
    <div className="fg-root">
      <Hero apiOnline={apiOnline} />

      <nav className="fg-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {apiOnline === false ? (
        <div className="fg-card">
          <div className="fg-info error" style={{ marginBottom: 0 }}>
            🔴 Fraud Detection API is offline. Start it with:{" "}
            <code>uvicorn app:app --reload</code>
          </div>
          <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
            The dashboard can't reach the API at <code>{API_URL}</code>. Every
            page below depends on it, so start the backend — this banner will
            clear automatically once it's reachable.
          </p>
        </div>
      ) : (
        <Suspense fallback={<div className="fg-card">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/check"
              element={
                <CheckTransactionPage
                  form={singleForm}
                  setForm={setSingleForm}
                  onResult={recordSingleResult}
                  onError={recordSingleError}
                />
              }
            />
            <Route
              path="/batch"
              element={
                <BatchAnalysisPage
                  batchState={batchState}
                  setBatchState={setBatchState}
                  onBatchResult={recordBatchResult}
                />
              }
            />
            <Route path="/history" element={<HistoryPage />} />
            <Route
              path="/monitoring"
              element={
                <MonitoringPage
                  monitor={monitor}
                  apiOnline={apiOnline}
                  onRefreshHealth={checkHealth}
                  onReset={resetMonitoring}
                />
              }
            />
            <Route path="/model" element={<ModelPage />} />
            {/* Unknown sub-paths fall back to the dashboard instead of a blank page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </div>
  );
}

// function Hero({ apiOnline }) {
//   const scanLine = useMemo(() => Array.from({ length: 6 }, () => FEATURES.join("  ")).join("   "), []);
//   return (
//     <div className="fg-hero">
//       <div className="fg-hero-scan">
//         {Array.from({ length: 8 }).map((_, i) => (
//           <div key={i}>{scanLine}</div>
//         ))}
//       </div>
//       <div className="fg-hero-top">
//         <div>
//           <h1>💳 Credit Guard</h1>
//           <p>AI-powered credit card fraud detection using PCA features and XGBoost.</p>
//         </div>
//         <div className={`fg-status ${apiOnline ? "online" : "offline"}`}>
//           <span className="fg-dot" />
//           {apiOnline === null ? "CHECKING…" : apiOnline ? "SYSTEM ONLINE" : "SYSTEM OFFLINE"}
//         </div>
//       </div>
//     </div>
//   );
// }

function Hero({ apiOnline }) {
  return (
    <div
      className="fg-hero"
      style={{
        position: "relative",
        minHeight: 260,
        padding: "38px 48px",
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(80, 220, 210, 0.18)",
        background:
          "radial-gradient(circle at 15% 50%, rgba(0, 220, 210, 0.10), transparent 28%), radial-gradient(circle at 75% 45%, rgba(0, 220, 210, 0.08), transparent 30%), linear-gradient(135deg, #071217 0%, #09161d 50%, #071014 100%)",
        boxShadow:
          "0 20px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          left: -170,
          top: -120,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(37, 220, 210, 0.13), transparent 68%)",
          pointerEvents: "none",
        }}
      />

      {/* Background security grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.14,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(50, 220, 210, 0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(50, 220, 210, 0.10) 1px, transparent 1px)
          `,
          backgroundSize: "42px 42px",
          maskImage:
            "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
        }}
      />

      {/* Decorative scanning line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 28,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(55, 230, 215, 0.5), transparent)",
          boxShadow: "0 0 20px rgba(55, 230, 215, 0.35)",
          pointerEvents: "none",
        }}
      />

      {/* Left decorative credit card */}
      <div
        style={{
          position: "absolute",
          left: 42,
          top: "50%",
          transform: "translateY(-50%) rotate(-8deg)",
          width: 185,
          height: 115,
          borderRadius: 18,
          border: "1px solid rgba(65, 230, 215, 0.45)",
          background:
            "linear-gradient(145deg, rgba(25, 211, 200, 0.25), rgba(8, 25, 32, 0.92))",
          boxShadow:
            "0 0 35px rgba(30, 220, 210, 0.16), inset 0 0 30px rgba(30, 220, 210, 0.06)",
          zIndex: 2,
        }}
      >
        {/* Card chip */}
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 34,
            width: 34,
            height: 26,
            borderRadius: 6,
            border: "1px solid rgba(255, 255, 255, 0.35)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(100,220,210,0.25))",
          }}
        />

        {/* Card number */}
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: 28,
            fontSize: 10,
            letterSpacing: 2,
            color: "rgba(220, 255, 252, 0.75)",
          }}
        >
          1234 5678 9012 3456
        </div>

        <div
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            fontSize: 19,
          }}
        >
          📡
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          marginLeft: 285,
          maxWidth: 650,
        }}
      >
        <h1
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: "clamp(34px, 4vw, 54px)",
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-1.5px",
            color: "#f5fbff",
            textShadow: "0 0 25px rgba(255,255,255,0.08)",
          }}
        >
          <span
            style={{
              fontSize: "0.72em",
              filter: "drop-shadow(0 0 8px rgba(60,220,210,0.4))",
            }}
          >
            💳
          </span>
          Credit Guard
        </h1>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: 18,
            lineHeight: 1.6,
            color: "#9eb2c4",
            maxWidth: 610,
          }}
        >
          AI-powered credit card fraud detection
          <br />
          using PCA features and XGBoost.
        </p>

        {/* Security indicators */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 22,
          }}
        >
          <span
            style={{
              padding: "7px 13px",
              borderRadius: 999,
              border: "1px solid rgba(55, 220, 205, 0.22)",
              background: "rgba(55, 220, 205, 0.06)",
              color: "#70ddd3",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🛡️ AI FRAUD PROTECTION
          </span>

          <span
            style={{
              padding: "7px 13px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.025)",
              color: "#8295a7",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚡ REAL-TIME ANALYSIS
          </span>
        </div>
      </div>

      {/* Right security shield */}
      <div
        style={{
          position: "absolute",
          right: 220,
          top: "50%",
          transform: "translateY(-50%)",
          width: 170,
          height: 170,
          borderRadius: "50%",
          border: "1px solid rgba(45, 220, 210, 0.18)",
          boxShadow:
            "0 0 50px rgba(35, 220, 210, 0.08), inset 0 0 40px rgba(35, 220, 210, 0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "1px solid rgba(45, 220, 210, 0.22)",
          }}
        />

        <div
          style={{
            width: 92,
            height: 108,
            clipPath:
              "polygon(50% 0%, 90% 15%, 90% 55%, 78% 78%, 50% 100%, 22% 78%, 10% 55%, 10% 15%)",
            background:
              "linear-gradient(145deg, rgba(50, 235, 220, 0.35), rgba(10, 50, 58, 0.85))",
            border: "1px solid rgba(70, 240, 225, 0.5)",
            boxShadow: "0 0 35px rgba(45, 230, 215, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
          }}
        >
          🔒
        </div>
      </div>

      {/* Online status */}
      <div
        className={`fg-status ${apiOnline ? "online" : "offline"}`}
        style={{
          position: "absolute",
          right: 34,
          top: 34,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 17px",
          borderRadius: 999,
          border:
            "1px solid rgba(45, 220, 205, 0.28)",
          background:
            apiOnline
              ? "rgba(15, 80, 72, 0.25)"
              : "rgba(120, 35, 35, 0.22)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: apiOnline ? "#42e0c5" : "#ff7777",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.7,
        }}
      >
        <span
          className="fg-dot"
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: apiOnline ? "#35e0bb" : "#ff6262",
            boxShadow: apiOnline
              ? "0 0 12px rgba(53,224,187,0.9)"
              : "0 0 12px rgba(255,98,98,0.8)",
          }}
        />

        {apiOnline === null
          ? "CHECKING…"
          : apiOnline
          ? "SYSTEM ONLINE"
          : "SYSTEM OFFLINE"}
      </div>
    </div>
  );
}
