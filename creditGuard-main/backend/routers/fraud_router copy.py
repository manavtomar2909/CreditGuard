from fastapi import APIRouter, HTTPException

try:
    from ..schema.fraud_input import FraudInput
    from ..model.fraud import predict_fraud
except ImportError:
    from schema.fraud_input import FraudInput
    from model.fraud import predict_fraud


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
# Prediction
# =========================================================

@router.post("/predict")
def fraud_prediction(data: FraudInput):

    try:

        # Convert Pydantic object to dictionary

        transaction_data = data.model_dump()


        # Run prediction

        result = predict_fraud(
            transaction_data
        )


        return result


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )