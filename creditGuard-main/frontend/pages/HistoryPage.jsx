import React, { useEffect, useState } from "react";
import { API_URL, fetchWithTimeout, riskClass, downloadCsv } from "../utils";

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [riskFilter, setRiskFilter] = useState([]);
  const [resultFilter, setResultFilter] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/fraud/history`, {}, 5000);
      if (!res.ok) {
        setErrorMsg(`Unable to load history: ${await res.text()}`);
      } else {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      setErrorMsg("🔴 Could not connect to the Fraud Detection API.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  if (loading) {
    return (
      <div>
        <h2 className="fg-section-title">📜 Transaction History</h2>
        <p className="small">Loading transaction history…</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div>
        <h2 className="fg-section-title">📜 Transaction History</h2>
        <div className="fg-info error">{errorMsg}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div>
        <h2 className="fg-section-title">📜 Transaction History</h2>
        <div className="fg-info neutral">📭 No transactions have been analyzed yet.</div>
      </div>
    );
  }

  const total = transactions.length;
  const fraudCount = transactions.filter((t) => t.prediction === 1).length;
  const legitCount = total - fraudCount;
  const fraudRate = total > 0 ? (fraudCount / total) * 100 : 0;

  const riskOptions = [...new Set(transactions.map((t) => t.risk_level).filter(Boolean))].sort();
  const resultOptions = [...new Set(transactions.map((t) => t.result).filter(Boolean))].sort();

  let filtered = transactions;
  if (riskFilter.length) filtered = filtered.filter((t) => riskFilter.includes(t.risk_level));
  if (resultFilter.length) filtered = filtered.filter((t) => resultFilter.includes(t.result));

  const highRisk = filtered.filter((t) => ["high", "critical"].includes(riskClass(t.risk_level)));

  return (
    <div>
      <h2 className="fg-section-title">📜 Transaction History</h2>
      <p className="small" style={{ marginBottom: 18 }}>
        View previously analyzed transactions stored by the fraud detection
        system.
      </p>

      <h3 className="fg-section-title" style={{ marginTop: 0 }}>
        📊 History Summary
      </h3>
      <div className="fg-grid cols-4">
        <div className="fg-metric">
          <div className="label">Total Transactions</div>
          <div className="value">{total.toLocaleString()}</div>
        </div>
        <div className="fg-metric">
          <div className="label">🚨 Fraud</div>
          <div className="value" style={{ color: "var(--red)" }}>
            {fraudCount.toLocaleString()}
          </div>
        </div>
        <div className="fg-metric">
          <div className="label">✅ Legitimate</div>
          <div className="value" style={{ color: "var(--green)" }}>
            {legitCount.toLocaleString()}
          </div>
        </div>
        <div className="fg-metric">
          <div className="label">Fraud Rate</div>
          <div className="value">{fraudRate.toFixed(2)}%</div>
        </div>
      </div>

      <hr className="fg-divider" />

      <h3 className="fg-section-title" style={{ marginTop: 0 }}>
        🔎 Filter Transactions
      </h3>
      <div className="fg-grid cols-2">
        <div>
          <label className="small" style={{ display: "block", marginBottom: 8 }}>
            Risk Level
          </label>
          <div className="fg-chip-row">
            {riskOptions.map((r) => (
              <button
                key={r}
                className={`fg-chip ${riskFilter.includes(r) ? "selected" : ""}`}
                onClick={() => toggle(riskFilter, setRiskFilter, r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="small" style={{ display: "block", marginBottom: 8 }}>
            Prediction
          </label>
          <div className="fg-chip-row">
            {resultOptions.map((r) => (
              <button
                key={r}
                className={`fg-chip ${resultFilter.includes(r) ? "selected" : ""}`}
                onClick={() => toggle(resultFilter, setResultFilter, r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="small" style={{ marginTop: 14 }}>
        Showing <strong>{filtered.length}</strong> of <strong>{total}</strong>{" "}
        transactions.
      </p>

      <div className="fg-table-wrap" style={{ marginTop: 10 }}>
        <table className="fg-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Amount</th>
              <th>Prediction</th>
              <th>Fraud Probability</th>
              <th>Risk Level</th>
              <th>Result</th>
              <th>Analyzed At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.time}</td>
                <td>{t.amount}</td>
                <td>{t.prediction}</td>
                <td>{t.fraud_probability}</td>
                <td>
                  <span className={`fg-badge ${riskClass(t.risk_level)}`}>{t.risk_level}</span>
                </td>
                <td>{t.result}</td>
                <td>{t.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {highRisk.length > 0 && (
        <>
          <h3 className="fg-section-title">🚨 High-Risk Activity</h3>
          <div className="fg-info warn" style={{ marginBottom: 12 }}>
            {highRisk.length} high-risk transaction(s) found.
          </div>
          <div className="fg-table-wrap">
            <table className="fg-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Fraud Probability</th>
                  <th>Risk Level</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {highRisk.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.time}</td>
                    <td>{t.amount}</td>
                    <td>{t.fraud_probability}</td>
                    <td>
                      <span className={`fg-badge ${riskClass(t.risk_level)}`}>{t.risk_level}</span>
                    </td>
                    <td>{t.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="fg-section-title">💾 Export History</h3>
      <button className="fg-btn block" onClick={() => downloadCsv("transaction_history.csv", filtered)}>
        ⬇️ Download Transaction History
      </button>
    </div>
  );
}
