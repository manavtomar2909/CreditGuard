import joblib
import json
from pathlib import Path


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
MODEL_PATH = MODELS_DIR / "xgboost_fraud_model.pkl"
SCALER_PATH = MODELS_DIR / "scaler.pkl"
CONFIG_PATH = MODELS_DIR / "config.json"
FEATURES_PATH = MODELS_DIR / "features.json"


# ---------------------------------------------------------
# Load XGBoost model
# ---------------------------------------------------------

model = joblib.load(MODEL_PATH)


# ---------------------------------------------------------
# Load scaler
# ---------------------------------------------------------

scaler = joblib.load(SCALER_PATH)


# ---------------------------------------------------------
# Load configuration
# ---------------------------------------------------------

with open(CONFIG_PATH, "r") as f:
    config = json.load(f)


threshold = float(config["threshold"])


# ---------------------------------------------------------
# Load features
# ---------------------------------------------------------

with open(FEATURES_PATH, "r") as f:
    feature_data = json.load(f)


features = feature_data["features"]


print("Fraud detection model loaded")
print("Number of features:", len(features))
print("Threshold:", threshold)