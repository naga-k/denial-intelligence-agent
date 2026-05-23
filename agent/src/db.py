"""ClickHouse Cloud client + thin query/insert helpers."""
import clickhouse_connect
from .config import CLICKHOUSE, SCHEMA_PATH


def _require_host():
    if not CLICKHOUSE["host"]:
        raise RuntimeError(
            "CLICKHOUSE_HOST is empty. Provision a ClickHouse Cloud service and "
            "fill CLICKHOUSE_* in the repo-root .env (see agent/.env.example)."
        )


def client():
    _require_host()
    return clickhouse_connect.get_client(**CLICKHOUSE)


def apply_schema(path: str = SCHEMA_PATH):
    """Create database + tables + views. Connects WITHOUT a database first so
    CREATE DATABASE works on a fresh service."""
    _require_host()
    cli = clickhouse_connect.get_client(
        host=CLICKHOUSE["host"], port=CLICKHOUSE["port"],
        username=CLICKHOUSE["username"], password=CLICKHOUSE["password"],
        secure=True,
    )
    with open(path) as f:
        sql = f.read()
    for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
        cli.command(stmt)


def query_rows(sql: str, params: dict | None = None) -> list[dict]:
    res = client().query(sql, parameters=params or {})
    return [dict(zip(res.column_names, row)) for row in res.result_rows]


def insert(table: str, rows: list[dict]):
    if not rows:
        return
    cols = list(rows[0].keys())
    data = [[r[c] for c in cols] for r in rows]
    client().insert(f"denials.{table}", data, column_names=cols)
