# Credit Guard

Credit Guard is a full-stack credit-card fraud detection application. It provides a React dashboard, a FastAPI backend, PostgreSQL transaction history, and an XGBoost fraud classifier.

## Features

- Single-transaction fraud prediction
- Batch CSV transaction analysis
- Fraud probability, risk level, and decision results
- Transaction history stored in PostgreSQL
- Monitoring metrics and recent activity
- Model information and feature listing
- Responsive React dashboard
- Client-side request timeouts and CSV validation
- Lazy-loaded frontend pages for smaller initial bundles

## Project Structure

```text
creditGuard/
├── backend/
│   ├── app.py                  # FastAPI application
│   ├── database.py             # PostgreSQL connection and transactions table
│   ├── requirements.txt        # Python dependencies
│   ├── model/
│   │   └── fraud.py            # Prediction pipeline
│   ├── models/
│   │   ├── xgboost_fraud_model.pkl
│   │   ├── fraud_detection_dl.keras
│   │   ├── scaler.pkl
│   │   ├── config.json
│   │   └── features.json
│   ├── routers/
│   │   └── fraud_router.py     # API endpoints
│   ├── schema/
│   │   └── fraud_input.py      # Request validation schema
│   └── utils/
│       └── load_fraud.py       # Model and configuration loading
├── frontend/
│   ├── FraudGuardDashboard.jsx # Main application shell
│   ├── pages/                  # Dashboard pages
│   ├── utils.js                # API, CSV, and metric helpers
│   ├── fraud-guard.css         # Application styling
│   ├── package.json
│   └── vite.config.js
├── .env.example                # Local and hosted environment template
├── render.yaml                 # Render service blueprint
└── README.md
```

## Requirements

Install the following before running the project:

- Python 3.10 or newer
- Node.js and npm
- PostgreSQL running locally, or a hosted PostgreSQL provider
- PostgreSQL database named `credit_guard`

The backend uses `DATABASE_URL` when provided. For local development it also
supports separate `POSTGRES_*` variables and defaults to port `5433`. Hosted
PostgreSQL services commonly use port `5432`.

## Database Setup

Create the database once using PostgreSQL or pgAdmin:

```sql
CREATE DATABASE credit_guard;
```

The backend automatically creates the `transactions` table when it starts. The table stores:

- Transaction time
- Transaction amount
- Prediction result
- Fraud probability
- Risk level
- Result label
- Creation timestamp

Database credentials are read from environment variables and are not stored in the repository.

## Backend Setup

From the repository root, create or activate a Python virtual environment:

### Windows PowerShell

```powershell
cd backend
python -m venv myenv
.\myenv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5433"
$env:POSTGRES_DB="credit_guard"
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="your-local-postgres-password"
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

### macOS or Linux

```bash
cd backend
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
export POSTGRES_DB=credit_guard
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your-local-postgres-password
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at:

- http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Frontend Setup

Open a second terminal from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

The frontend expects the backend at `http://127.0.0.1:8000`.

For a hosted backend, set `VITE_API_URL` before building. Vite injects this
value at build time.

To create a production build:

```powershell
npm run build
```

To preview the production build:

```powershell
npm run preview
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | API status and active model name |
| `/health` | GET | Render health check |
| `/fraud/health` | GET | Fraud service health check |
| `/fraud/predict` | POST | Predict one transaction |
| `/fraud/predict-batch` | POST | Predict up to 500 transactions |
| `/fraud/history` | GET | Return saved transaction history |
| `/fraud/model-info` | GET | Return active model and feature metadata |

### Single Prediction Example

```bash
curl -X POST http://127.0.0.1:8000/fraud/predict \
  -H "Content-Type: application/json" \
  -d '{
    "Time": 50000,
    "V1": 0.1,
    "V2": 0.2,
    "V3": 0.3,
    "V4": 0.4,
    "V5": 0.5,
    "V6": 0.6,
    "V7": 0.7,
    "V8": 0.8,
    "V9": 0.9,
    "V10": 1.0,
    "V11": 1.1,
    "V12": 1.2,
    "V13": 1.3,
    "V14": 1.4,
    "V15": 1.5,
    "V16": 1.6,
    "V17": 1.7,
    "V18": 1.8,
    "V19": 1.9,
    "V20": 2.0,
    "V21": 2.1,
    "V22": 2.2,
    "V23": 2.3,
    "V24": 2.4,
    "V25": 2.5,
    "V26": 2.6,
    "V27": 2.7,
    "V28": 2.8,
    "Amount": 100
  }'
```

## Model Details

The active prediction model is `xgboost_fraud_model.pkl`, loaded as an XGBoost classifier. The prediction pipeline:

1. Validates the transaction input.
2. Arranges the 30 features in the configured order.
3. Scales `Time` and `Amount` using `scaler.pkl`.
4. Calculates fraud probability with the XGBoost model.
5. Applies the configured threshold from `config.json`.
6. Assigns a fraud result and LOW, MEDIUM, or HIGH risk level.

The 30 input features are `Time`, `V1` through `V28`, and `Amount`. The current threshold is stored in `backend/models/config.json`.

The repository also contains `fraud_detection_dl.keras`, a saved Keras model. It is present for reference but is not currently used by the active prediction pipeline.

## Frontend Pages

- Dashboard: overview and API status
- Check Transaction: analyze one transaction
- Batch Analysis: upload and analyze transaction CSV files
- Transaction History: view saved predictions and export history
- Monitoring: inspect session metrics and recent activity
- Model: view active model and input feature metadata

## Development Notes

- The frontend uses React, React Router, Recharts, and Papa Parse.
- The backend uses FastAPI, Pydantic, pandas, scikit-learn, XGBoost, joblib, and psycopg2-binary.
- The frontend uses lazy-loaded pages to reduce the initial JavaScript bundle.
- Batch CSV files are limited to 500 rows and 10 MB; oversized files are rejected rather than silently truncated.
- Keep `.env` files, passwords, virtual environments, `node_modules`, build output, and local database files out of Git.
- Use `.env.example` as the reference for PostgreSQL environment variable names.

## Troubleshooting

### Frontend shows API offline

Make sure the backend is running on port `8000` and that the frontend is running on port `5173`.

### Model page shows `Not Found`

Use the current backend and frontend together. The model endpoint is `/fraud/model-info`.

### Database connection fails

Check that PostgreSQL is running, the `credit_guard` database exists, and either `DATABASE_URL` or the local `POSTGRES_*` variables are configured.

### PowerShell blocks virtual environment activation

Run PowerShell with an appropriate execution policy or activate the environment using:

```powershell
.\myenv\Scripts\python.exe -m pip install -r requirements.txt
.\myenv\Scripts\python.exe -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

## Deploy on Render Free

The repository includes `render.yaml` for one Render Python web service and
one Render static site. PostgreSQL is configured separately through
`DATABASE_URL`; use a production PostgreSQL provider and never commit its
credentials.

### Backend web service

Create a Render Blueprint from this repository, or create a web service with:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |

Set these environment variables on the backend service:

```text
DATABASE_URL=<production PostgreSQL connection string>
FRONTEND_URL=https://<your-frontend>.onrender.com
```

`FRONTEND_URL` can contain comma-separated origins if needed. Do not include a
trailing slash.

### Frontend static site

Create a Render Static Site with:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm install && npm run build` |
| Publish directory | `dist` |

Set this environment variable before the frontend build:

```text
VITE_API_URL=https://<your-backend>.onrender.com
```

The Render blueprint rewrites all frontend routes to `index.html`, which is
required because the app uses React Router with `BrowserRouter`.

### Deployment order

1. Push the repository to GitHub.
2. Create the production PostgreSQL database and copy its connection string.
3. Deploy the backend with `DATABASE_URL` and the temporary or final `FRONTEND_URL`.
4. Verify `/health`, `/fraud/health`, `/docs`, and `/fraud/model-info`.
5. Deploy the frontend with `VITE_API_URL` set to the backend URL.
6. Set `FRONTEND_URL` to the final frontend URL and redeploy the backend.
7. Test single prediction, batch prediction, history, monitoring, and model pages.

Render free services sleep after inactivity, so the first request after idle
time may be slow. The model is loaded once per backend process. Batch requests
are capped at 500 rows and CSV files at 10 MB for free-tier memory, CPU,
request-time, and database protection.

### Railway and Vercel audit

No Railway or Vercel-specific files remain. The repository has no
`railway.json`, `railway.toml`, `vercel.json`, `.vercel` directory, serverless
function, or platform-specific API route. `VITE_API_URL` and `FRONTEND_URL` are
platform-neutral environment variables and are used by Render as well.
