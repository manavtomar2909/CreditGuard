import Papa from "papaparse";

// =========================================================
// CONFIG (unchanged from the original Streamlit app)
// =========================================================
export const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const PCA_FEATURES = Array.from({ length: 28 }, (_, i) => `V${i + 1}`);
export const FEATURES = ["Time", ...PCA_FEATURES, "Amount"];

export const DEMO_TRANSACTION = {
  Time: 50000,
  Amount: 100,
  V1: 0.5, V2: -0.2, V3: 0.3, V4: 0.1,
  V5: -0.1, V6: 0.2, V7: -0.3, V8: 0.1,
  V9: -0.2, V10: 0.2, V11: -0.1, V12: 0.3,
  V13: -0.2, V14: 0.1, V15: 0.2, V16: -0.1,
  V17: 0.2, V18: -0.2, V19: 0.1, V20: 0.0,
  V21: 0.1, V22: -0.1, V23: 0.0, V24: 0.1,
  V25: -0.1, V26: 0.0, V27: 0.1, V28: 0.0,
};

export function emptyTransaction(defaults = {}) {
  const t = { Time: 0, Amount: 100 };
  PCA_FEATURES.forEach((f) => (t[f] = 0));
  return { ...t, ...defaults };
}

// ---------------------------------------------------------
// fetch with a client-side timeout. The original app relied on
// requests(timeout=...) on the Python side; the browser fetch()
// API has no built-in timeout, so a hung backend would otherwise
// spin the UI forever instead of surfacing an error.
// ---------------------------------------------------------
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export function riskClass(risk) {
  const r = String(risk || "").toUpperCase();
  if (r === "CRITICAL" || r === "HIGH") return "high";
  if (r === "MEDIUM") return "medium";
  return "low";
}

export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------
// Fisher–Yates shuffle + sampling without replacement.
// Bug fix: the original Streamlit code called df.sample(n=n) in the
// "Random Sample" branch with no bound on n vs. available rows in a
// couple of code paths, which raises inside pandas if n exceeds the
// population. Every sampler below clamps n to the available length.
// ---------------------------------------------------------
export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sampleN(arr, n) {
  const safeN = Math.max(0, Math.min(n, arr.length));
  return shuffle(arr).slice(0, safeN);
}

// ---------------------------------------------------------
// Classification metrics, replacing sklearn's accuracy_score /
// precision_score / recall_score / f1_score / confusion_matrix.
// Uses zero_division=0 semantics to match the original.
// ---------------------------------------------------------
export function computeMetrics(yTrue, yPred) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const t = Number(yTrue[i]);
    const p = Number(yPred[i]);
    if (t === 1 && p === 1) tp++;
    else if (t === 0 && p === 0) tn++;
    else if (t === 0 && p === 1) fp++;
    else if (t === 1 && p === 0) fn++;
  }
  const total = tp + tn + fp + fn;
  const accuracy = total === 0 ? 0 : (tp + tn) / total;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { accuracy, precision, recall, f1, tp, tn, fp, fn };
}

// ---------------------------------------------------------
// CSV -> validated rows, mirroring the pandas validation block:
// - checks all FEATURES columns are present
// - coerces each FEATURES cell to a number (like pd.to_numeric(errors="coerce"))
// - drops rows where any FEATURES value failed to coerce
// Bug fix: the original only ran pd.to_numeric on FEATURES, so a
// non-numeric "Class" column (e.g. "yes"/"no" instead of 0/1) would
// silently pass through and later crash sklearn's metric functions.
// This version also coerces Class to {0,1} and drops rows that don't
// parse cleanly, only when a Class column is present.
// ---------------------------------------------------------
export function parseAndValidateCsv(rawRows, columns) {
  const missing = FEATURES.filter((f) => !columns.includes(f));
  if (missing.length > 0) {
    return { error: missing };
  }
  const hasClass = columns.includes("Class");
  let invalidCount = 0;
  const cleanRows = [];

  for (const row of rawRows) {
    let valid = true;
    const parsed = {};
    for (const f of FEATURES) {
      const num = parseFloat(row[f]);
      if (Number.isNaN(num)) {
        valid = false;
        break;
      }
      parsed[f] = num;
    }
    if (valid && hasClass) {
      const cls = parseInt(row["Class"], 10);
      if (cls !== 0 && cls !== 1) {
        valid = false;
      } else {
        parsed["Class"] = cls;
      }
    }
    if (!valid) {
      invalidCount++;
      continue;
    }
    cleanRows.push(parsed);
  }

  return { rows: cleanRows, invalidCount, hasClass };
}
