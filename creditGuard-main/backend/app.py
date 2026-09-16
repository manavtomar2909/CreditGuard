import os

from fastapi import FastAPI

try:
    from .routers.fraud_router import router as fraud_router
    from .database import init_db
except ImportError:
    from routers.fraud_router import router as fraud_router
    from database import init_db


# =========================================================
# Create FastAPI application
# =========================================================

app = FastAPI(
    title="Credit Card Fraud Detection API",
    description="Real-time credit card fraud detection using XGBoost",
    version="1.0.0"
)

from fastapi.middleware.cors import CORSMiddleware

frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")
    if origin.strip()
]
frontend_origins.extend([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(frontend_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# =========================================================
# Include routers
# =========================================================

app.include_router(
    fraud_router
)


# =========================================================
# Home
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Credit Card Fraud Detection API",
        "status": "running",
        "model": "XGBoost"
    }


@app.get("/health")
def health():

    return {"status": "healthy"}