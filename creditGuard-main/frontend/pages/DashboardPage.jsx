import React from "react";

export default function DashboardPage() {
  return (
    <div>
      <h2 className="fg-section-title">Welcome to Credit Guard</h2>
      <p className="small" style={{ marginBottom: 20 }}>
        Use the application to check individual transactions, analyze
        multiple transactions, or inspect the ML model.
      </p>

      <div className="fg-grid cols-3">
        <div className="fg-card">
          <div className="fg-icon">🔍</div>
          <h3>Single Transaction</h3>
          <p className="small">
            Analyze one transaction and receive a fraud probability.
          </p>
        </div>
        <div className="fg-card">
          <div className="fg-icon">📂</div>
          <h3>Batch Analysis</h3>
          <p className="small">
            Upload a CSV and analyze multiple transactions.
          </p>
        </div>
        <div className="fg-card">
          <div className="fg-icon">🤖</div>
          <h3>ML Model</h3>
          <p className="small">
            View model features, threshold and technical details.
          </p>
        </div>
      </div>

      <hr className="fg-divider" />

      <h3 className="fg-section-title">🔄 How a transaction is analyzed</h3>
      <div className="fg-info neutral">
        Transaction → Input validation → Scaling → XGBoost → Fraud
        probability → Risk assessment
      </div>

      <h3 className="fg-section-title">🧠 About V1–V28</h3>
      <p className="small">
        V1–V28 are anonymized PCA-derived features from the supplied
        credit-card dataset. They are mathematical components rather than
        human-readable fields such as merchant or location.
      </p>
    </div>
  );
}
