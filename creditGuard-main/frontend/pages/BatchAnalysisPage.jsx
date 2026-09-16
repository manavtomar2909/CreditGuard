import React, { useRef, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  API_URL,
  FEATURES,
  fetchWithTimeout,
  riskClass,
  downloadCsv,
  sampleN,
  shuffle,
  computeMetrics,
  parseAndValidateCsv,
} from "../utils";

const MAX_BATCH = 500;
const MAX_CSV_BYTES = 10 * 1024 * 1024;

export default function BatchAnalysisPage({
  batchState,
  setBatchState,
  onBatchResult,
}) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [dataset, setDataset] = useState(null); // { rows, hasClass, invalidCount }
  const [parseError, setParseError] = useState(null); // array of missing columns
  const [mode, setMode] = useState("Random Sample");
  const [sampleSize, setSampleSize] = useState(20);
  const [balancedEach, setBalancedEach] = useState(10);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allResultsOpen, setAllResultsOpen] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input's value right away. Without this, re-selecting the
    // same file (e.g. retrying after a validation error, or re-uploading
    // after editing the CSV but keeping the same path) doesn't register as
    // a change to the browser, so onChange silently stops firing and the
    // upload dialog appears to do nothing on the next pick.
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileName(file.name);
    setParseError(null);
    setDataset(null);
    setBatchState(null);
    setAnalyzeError(null);

    if (file.size > MAX_CSV_BYTES) {
      setParseError(["CSV file must be 10 MB or smaller"]);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.data.length > MAX_BATCH) {
          setParseError([`Maximum ${MAX_BATCH} transactions are allowed per batch`]);
          return;
        }

        const columns = result.meta.fields || [];
        const { error, rows, invalidCount, hasClass } = parseAndValidateCsv(
          result.data,
          columns,
        );
        if (error) {
          setParseError(error);
          return;
        }
        if (rows.length === 0) {
          setParseError(["(no valid rows found in file)"]);
          return;
        }
        setDataset({ rows, hasClass, invalidCount });
        setMode(hasClass ? "Balanced Sample" : "Random Sample");
        const fraudCount = hasClass
          ? rows.filter((r) => r.Class === 1).length
          : 0;
        const legitCount = hasClass
          ? rows.filter((r) => r.Class === 0).length
          : 0;
        const available = Math.min(fraudCount, legitCount, 250);
        setBalancedEach(Math.min(10, Math.max(1, available)));
        setSampleSize(Math.min(20, rows.length));
      },
      error: (err) => {
        setParseError([`Could not parse CSV: ${err.message}`]);
      },
    });
  }

  function selectWorkingSet() {
    const rows = dataset.rows;
    const hasClass = dataset.hasClass;

    if (hasClass && mode === "Balanced Sample") {
      const legit = rows.filter((r) => r.Class === 0);
      const fraud = rows.filter((r) => r.Class === 1);
      const each = Math.min(balancedEach, legit.length, fraud.length);
      return shuffle([...sampleN(legit, each), ...sampleN(fraud, each)]);
    }
    if (hasClass && mode === "Fraud Cases Only") {
      const fraud = rows.filter((r) => r.Class === 1);
      return sampleN(fraud, sampleSize);
    }
    if (hasClass && mode === "Legitimate Cases Only") {
      const legit = rows.filter((r) => r.Class === 0);
      return sampleN(legit, sampleSize);
    }
    if (hasClass && mode === "All Transactions") {
      return sampleN(rows, Math.min(rows.length, MAX_BATCH));
    }
    // Random Sample (with or without a Class column)
    return sampleN(rows, sampleSize);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalyzeError(null);
    const work = selectWorkingSet();
    const transactions = work.map((row) => {
      const t = {};
      FEATURES.forEach((f) => (t[f] = row[f]));
      return t;
    });

    const started = performance.now();
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/fraud/predict-batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transactions),
        },
        60000,
      );
      const elapsedMs = performance.now() - started;

      if (!res.ok) {
        const text = await res.text();
        setAnalyzeError(`API Error ${res.status}: ${text}`);
        onBatchResult([], elapsedMs, 0, true);
        return;
      }

      const apiResult = await res.json();
      const predictions = apiResult.results;

      const results = work.map((row, i) => ({
        ...row,
        "Predicted Class": Number(predictions[i].prediction),
        "Fraud Probability (%)": Number(
          predictions[i].fraud_probability_percent,
        ),
        "Risk Level": predictions[i].risk_level,
        Prediction: predictions[i].result,
      }));

      const fraudDetected = results.filter(
        (r) => r["Predicted Class"] === 1,
      ).length;

      setBatchState({ results, hasClass: dataset.hasClass });
      onBatchResult(results, elapsedMs, fraudDetected, false);
    } catch (e) {
      setAnalyzeError(`Could not connect to FastAPI: ${e.message}`);
      onBatchResult([], 0, 0, true);
    } finally {
      setAnalyzing(false);
    }
  }

  const results = batchState?.results;
  const hasClassResults = batchState?.hasClass;

  const summary = results
    ? (() => {
        const total = results.length;
        const fraudPred = results.filter(
          (r) => r["Predicted Class"] === 1,
        ).length;
        const legitPred = total - fraudPred;
        const fraudRate = total > 0 ? (fraudPred / total) * 100 : 0;
        return { total, fraudPred, legitPred, fraudRate };
      })()
    : null;

  const metrics =
    results && hasClassResults
      ? computeMetrics(
          results.map((r) => r.Class),
          results.map((r) => r["Predicted Class"]),
        )
      : null;

  const highRisk = results
    ? results.filter((r) =>
        ["high", "critical"].includes(riskClass(r["Risk Level"])),
      )
    : [];

  const distributionData = summary
    ? [
        { name: "Legitimate", count: summary.legitPred, fill: "var(--green)" },
        { name: "Fraud", count: summary.fraudPred, fill: "var(--red)" },
      ]
    : [];

  return (
    <div>
      <h2 className="fg-section-title">📂 Batch Fraud Analysis</h2>
      <p className="small" style={{ marginBottom: 14 }}>
        Upload a CSV containing PCA-transformed credit-card transactions. The
        system will analyze multiple transactions at once using the XGBoost
        fraud detection model.
      </p>

      <div className="fg-info neutral" style={{ marginBottom: 18 }}>
        💡 Required columns: Time, V1–V28 and Amount. The Class column is
        optional and is used only for evaluation.
      </div>

      <label
        className="fg-upload"
        htmlFor="batch-csv-input"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minHeight: 220,
          boxSizing: "border-box",
          padding: "32px 24px",
          margin: 0,
          border: "1px dashed rgba(77, 208, 200, 0.45)",
          borderRadius: 14,
          background: "rgba(18, 27, 35, 0.72)",
          cursor: "pointer",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <input
          id="batch-csv-input"
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        />

        <div
          className="fg-upload-icon"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            marginBottom: 16,
            borderRadius: 14,
            border: "1px solid rgba(77, 208, 200, 0.35)",
            background: "rgba(77, 208, 200, 0.08)",
            fontSize: 32,
            lineHeight: 1,
          }}
        >
          📁
        </div>

        <div
          className="fg-upload-title"
          style={{
            width: "100%",
            maxWidth: 700,
            marginBottom: 8,
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {fileName ? (
            <span
              className="fg-upload-filename"
              title={fileName}
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {fileName}
            </span>
          ) : (
            "Click to upload a transaction CSV"
          )}
        </div>

        <div
          className="fg-upload-hint"
          style={{
            color: "var(--muted, #8494A6)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {fileName
            ? "Click here to choose a different CSV file."
            : "CSV must contain Time, V1–V28 and Amount."}
        </div>
      </label>

      {parseError && (
        <div className="fg-info error" style={{ marginTop: 16 }}>
          ❌ Your CSV is missing required columns or has no valid rows:
          <div style={{ marginTop: 8, fontFamily: "var(--mono)" }}>
            {parseError.join(", ")}
          </div>
        </div>
      )}

      {dataset && (
        <>
          {dataset.invalidCount > 0 && (
            <div className="fg-info warn" style={{ marginTop: 16 }}>
              ⚠️ {dataset.invalidCount} row(s) contained invalid or missing
              numeric values and were dropped.
            </div>
          )}

          <h3 className="fg-section-title">📊 Dataset Overview</h3>
          <div className="fg-grid cols-4">
            <div className="fg-metric">
              <div className="label">Transactions</div>
              <div className="value">
                {dataset.rows.length.toLocaleString()}
              </div>
            </div>
            <div className="fg-metric">
              <div className="label">Features</div>
              <div className="value">30</div>
            </div>
            <div className="fg-metric">
              <div className="label">PCA Features</div>
              <div className="value">28</div>
            </div>
            <div className="fg-metric">
              <div className="label">Labels</div>
              <div className="value" style={{ fontSize: 18 }}>
                {dataset.hasClass ? "Available" : "Not Available"}
              </div>
            </div>
          </div>

          {dataset.hasClass && (
            <div className="fg-info neutral" style={{ marginTop: 16 }}>
              📌 Dataset contains{" "}
              <strong>
                {dataset.rows
                  .filter((r) => r.Class === 0)
                  .length.toLocaleString()}{" "}
                legitimate
              </strong>{" "}
              and{" "}
              <strong>
                {dataset.rows
                  .filter((r) => r.Class === 1)
                  .length.toLocaleString()}{" "}
                fraud
              </strong>{" "}
              transactions.
            </div>
          )}

          <details
            className="fg-expander"
            style={{ marginTop: 16 }}
            open={previewOpen}
            onToggle={(e) => setPreviewOpen(e.target.open)}
          >
            <summary>👀 Preview Uploaded Dataset</summary>
            <div className="fg-expander-body">
              <PreviewTable
                rows={dataset.rows.slice(0, 10)}
                hasClass={dataset.hasClass}
              />
            </div>
          </details>

          <h3 className="fg-section-title">⚙️ Analysis Settings</h3>

          {dataset.hasClass ? (
            <div className="fg-field" style={{ maxWidth: 340 }}>
              <label>Select transactions to analyze</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option>Balanced Sample</option>
                <option>Random Sample</option>
                <option>Fraud Cases Only</option>
                <option>Legitimate Cases Only</option>
                <option>All Transactions</option>
              </select>
            </div>
          ) : null}

          {dataset.hasClass && mode === "Balanced Sample" && (
            <BalancedSlider
              dataset={dataset}
              value={balancedEach}
              onChange={setBalancedEach}
            />
          )}

          {((dataset.hasClass &&
            [
              "Random Sample",
              "Fraud Cases Only",
              "Legitimate Cases Only",
            ].includes(mode)) ||
            !dataset.hasClass) && (
            <CountSlider
              label={
                mode === "Fraud Cases Only"
                  ? "Number of fraud transactions"
                  : mode === "Legitimate Cases Only"
                    ? "Number of legitimate transactions"
                    : "Number of transactions"
              }
              max={Math.min(
                dataset.rows.length,
                mode === "Fraud Cases Only"
                  ? dataset.rows.filter((r) => r.Class === 1).length
                  : mode === "Legitimate Cases Only"
                    ? dataset.rows.filter((r) => r.Class === 0).length
                    : MAX_BATCH,
              )}
              value={sampleSize}
              onChange={setSampleSize}
            />
          )}

          <button
            className="fg-btn primary block"
            style={{ marginTop: 20 }}
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing ? "Analyzing…" : "🚀 Analyze Transactions"}
          </button>

          {analyzeError && (
            <div className="fg-info error" style={{ marginTop: 16 }}>
              ❌ {analyzeError}
            </div>
          )}
        </>
      )}

      {results && (
        <div style={{ marginTop: 30 }}>
          <hr className="fg-divider" />
          <h2 className="fg-section-title" style={{ marginTop: 0 }}>
            📊 Fraud Detection Dashboard
          </h2>

          <div className="fg-grid cols-4">
            <div className="fg-metric">
              <div className="label">💳 Transactions</div>
              <div className="value">{summary.total.toLocaleString()}</div>
            </div>
            <div className="fg-metric">
              <div className="label">🚨 Fraud Detected</div>
              <div className="value" style={{ color: "var(--red)" }}>
                {summary.fraudPred.toLocaleString()}
              </div>
            </div>
            <div className="fg-metric">
              <div className="label">✅ Legitimate</div>
              <div className="value" style={{ color: "var(--green)" }}>
                {summary.legitPred.toLocaleString()}
              </div>
            </div>
            <div className="fg-metric">
              <div className="label">📈 Fraud Rate</div>
              <div className="value">{summary.fraudRate.toFixed(2)}%</div>
            </div>
          </div>

          <h3 className="fg-section-title">📊 Fraud Distribution</h3>
          <div className="fg-card" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232D38" />
                <XAxis dataKey="name" stroke="#8494A6" fontSize={12} />
                <YAxis stroke="#8494A6" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#171F28",
                    border: "1px solid #232D38",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distributionData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {hasClassResults && metrics && (
            <>
              <h3 className="fg-section-title">🎯 Model Performance</h3>
              <div className="fg-grid cols-4">
                <div className="fg-metric">
                  <div className="label">Accuracy</div>
                  <div className="value">
                    {(metrics.accuracy * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="fg-metric">
                  <div className="label">Precision</div>
                  <div className="value">
                    {(metrics.precision * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="fg-metric">
                  <div className="label">Recall</div>
                  <div className="value">
                    {(metrics.recall * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="fg-metric">
                  <div className="label">F1 Score</div>
                  <div className="value">{(metrics.f1 * 100).toFixed(2)}%</div>
                </div>
              </div>
              <p className="fg-footer-note">
                These metrics compare the model prediction with the Class label
                already present in the dataset.
              </p>

              <h3 className="fg-section-title">🔢 Confusion Matrix</h3>
              <div className="fg-table-wrap">
                <table className="fg-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Predicted Legitimate</th>
                      <th>Predicted Fraud</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Actual Legitimate</th>
                      <td>{metrics.tn}</td>
                      <td>{metrics.fp}</td>
                    </tr>
                    <tr>
                      <th>Actual Fraud</th>
                      <td>{metrics.fn}</td>
                      <td>{metrics.tp}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h3 className="fg-section-title">🚨 High-Risk Transactions</h3>
          {highRisk.length > 0 ? (
            <>
              <div className="fg-info error" style={{ marginBottom: 12 }}>
                🚨 {highRisk.length} high-risk transaction(s) detected.
              </div>
              <ResultsTable rows={highRisk} hasClass={hasClassResults} />
            </>
          ) : (
            <div className="fg-info success">
              ✅ No high-risk transactions detected in this analysis.
            </div>
          )}

          <details
            className="fg-expander"
            style={{ marginTop: 20 }}
            open={allResultsOpen}
            onToggle={(e) => setAllResultsOpen(e.target.open)}
          >
            <summary>📋 View All Transaction Results</summary>
            <div className="fg-expander-body">
              <ResultsTable rows={results} hasClass={hasClassResults} />
            </div>
          </details>

          <h3 className="fg-section-title">💾 Export Results</h3>
          <button
            className="fg-btn block"
            onClick={() => downloadCsv("fraud_detection_results.csv", results)}
          >
            ⬇️ Download Fraud Analysis Report
          </button>
        </div>
      )}
    </div>
  );
}

function BalancedSlider({ dataset, value, onChange }) {
  const legitCount = dataset.rows.filter((r) => r.Class === 0).length;
  const fraudCount = dataset.rows.filter((r) => r.Class === 1).length;
  const available = Math.min(legitCount, fraudCount, 250);

  if (available < 1) {
    return (
      <div className="fg-info error" style={{ marginTop: 12 }}>
        Balanced sampling requires both fraud and legitimate transactions.
      </div>
    );
  }

  return (
    <div className="fg-field" style={{ maxWidth: 420, marginTop: 12 }}>
      <label>
        Transactions from each class: {value} (of {available} available)
      </label>
      <input
        className="fg-slider"
        type="range"
        min="1"
        max={available}
        value={Math.min(value, available)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CountSlider({ label, max, value, onChange }) {
  const safeMax = Math.max(1, max);
  return (
    <div className="fg-field" style={{ maxWidth: 420, marginTop: 12 }}>
      <label>
        {label}: {Math.min(value, safeMax)} (max {safeMax})
      </label>
      <input
        className="fg-slider"
        type="range"
        min="1"
        max={safeMax}
        value={Math.min(value, safeMax)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function PreviewTable({ rows, hasClass }) {
  const cols = hasClass
    ? ["Time", "V1", "V2", "V3", "Amount", "Class"]
    : ["Time", "V1", "V2", "V3", "Amount"];
  return (
    <div className="fg-table-wrap">
      <table className="fg-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>
                  {typeof r[c] === "number" ? r[c].toFixed(2) : r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsTable({ rows, hasClass }) {
  const cols = [
    "Time",
    "Amount",
    ...(hasClass ? ["Class"] : []),
    "Predicted Class",
    "Fraud Probability (%)",
    "Risk Level",
    "Prediction",
  ];
  return (
    <div className="fg-table-wrap">
      <table className="fg-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>
                  {c === "Risk Level" ? (
                    <span className={`fg-badge ${riskClass(r[c])}`}>
                      {r[c]}
                    </span>
                  ) : typeof r[c] === "number" ? (
                    Number.isInteger(r[c]) ? (
                      r[c]
                    ) : (
                      r[c].toFixed(2)
                    )
                  ) : (
                    r[c]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
