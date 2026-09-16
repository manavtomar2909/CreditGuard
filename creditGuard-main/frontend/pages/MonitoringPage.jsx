import React, { useEffect, useState } from "react";
import { API_URL, fetchWithTimeout } from "../utils";

export default function MonitoringPage({ monitor, apiOnline, onRefreshHealth, onReset }) {
  const [healthMs, setHealthMs] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    measureHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function measureHealth() {
    setChecking(true);
    const started = performance.now();
    try {
      const res = await fetchWithTimeout(`${API_URL}/fraud/health`, {}, 3000);
      setHealthMs(res.ok ? performance.now() - started : null);
    } catch {
      setHealthMs(null);
    } finally {
      setChecking(false);
      onRefreshHealth();
    }
  }

  const total = monitor.total;
  const fraud = monitor.fraud;
  const errors = monitor.errors;
  const avgMs = monitor.times.length
    ? monitor.times.reduce((a, b) => a + b, 0) / monitor.times.length
    : null;
  const fraudRate = total > 0 ? (fraud / total) * 100 : 0;

  return (
    <div>
      <h2 className="fg-section-title">📈 System Monitoring</h2>
      <p className="small" style={{ marginBottom: 18 }}>
        Operational view of the fraud-detection application during the
        current session.
      </p>

      <div className="fg-grid cols-4">
        <div className="fg-metric">
          <div className="label">API Status</div>
          <div className="value" style={{ fontSize: 18 }}>
            {apiOnline ? "🟢 ONLINE" : "🔴 OFFLINE"}
          </div>
        </div>
        <div className="fg-metric">
          <div className="label">Transactions</div>
          <div className="value">{total.toLocaleString()}</div>
        </div>
        <div className="fg-metric">
          <div className="label">Fraud Alerts</div>
          <div className="value" style={{ color: "var(--red)" }}>
            {fraud.toLocaleString()}
          </div>
        </div>
        <div className="fg-metric">
          <div className="label">Errors</div>
          <div className="value" style={{ color: errors > 0 ? "var(--amber)" : undefined }}>
            {errors.toLocaleString()}
          </div>
        </div>
      </div>

      <h3 className="fg-section-title">⚡ Performance</h3>
      <div className="fg-grid cols-2">
        <div className="fg-metric">
          <div className="label">Average Prediction Response</div>
          <div className="value" style={{ fontSize: avgMs === null ? 16 : undefined }}>
            {avgMs === null ? "No data yet" : `${avgMs.toFixed(2)} ms`}
          </div>
        </div>
        <div className="fg-metric">
          <div className="label">Current Health Check</div>
          <div className="value" style={{ fontSize: checking || healthMs === null ? 16 : undefined }}>
            {checking ? "Checking…" : healthMs === null ? "Unavailable" : `${healthMs.toFixed(2)} ms`}
          </div>
        </div>
      </div>
      <button className="fg-btn" style={{ marginTop: 12 }} onClick={measureHealth}>
        🔄 Refresh Health Check
      </button>

      <div className="fg-info neutral" style={{ marginTop: 16 }}>
        Response time is measured end-to-end by the browser for completed
        prediction requests (single transactions and per-transaction average
        for batch runs) — it is not pure XGBoost inference time.
      </div>

      <h3 className="fg-section-title">🚨 Fraud Activity</h3>
      {total > 0 ? (
        <>
          <div className="fg-metric" style={{ marginBottom: 10 }}>
            <div className="label">Detected Fraud Rate</div>
            <div className="value">{fraudRate.toFixed(2)}%</div>
          </div>
          <div className="fg-progress-track">
            <div
              className="fg-progress-fill"
              style={{ width: `${Math.min(fraudRate, 100)}%`, background: "var(--red)" }}
            />
          </div>
        </>
      ) : (
        <div className="fg-info neutral">
          No transactions have been analyzed in this session yet. Run a
          transaction from Check Transaction to populate monitoring.
        </div>
      )}

      <hr className="fg-divider" />

      <h3 className="fg-section-title" style={{ marginTop: 0 }}>
        🧾 Recent Prediction Activity
      </h3>
      {monitor.history.length > 0 ? (
        <div className="fg-table-wrap">
          <table className="fg-table">
            <thead>
              <tr>
                {Object.keys(monitor.history[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitor.history.map((row, i) => (
                <tr key={i}>
                  {Object.keys(monitor.history[0]).map((k) => (
                    <td key={k}>{String(row[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="fg-info neutral">No prediction activity recorded yet.</div>
      )}

      <hr className="fg-divider" />

      <button className="fg-btn block" onClick={onReset}>
        🗑️ Reset Session Monitoring
      </button>
    </div>
  );
}
