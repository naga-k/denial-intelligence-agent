"""Environment/config loading. Reads the repo-root .env (gitignored).

Tolerant by design: only GEMINI_API_KEY is needed to smoke-test the graph.
ClickHouse settings default to empty so importing this module never crashes
before the Cloud service is provisioned; db.client() raises a clear error if
they're still empty when a DB call is actually made.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load the repo-root .env regardless of where the process is launched from.
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

CLICKHOUSE = dict(
    host=os.getenv("CLICKHOUSE_HOST", ""),
    port=int(os.getenv("CLICKHOUSE_PORT", "8443")),
    username=os.getenv("CLICKHOUSE_USER", "default"),
    password=os.getenv("CLICKHOUSE_PASSWORD", ""),
    database=os.getenv("CLICKHOUSE_DB", "denials"),
    secure=True,  # ClickHouse Cloud requires TLS
)

DEMO_POLICY_URL = os.getenv("DEMO_POLICY_URL", "http://localhost:8080/index.html")

SCHEMA_PATH = str(_ROOT / "agent" / "schema.sql")
