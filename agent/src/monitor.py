"""Nimble live policy monitor: fetch -> hash -> diff -> emit policy_changes.

Fetches via the Nimble web API when NIMBLE_API_KEY is set, else plain requests
(fine for the controllable demo page). The on-stage page is the only one edited
live; the real URLs prove open-web capability but stay static during the demo.
"""
import hashlib
import os
import uuid
from datetime import datetime

import requests

from .config import DEMO_POLICY_URL
from .db import insert, query_rows

# (policy_id, payer, url). 1 controllable + 2 real. CONFIRM real URLs are
# login-free before locking (see plan "Open item to verify").
TARGETS = [
    ("uhc-mri-70553", "UnitedHealth", os.getenv("DEMO_POLICY_URL", DEMO_POLICY_URL)),
    ("cms-lcd-sleep", "CMS Medicare", "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33405"),
    ("aetna-imaging", "Aetna", "https://www.aetna.com/cpb/medical/data/1_99/0001.html"),
]


def _fetch(url: str) -> str:
    key = os.getenv("NIMBLE_API_KEY")
    if key:
        # NOTE: confirm exact Nimble realtime endpoint/auth header from their docs.
        r = requests.post(
            "https://api.webit.live/api/v1/realtime/web",
            headers={"Authorization": f"Basic {key}"},
            json={"url": url, "render": True, "format": "markdown"},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        return data.get("html_content") or data.get("content") or r.text
    return requests.get(url, timeout=20).text


def poll_once() -> int:
    changes = 0
    for policy_id, payer, url in TARGETS:
        try:
            text = _fetch(url)
        except Exception as e:  # noqa: BLE001 - venue wifi can drop; keep polling others
            print(f"[monitor] fetch failed {url}: {e}")
            continue
        h = hashlib.sha256(text.encode()).hexdigest()
        prev = query_rows(
            "SELECT content_hash FROM denials.policy_snapshots "
            "WHERE policy_id={p:String} ORDER BY fetched_at DESC LIMIT 1",
            {"p": policy_id},
        )
        now = datetime.utcnow()
        insert("policy_snapshots", [dict(
            policy_id=policy_id, payer_name=payer, source_url=url,
            content_hash=h, content_text=text, fetched_at=now,
        )])
        if prev and prev[0]["content_hash"] != h:
            insert("policy_changes", [dict(
                change_id=f"CHG-{uuid.uuid4().hex[:10]}", policy_id=policy_id,
                payer_name=payer, source_url=url,
                old_hash=prev[0]["content_hash"], new_hash=h,
                diff_summary=f"Policy content changed for {payer} ({policy_id}).",
                detected_at=now, processed=0,
            )])
            changes += 1
            print(f"[monitor] CHANGE detected: {policy_id}")
    return changes
