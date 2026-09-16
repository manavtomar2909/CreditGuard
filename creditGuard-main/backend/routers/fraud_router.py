import logging

from fastapi import APIRouter, HTTPException
try:
    from ..schema.fraud_input import FraudInput
    from ..model.fraud import predict_fraud
    from ..database import save_transaction
    from ..utils.load_fraud import model, threshold, features
except ImportError:
    from schema.fraud_input import FraudInput
    from model.fraud import predict_fraud
    from database import save_transaction
    from utils.load_fraud import model, threshold, features

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/fraud",
    tags=["Credit Card Fraud Detection"]
)


# =========================================================
# Health check
# =========================================================

@router.get("/health")
def health_check():

    return {
        "status": "healthy",
        "service": "Credit Card Fraud Detection"
    }


# =========================================================
# Model information
# =========================================================

@router.get("/model-info")
def model_info():

    return {
        "model": "XGBoost",
        "model_type": type(model).__name__,
        "number_of_features": len(features),
        "threshold": threshold,
        "features": features
    }


# =========================================================
# Single Prediction
# =========================================================

@router.post("/predict")
def fraud_prediction(data: FraudInput):

    try:

        transaction_data = data.model_dump()

        result = predict_fraud(
    transaction_data
)

        save_transaction(
    transaction_time=data.Time,
    amount=data.Amount,
    prediction=result["prediction"],
    fraud_probability=result["fraud_probability"],
    risk_level=result["risk_level"],
    result=result["result"]
)

        return result

    except Exception as e:

        logger.exception("Single prediction failed")

        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please try again."
        )


# =========================================================
# Batch Prediction
# =========================================================
# =========================================================
# Batch Prediction
# =========================================================

@router.post("/predict-batch")
def batch_fraud_prediction(
    transactions: list[FraudInput]
):

    try:

        if not transactions:
            raise HTTPException(
                status_code=400,
                detail="No transactions provided"
            )

        # Limit for hackathon/demo
        if len(transactions) > 500:
            raise HTTPException(
                status_code=400,
                detail="Maximum 500 transactions per batch"
            )

        results = []

        for transaction in transactions:

            transaction_data = transaction.model_dump()

            # Run prediction
            result = predict_fraud(
                transaction_data
            )

            # Save batch transaction to database
            save_transaction(
                transaction_time=transaction.Time,
                amount=transaction.Amount,
                prediction=result["prediction"],
                fraud_probability=result["fraud_probability"],
                risk_level=result["risk_level"],
                result=result["result"]
            )

            results.append(result)

        return {
            "count": len(results),
            "results": results
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.exception("Batch prediction failed")

        raise HTTPException(
            status_code=500,
            detail="Batch prediction failed. Please try again."
        )
@router.get("/history")
def transaction_history():

    try:

        try:
            from ..database import get_transactions
        except ImportError:
            from database import get_transactions

        rows = get_transactions()

        return {
            "count": len(rows),
            "transactions": [
                {
                    "id": row[0],
                    "time": row[1],
                    "amount": row[2],
                    "prediction": row[3],
                    "fraud_probability": row[4],
                    "risk_level": row[5],
                    "result": row[6],
                    "created_at": row[7]
                }
                for row in rows
            ]
        }

    except Exception as e:
        logger.exception("Transaction history lookup failed")

        raise HTTPException(
            status_code=500,
            detail="Unable to load transaction history. Please try again."
        )