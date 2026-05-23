"""Nimble live policy monitor: fetch -> hash -> diff -> emit policy_changes.

Fetches via the Nimble web API when NIMBLE_API_KEY is set, else plain requests
(fine for the controllable demo page). The on-stage page is the only one edited
live; the real URLs prove open-web capability but stay static during the demo.
"""
import hashlib
import os
import re
import uuid
from datetime import datetime

import requests

# Strip markup so we hash/store the VISIBLE policy text, not nonces/scripts that
# change every fetch (origin-trial tokens, session ids) and would flap the hash.
_SCRIPT_STYLE = re.compile(r"<(script|style|noscript)\b[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _normalize(html: str) -> str:
    t = _SCRIPT_STYLE.sub(" ", html)
    t = _TAG.sub(" ", t)
    return _WS.sub(" ", t).strip()

from .config import DEMO_POLICY_URL
from .db import insert, query_rows

# The controllable demo page is always monitored (static, no tokens, stable hash).
DEMO_TARGET = ("uhc-mri-70553", "UnitedHealth", os.getenv("DEMO_POLICY_URL", DEMO_POLICY_URL))

# Real payer policies are bot-protected (Incapsula) and JS-rendered — plain HTTP
# gets block pages whose hash flaps every fetch. They're only worth monitoring
# through Nimble (JS render + anti-bot), so we add them ONLY when Nimble is set.
REAL_TARGETS = [
    ("cms-lcd-sleep", "CMS Medicare", "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33405"),
    ("aetna-imaging", "Aetna", "https://www.aetna.com/cpb/medical/data/1_99/0001.html"),
]


# Set once a Nimble call returns 401 so a bad/expired key degrades gracefully to
# "watch the demo page only" instead of spamming the log every poll.
_nimble_disabled = False


def _targets():
    targets = [DEMO_TARGET]
    if os.getenv("NIMBLE_API_KEY") and not _nimble_disabled:
        targets += REAL_TARGETS
    return targets


def _fetch(url: str) -> str:
    key = os.getenv("NIMBLE_API_KEY")
    is_local = "localhost" in url or "127.0.0.1" in url
    # Nimble is a cloud service and can't reach localhost — the controllable demo
    # page is ALWAYS fetched directly. Real external pages use Nimble when keyed.
    if key and not is_local:
        r = requests.post(
            "https://api.webit.live/api/v1/realtime/web",
            headers={"Authorization": f"Bearer {key}"},
            json={"url": url, "render": True, "parse": False},
            timeout=40,
        )
        if r.status_code == 401:
            global _nimble_disabled
            _nimble_disabled = True
            raise RuntimeError(f"Nimble auth failed (401): {r.text[:120]}")
        r.raise_for_status()
        data = r.json()
        return data.get("html_content") or data.get("content") or r.text
    return requests.get(url, timeout=20).text


def poll_once() -> int:
    changes = 0
    for policy_id, payer, url in _targets():
        try:
            text = _normalize(_fetch(url))
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
