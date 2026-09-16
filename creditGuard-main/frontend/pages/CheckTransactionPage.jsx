import React, { useState } from "react";
import {
  API_URL,
  PCA_FEATURES,
  DEMO_TRANSACTION,
  emptyTransaction,
  fetchWithTimeout,
} from "../utils";

export default function CheckTransactionPage({ form, setForm, onResult, onError }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function loadDemo() {
    setForm(DEMO_TRANSACTION);
    setResult(null);
    setErrorMsg(null);
  }

  function resetForm() {
    setForm(emptyTransaction({ Time: 0, Amount: 100 }));
    setResult(null);
    setErrorMsg(null);
  }

  async function analyze() {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    const payload = { ...form };
    const started = performance.now();
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/fraud/predict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        10000
      );
      const elapsedMs = performance.now() - started;

      if (!res.ok) {
        const text = await res.text();
        setErrorMsg(`API Error ${res.status}: ${text}`);
        onError();
      } else {
        const data = await res.json();
        setResult(data);
        onResult(data, elapsedMs, form.Amount);
      }
    } catch (e) {
      setErrorMsg(`Could not connect to FastAPI: ${e.message}`);
      onError();
    } finally {
      setLoading(false);
    }
  }

  const probability = result ? Number(result.fraud_probability) : 0;
  const percent = result ? Number(result.fraud_probability_percent) : 0;

  return (
    <div>
      <h2 className="fg-section-title">🔍 Check a Transaction</h2>
      <p className="small" style={{ marginBottom: 18 }}>
        Enter the transaction values used by the trained model. The technical
        PCA features are hidden under Advanced Features.
      </p>

      <div className="fg-grid cols-3" style={{ marginBottom: 20 }}>
        <button className="fg-btn block" onClick={loadDemo}>
          🧪 Load Demo Transaction
        </button>
        <button className="fg-btn block" onClick={resetForm}>
          🔄 Reset
        </button>
        <div className="fg-metric">
          <div className="label">Model</div>
          <div className="value" style={{ fontSize: 18 }}>
            XGBoost
          </div>
        </div>
      </div>

      <h3 className="fg-section-title" style={{ marginTop: 0 }}>
        💳 Basic Transaction Information
      </h3>

      <div className="fg-grid cols-2">
        <div className="fg-field">
          <label>Transaction Time</label>
          <input
            type="number"
            step="0.000001"
            value={form.Time}
            onChange={(e) => updateField("Time", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="fg-field">
          <label>Transaction Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.Amount}
            onChange={(e) =>
              updateField("Amount", Math.max(0, parseFloat(e.target.value) || 0))
            }
          />
        </div>
      </div>

      <details className="fg-expander">
        <summary>🧠 Advanced PCA Features (V1–V28)</summary>
        <div className="fg-expander-body">
          <div className="fg-info neutral" style={{ marginBottom: 14 }}>
            These are anonymized PCA components. They are required by the
            current model but are not human-readable transaction attributes.
          </div>
          <div className="fg-pca-grid">
            {PCA_FEATURES.map((key) => (
              <div className="fg-field" key={key}>
                <label>{key}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form[key]}
                  onChange={(e) =>
                    updateField(key, parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </details>

      <button
        className="fg-btn primary block"
        style={{ marginTop: 20 }}
        onClick={analyze}
        disabled={loading}
      >
        {loading ? "Analyzing…" : "🔍 Analyze Transaction"}
      </button>

      {errorMsg && (
        <div className="fg-info error" style={{ marginTop: 18 }}>
          {errorMsg}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 26 }}>
          <hr className="fg-divider" />
          <h2 className="fg-section-title" style={{ marginTop: 0 }}>
            🛡️ Risk Assessment
          </h2>

          {result.prediction === 1 ? (
            <div className="fg-result fraud">
              <h1>🚨 Potential Fraud Detected</h1>
              <h3>Risk Level: {result.risk_level}</h3>
            </div>
          ) : (
            <div className="fg-result safe">
              <h1>✅ Transaction Appears Safe</h1>
              <h3>Risk Level: {result.risk_level}</h3>
            </div>
          )}

          <div
            className={`fg-info ${result.prediction === 1 ? "warn" : "success"}`}
            style={{ marginTop: 14 }}
          >
            {result.prediction === 1
              ? "The model considers this transaction potentially fraudulent. A real-world system could send it for additional verification."
              : "The model currently considers this transaction low risk."}
          </div>

          <div className="fg-grid cols-3" style={{ marginTop: 18 }}>
            <div className="fg-metric">
              <div className="label">Decision</div>
              <div className="value" style={{ fontSize: 18 }}>
                {result.result}
              </div>
            </div>
            <div className="fg-metric">
              <div className="label">Fraud Probability</div>
              <div className="value">{percent.toFixed(2)}%</div>
            </div>
            <div className="fg-metric">
              <div className="label">Risk Level</div>
              <div className="value" style={{ fontSize: 18 }}>
                {result.risk_level}
              </div>
            </div>
          </div>

          <h3 className="fg-section-title">📊 Fraud Risk Score</h3>
          <div className="fg-progress-track">
            <div
              className="fg-progress-fill"
              style={{
                width: `${Math.min(Math.max(probability, 0), 1) * 100}%`,
                background: result.prediction === 1 ? "var(--red)" : "var(--green)",
              }}
            />
          </div>
          <p className="fg-footer-note">
            Model probability: {percent.toFixed(4)}% | Decision threshold:{" "}
            {result.threshold ?? 0.5}
          </p>
        </div>
      )}
    </div>
  );
}
