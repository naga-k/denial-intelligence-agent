"""Heartbeat: poll policies, then run the graph on every unprocessed change and
write a grounded recommendation. The `processed` flag on policy_changes is the
queue — it guarantees each change is drafted exactly once. Run with ddtrace-run
so Datadog captures the graph trace:

    cd agent && .venv/bin/ddtrace-run .venv/bin/python -m src.run_loop
"""
import time
import uuid
from datetime import datetime

from .db import query_rows, insert, client
from .graph import build_graph
from .monitor import poll_once
from .observability import init_observability


def latest_policy_text(policy_id: str) -> str:
    rows = query_rows(
        "SELECT content_text FROM denials.policy_snapshots "
        "WHERE policy_id={p:String} ORDER BY fetched_at DESC LIMIT 1",
        {"p": policy_id},
    )
    return rows[0]["content_text"] if rows else ""


def process_unhandled(graph):
    pending = query_rows(
        "SELECT * FROM denials.policy_changes WHERE processed = 0 ORDER BY detected_at"
    )
    for ch in pending:
        state = graph.invoke({
            "change": ch,
            "policy_text": latest_policy_text(ch["policy_id"]),
            "grounded_policy_url": ch["source_url"],
            "revisions": 0,
        })
        impacted = state.get("impact", {}).get("contracts", [])
        if not impacted:
            # No claims/contracts hit (e.g. an unrelated policy or a fetch that
            # returned a block page) — mark processed but don't persist a rec.
            client().command(
                "ALTER TABLE denials.policy_changes UPDATE processed = 1 "
                "WHERE change_id = {c:String}",
                parameters={"c": ch["change_id"]},
            )
            print(f"[loop] {ch['change_id']}: no impacted contracts — skipped")
            continue
        contract_id = impacted[0]["contract_id"]
        insert("recommendations", [dict(
            rec_id=f"REC-{uuid.uuid4().hex[:10]}", change_id=ch["change_id"],
            contract_id=contract_id, payer_name=ch["payer_name"],
            trigger=ch["diff_summary"], rec_text=state.get("rec_text", ""),
            grounded_policy_url=ch["source_url"],
            confidence=state.get("confidence", 0.0), status="new",
            created_at=datetime.utcnow(),
        )])
        client().command(
            "ALTER TABLE denials.policy_changes UPDATE processed = 1 "
            "WHERE change_id = {c:String}",
            parameters={"c": ch["change_id"]},
        )
        print(f"[loop] processed {ch['change_id']} -> rec for {contract_id}")


def main(interval: int = 10):
    init_observability()
    graph = build_graph()
    print("[loop] heartbeat started")
    while True:
        poll_once()
        process_unhandled(graph)
        time.sleep(interval)


if __name__ == "__main__":
    main()
