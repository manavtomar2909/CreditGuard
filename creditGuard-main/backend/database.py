import psycopg2
import os
from datetime import datetime


# =========================================================
# PostgreSQL Configuration
# =========================================================

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5433")),
    "database": os.getenv("POSTGRES_DB", "credit_guard"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "")
}

DATABASE_URL = os.getenv("DATABASE_URL")


# =========================================================
# Database Connection
# =========================================================

def get_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)

    if "POSTGRES_PASSWORD" not in os.environ:
        raise RuntimeError(
            "Set DATABASE_URL or POSTGRES_PASSWORD before starting the backend"
        )

    return psycopg2.connect(**DB_CONFIG)


# =========================================================
# Initialize Database
# =========================================================

def init_db():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            transaction_time DOUBLE PRECISION,
            amount DOUBLE PRECISION,
            prediction INTEGER,
            fraud_probability DOUBLE PRECISION,
            risk_level TEXT,
            result TEXT,
            created_at TIMESTAMP
        )
    """)

    conn.commit()

    cursor.close()
    conn.close()


# =========================================================
# Save Transaction
# =========================================================

def save_transaction(
    transaction_time,
    amount,
    prediction,
    fraud_probability,
    risk_level,
    result
):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO transactions (
            transaction_time,
            amount,
            prediction,
            fraud_probability,
            risk_level,
            result,
            created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        transaction_time,
        amount,
        prediction,
        fraud_probability,
        risk_level,
        result,
        datetime.now()
    ))

    conn.commit()

    cursor.close()
    conn.close()


# =========================================================
# Get Transaction History
# =========================================================

def get_transactions():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            id,
            transaction_time,
            amount,
            prediction,
            fraud_probability,
            risk_level,
            result,
            created_at
        FROM transactions
        ORDER BY id DESC
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows