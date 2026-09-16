import React, { useEffect, useState } from "react";
import { API_URL, fetchWithTimeout } from "../utils";

export default function ModelPage() {
  const [info, setInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithTimeout(`${API_URL}/fraud/model-info`, {}, 5000);
        if (res.ok) {
          setInfo(await res.json());
        } else {
          setErrorMsg(await res.text());
        }
      } catch (e) {
        setErrorMsg(`Unable to load model information: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h2 className="fg-section-title">🤖 Model Information</h2>

      {loading && <p className="small">Loading model information…</p>}
      {errorMsg && <div className="fg-info error">{errorMsg}</div>}

      {info && (
        <>
          <div className="fg-grid cols-3">
            <div className="fg-metric">
              <div className="label">Model</div>
              <div className="value" style={{ fontSize: 18 }}>
                {info.model}
              </div>
            </div>
            <div className="fg-metric">
              <div className="label">Input Features</div>
              <div className="value">{info.number_of_features}</div>
            </div>
            <div className="fg-metric">
              <div className="label">Threshold</div>
              <div className="value">{info.threshold}</div>
            </div>
          </div>

          <hr className="fg-divider" />

          <h3 className="fg-section-title" style={{ marginTop: 0 }}>
            🧠 Features Used by the Model
          </h3>
          <div className="fg-table-wrap">
            <table className="fg-table">
              <thead>
                <tr>
                  <th>Feature</th>
                </tr>
              </thead>
              <tbody>
                {info.features.map((f) => (
                  <tr key={f}>
                    <td>{f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="fg-section-title">ℹ️ What are V1–V28?</h3>
          <p className="small">
            V1–V28 are anonymized Principal Component Analysis (PCA) features
            supplied by the credit-card fraud dataset. They represent
            transformed statistical patterns in the original transaction
            data.
          </p>

          <h3 className="fg-section-title">🔄 Prediction Pipeline</h3>
          <div className="fg-pipeline">
            Transaction
            <br />
            &nbsp;&nbsp;↓
            <br />
            Input validation
            <br />
            &nbsp;&nbsp;↓
            <br />
            Feature scaling
            <br />
            &nbsp;&nbsp;↓
            <br />
            XGBoost classifier
            <br />
            &nbsp;&nbsp;↓
            <br />
            Fraud probability
            <br />
            &nbsp;&nbsp;↓
            <br />
            Threshold-based decision
            <br />
            &nbsp;&nbsp;↓
            <br />
            Risk assessment
          </div>
        </>
      )}
    </div>
  );
}
