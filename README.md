# CreditGuard – Credit Card Fraud Detection

CreditGuard is a full-stack credit card fraud detection application that uses machine learning to analyze transaction data and identify potentially fraudulent transactions. The system provides a React dashboard, FastAPI backend, PostgreSQL transaction history, and an XGBoost fraud classifier.

## Features

- Single-transaction fraud prediction
- Batch CSV transaction analysis
- Fraud probability and risk-level detection
- Transaction history stored in PostgreSQL
- Monitoring metrics and recent activity
- Model information and feature listing
- Responsive React dashboard
- FastAPI-based prediction API
- CSV validation and request handling

## Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS

**Backend**
- Python
- FastAPI
- Pydantic

**Machine Learning**
- XGBoost
- Scikit-learn
- Pandas
- NumPy
- Joblib

**Database**
- PostgreSQL

**Deployment**
- Render

## Machine Learning Model

The project uses an **XGBoost Classifier** for fraud detection.

The prediction pipeline:

1. Transaction data is received from the frontend.
2. Input data is validated using Pydantic.
3. The 30 input features are arranged in the configured order.
4. `Time` and `Amount` features are scaled using `StandardScaler`.
5. The trained XGBoost model calculates the fraud probability.
6. A configured threshold is applied to generate the prediction.
7. The system assigns a fraud result and risk level.

The 30 input features consist of:

`Time`, `V1`–`V28`, and `Amount`.

The project also includes saved model and configuration files such as the XGBoost model, scaler, and threshold configuration.

## Model Evaluation

The models were evaluated using:

- Accuracy
- Precision
- Recall
- F1-Score
- PR-AUC

The project compared Logistic Regression, Random Forest, and XGBoost for the fraud classification task.

## System Workflow

```text
User
  ↓
React Dashboard
  ↓
FastAPI Backend
  ↓
Input Validation
  ↓
Feature Scaling
  ↓
XGBoost Classifier
  ↓
Fraud Probability
  ↓
Risk Level & Prediction
  ↓
PostgreSQL Transaction History
```

## Project Structure

```text
CreditGuard/
│
├── backend/
│   ├── app.py
│   ├── database.py
│   ├── requirements.txt
│   │
│   ├── model/
│   │   └── fraud.py
│   │
│   ├── models/
│   │   ├── xgboost_fraud_model.pkl
│   │   ├── scaler.pkl
│   │   ├── config.json
│   │   └── features.json
│   │
│   ├── routers/
│   │   └── fraud_router.py
│   │
│   ├── schema/
│   │   └── fraud_input.py
│   │
│   └── utils/
│       └── load_fraud.py
│
├── frontend/
│   ├── FraudGuardDashboard.jsx
│   ├── pages/
│   ├── utils.js
│   ├── fraud-guard.css
│   ├── package.json
│   └── vite.config.js
│
├── .env.example
├── .gitignore
├── render.yaml
└── README.md
```

## Requirements

Before running the project, install:

- Python 3.10 or newer
- Node.js and npm
- PostgreSQL
- PostgreSQL database named credit_guard

## Backend Setup

```text
cd backend
python -m venv myenv
```

## Windows

```text
.\myenv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Start the backend:

```text
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

## Backend:

```text
http://127.0.0.1:8000
```

## Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

Open a new terminal:

```text
cd frontend
npm install
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

## API Endpoints

| Endpoint               | Method | Description                            |
| ---------------------- | ------ | -------------------------------------- |
| `/`                    | GET    | API status                             |
| `/health`              | GET    | Backend health check                   |
| `/fraud/health`        | GET    | Fraud service health check             |
| `/fraud/predict`       | POST   | Predict a single transaction           |
| `/fraud/predict-batch` | POST   | Predict multiple transactions          |
| `/fraud/history`       | GET    | Retrieve transaction history           |
| `/fraud/model-info`    | GET    | Retrieve model and feature information |

## Frontend Pages

- Dashboard
- Check Transaction
- Batch Analysis
- Transaction History
- Monitoring
- Model Information

## Deployment

The project is configured for deployment using Render.

The repository contains a render.yaml configuration for the backend and frontend services.

Environment variables such as DATABASE_URL, FRONTEND_URL, and VITE_API_URL are used for hosted deployment.

- Future Improvements
- Real-time fraud monitoring
- Model drift detection
- Automated model retraining
- Improved threshold tuning
- Additional transaction and behavioral features
- Enhanced fraud analytics

## Disclaimer

This project is developed for educational and demonstration purposes using machine learning techniques for credit card fraud detection.
