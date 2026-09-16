import pandas as pd

try:
    from ..utils.load_fraud import (
        model,
        scaler,
        threshold,
        features
    )
except ImportError:
    from utils.load_fraud import (
        model,
        scaler,
        threshold,
        features
    )


def predict_fraud(data):

    # -----------------------------------------------------
    # Convert input to DataFrame
    # -----------------------------------------------------

    df = pd.DataFrame([data])


    # -----------------------------------------------------
    # Arrange features in correct order
    # -----------------------------------------------------

    df = df[features]


    # -----------------------------------------------------
    # Scale Time and Amount
    # -----------------------------------------------------

    df[["Time", "Amount"]] = scaler.transform(
        df[["Time", "Amount"]]
    )


    # -----------------------------------------------------
    # Get probability
    # -----------------------------------------------------

    probability = model.predict_proba(df)[0][1]


    # -----------------------------------------------------
    # Apply threshold
    # -----------------------------------------------------

    prediction = int(
        probability >= threshold
    )


    # -----------------------------------------------------
    # Result
    # -----------------------------------------------------

    if prediction == 1:
        result = "Fraud"
    else:
        result = "Legitimate"


    # -----------------------------------------------------
    # Risk level
    # -----------------------------------------------------

    if probability >= 0.80:

        risk = "HIGH"

    elif probability >= 0.50:

        risk = "MEDIUM"

    else:

        risk = "LOW"


    return {
        "prediction": prediction,
        "result": result,
        "fraud_probability": round(
            float(probability), 6
        ),
        "fraud_probability_percent": round(
            float(probability) * 100, 2
        ),
        "threshold": threshold,
        "risk_level": risk
    }