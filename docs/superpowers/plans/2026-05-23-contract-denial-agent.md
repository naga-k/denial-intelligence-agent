# Contract Denial Intelligence Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An autonomous Python LangGraph agent that monitors live payer coverage policies, and on a detected change re-scans a synthetic claims/contracts book in ClickHouse, judges which denials are contestable, and drafts a grounded contract-amendment recommendation — visualized on a Next.js + Tremor dashboard and traced live in Datadog LLM Observability.

**Architecture:** A standalone **Python agent service** runs the heartbeat loop (poll policy URLs → hash/diff → emit `policy_changes`) and a LangGraph multi-agent graph (Router → Impact Analyst → Policy Reasoner → Rec Drafter → Critic-cycle). It reads/writes **ClickHouse**; the **Next.js dashboard** only *reads* materialized views — producer/consumer decoupled via the DB. **Datadog LLM Obs** auto-instruments LangChain/LangGraph, so every node is a span for free.

**Tech Stack:** Python 3.11 (`.venv`), LangGraph + `langchain-google-genai` (Gemini `gemini-3.5-flash`), `clickhouse-connect`, `ddtrace` (Datadog LLM Obs), **ClickHouse Cloud** (TLS on port 8443), Next.js + Tremor (TypeScript), Nimble web API for live fetch (plain `requests` fallback). Stretch: ClickHouse MCP + Senso.

> **Decisions locked (2026-05-23):** Python agent runtime; Gemini `gemini-3.5-flash` (Critic may use `gemini-3.1-pro-preview`); lean Tier-1-first plan (concrete ordered steps, verify-by-running rather than strict failing-test-first). **ClickHouse Cloud** is the default datastore (we have $400 sponsor credits — using their actual cloud product strengthens the ClickHouse prize story, and the agent already depends on the network for Gemini/Nimble/Datadog so local Docker bought no real resilience). Connection is TLS on port 8443 with `secure=True`.

---

## Docs-first execution rule (READ BEFORE ANY TASK)

> **Every subagent executing a task MUST fetch the current official docs for the library/API it is about to use, BEFORE writing code. Do not rely on training-knowledge API shapes — these libraries move fast.** Use the `chub:get-api-docs` skill (preferred) or `WebFetch`/`WebSearch`. Confirm: exact model IDs, package versions, function signatures, env var names, and connection params. The code blocks in this plan are a *starting point verified on 2026-05-23* — if the live docs disagree, the live docs win; fix the code and note the delta in your commit message.

Per-task doc targets:
- **Task 1–2, 11 (ClickHouse Cloud / clickhouse-connect / MCP):** ClickHouse Cloud connection docs, `clickhouse-connect` PyPI/docs, `mcp-clickhouse` repo.
- **Task 4 (dashboard):** `@clickhouse/client` (JS) connection docs, Tremor + Next.js App Router docs.
- **Task 5 (agent):** `ai.google.dev/gemini-api/docs/models` (model IDs), `langchain-google-genai` reference (`ChatGoogleGenerativeAI`), LangGraph `StateGraph`/conditional-edges docs.
- **Task 6 (observability):** Datadog LLM Observability Python SDK setup (`ddtrace.llmobs.LLMObs.enable`, agentless).
- **Task 7 (monitor):** Nimble Web API real-time endpoint + auth header format.
- **Task 12 (Senso):** Senso API + cited.md publish endpoint.

---

## Repo / file structure

```
agentic-engineering-hack/
  agent/
    .env.example                 # GEMINI_API_KEY, CLICKHOUSE_* (Cloud), DD_*, NIMBLE_API_KEY
    requirements.txt
    schema.sql                   # ClickHouse DDL (Task 2 — THE shared contract)
    src/
      __init__.py
      config.py                  # env loading
      db.py                      # clickhouse-connect client + helpers
      seed.py                    # synthetic generator (Task 3)
      state.py                   # AgentState TypedDict + pydantic models
      observability.py           # Datadog LLM Obs enable (Task 6)
      nodes.py                   # the 5 graph node functions (Task 5)
      graph.py                   # LangGraph wiring incl. critic cycle (Task 5)
      monitor.py                 # Nimble poll/hash/diff loop (Task 7)
      run_loop.py                # heartbeat entrypoint: consume changes -> run graph (Task 8)
      mcp_clickhouse.py          # ClickHouse MCP wiring (Task 11, stretch)
      publish_senso.py           # Senso cited.md publish (Task 12, stretch)
  dashboard/                     # Next.js + Tremor (Task 4)
    app/page.tsx
    app/api/metrics/route.ts
    lib/clickhouse.ts
  demo/
    policy-page/index.html       # controllable mock payer policy page (Task 9)
```

**Build order:** Task 1→2 together (the schema is the contract between the two builders). Then Person A takes Tasks 3–4 (data + dashboard); Person B takes Tasks 5–6 (agent + Datadog). Rejoin for Tasks 7–10 (the live moment). Tasks 11–12 are stretch, cut-first.

---

## TIER 1 — must work

### Task 1: ClickHouse Cloud + project skeleton

**Files:**
- Create: `agent/requirements.txt`
- Create: `agent/.env.example`
- Create: `agent/src/__init__.py`, `agent/src/config.py`

- [ ] **Step 1: provision the ClickHouse Cloud service**

In the ClickHouse Cloud console (the $400-credit account): create a service, then copy from the **Connect** panel: the host (`<id>.<region>.<provider>.clickhouse.cloud`), the HTTPS port (**8443**), username (`default`), and the generated password. These go into `agent/.env` (Step 3). No Docker, no local server.

> **Demo warmth:** a paused/idle Cloud service cold-starts in a few seconds. Run `SELECT 1` ~1 min before presenting (Task 10) so the first demo query isn't slow.

- [ ] **Step 2: Python deps**

`agent/requirements.txt`:
```
langgraph>=0.2.0
langchain-google-genai>=4.0.0
langchain-core>=0.3.0
clickhouse-connect>=0.8.0
ddtrace>=2.18.0
python-dotenv>=1.0.0
requests>=2.32.0
pydantic>=2.0.0
```

- [ ] **Step 3: env template**

`agent/.env.example`:
```
GEMINI_API_KEY=
CLICKHOUSE_HOST=<id>.<region>.<provider>.clickhouse.cloud
CLICKHOUSE_PORT=8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DB=denials
DD_API_KEY=
DD_SITE=datadoghq.com
DD_LLMOBS_ML_APP=contract-denial-agent
NIMBLE_API_KEY=
DEMO_POLICY_URL=http://localhost:8080/index.html
```

- [ ] **Step 4: config loader** (note `secure=True` — required for the Cloud TLS endpoint on 8443)

`agent/src/config.py`:
```python
import os
from dotenv import load_dotenv
load_dotenv()

def env(key: str, default: str | None = None) -> str:
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"Missing env var: {key}")
    return val

CLICKHOUSE = dict(
    host=env("CLICKHOUSE_HOST"),
    port=int(env("CLICKHOUSE_PORT", "8443")),
    username=env("CLICKHOUSE_USER", "default"),
    password=env("CLICKHOUSE_PASSWORD"),
    database=env("CLICKHOUSE_DB", "denials"),
    secure=True,   # ClickHouse Cloud requires TLS
)
GEMINI_API_KEY = env("GEMINI_API_KEY", "")
DEMO_POLICY_URL = env("DEMO_POLICY_URL", "http://localhost:8080/index.html")
```

- [ ] **Step 5: install & verify connection** (no `denials` DB yet — that's Task 2; here we just confirm the Cloud handshake)

```bash
cd /Users/nagakarumuri/Documents/agentic-engineering-hack
python3 -m venv agent/.venv && agent/.venv/bin/pip install -r agent/requirements.txt
cp agent/.env.example agent/.env   # then fill in real Cloud host/password + keys
agent/.venv/bin/python -c "
import clickhouse_connect, os
from dotenv import load_dotenv; load_dotenv('agent/.env')
c = clickhouse_connect.get_client(host=os.environ['CLICKHOUSE_HOST'], port=8443,
    username=os.environ['CLICKHOUSE_USER'], password=os.environ['CLICKHOUSE_PASSWORD'], secure=True)
print(c.command('SELECT 1'))"
```
Expected: prints `1` — confirms TLS connection to ClickHouse Cloud.

- [ ] **Step 6: Commit**
```bash
git add agent/requirements.txt agent/.env.example agent/src/__init__.py agent/src/config.py
git commit -m "chore: clickhouse cloud connection + python skeleton + config"
```

---

### Task 2: ClickHouse schema — the shared contract

**Files:**
- Create: `agent/schema.sql`
- Create: `agent/src/db.py`

> Do this task together. Once these column names exist, both builders code against them without blocking.

- [ ] **Step 1: schema.sql** (refined from the strategic doc; `denied`/`paid` derivable from `denials` join, kept explicit for demo simplicity)

```sql
CREATE DATABASE IF NOT EXISTS denials;

CREATE TABLE IF NOT EXISTS denials.contracts (
  contract_id   String,
  payer_name    String,
  network_status Enum('in' = 1, 'out' = 2),
  effective_date Date,
  terms_summary String
) ENGINE = MergeTree ORDER BY contract_id;

CREATE TABLE IF NOT EXISTS denials.claims (
  claim_id      String,
  contract_id   String,
  payer_name    String,
  cpt_code      String,
  icd_code      String,
  billed_amount Decimal(12,2),
  date_of_service Date,
  status        Enum('submitted' = 1, 'denied' = 2, 'paid' = 3)
) ENGINE = MergeTree ORDER BY (contract_id, date_of_service);

CREATE TABLE IF NOT EXISTS denials.denials (
  denial_id     String,
  claim_id      String,
  contract_id   String,
  payer_name    String,
  carc_code     String,   -- Claim Adjustment Reason Code
  rarc_code     String,   -- Remittance Advice Remark Code
  reason_text   String,
  denied_amount Decimal(12,2),
  denied_at     DateTime
) ENGINE = MergeTree ORDER BY (contract_id, denied_at);

CREATE TABLE IF NOT EXISTS denials.policy_snapshots (
  policy_id     String,
  payer_name    String,
  source_url    String,
  content_hash  String,
  content_text  String,
  fetched_at    DateTime
) ENGINE = MergeTree ORDER BY (policy_id, fetched_at);

CREATE TABLE IF NOT EXISTS denials.policy_changes (
  change_id     String,
  policy_id     String,
  payer_name    String,
  source_url    String,
  old_hash      String,
  new_hash      String,
  diff_summary  String,
  detected_at   DateTime,
  processed     UInt8 DEFAULT 0   -- 0 = needs agent run, 1 = done
) ENGINE = MergeTree ORDER BY detected_at;

CREATE TABLE IF NOT EXISTS denials.recommendations (
  rec_id        String,
  change_id     String,
  contract_id   String,
  payer_name    String,
  trigger       String,
  rec_text      String,
  grounded_policy_url String,
  confidence    Float32,
  created_at    DateTime
) ENGINE = MergeTree ORDER BY created_at;

-- Dashboard reads THIS, not raw scans.
CREATE VIEW IF NOT EXISTS denials.denial_rate_by_contract AS
SELECT
  c.contract_id          AS contract_id,
  any(c.payer_name)      AS payer_name,
  any(c.network_status)  AS network_status,
  count(cl.claim_id)     AS total_claims,
  countIf(cl.status = 'denied') AS total_denials,
  round(countIf(cl.status = 'denied') / count(cl.claim_id), 4) AS denial_rate,
  sumIf(cl.billed_amount, cl.status = 'denied') AS dollars_at_risk
FROM denials.contracts c
LEFT JOIN denials.claims cl ON cl.contract_id = c.contract_id
GROUP BY c.contract_id;
```

- [ ] **Step 2: db.py helpers**

`agent/src/db.py`:
```python
import clickhouse_connect
from .config import CLICKHOUSE

def client():
    return clickhouse_connect.get_client(**CLICKHOUSE)

def apply_schema(path: str = "agent/schema.sql"):
    cli = clickhouse_connect.get_client(
        host=CLICKHOUSE["host"], port=CLICKHOUSE["port"],
        username=CLICKHOUSE["username"], password=CLICKHOUSE["password"],
        secure=True,   # connect without a database to CREATE DATABASE first
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
```

- [ ] **Step 3: apply & verify**
```bash
agent/.venv/bin/python -c "from agent.src.db import apply_schema; apply_schema()"
agent/.venv/bin/python -c "from agent.src.db import query_rows; print(query_rows('SHOW TABLES FROM denials'))"
```
Expected: list includes `contracts, claims, denials, policy_snapshots, policy_changes, recommendations, denial_rate_by_contract`.

- [ ] **Step 4: Commit**
```bash
git add agent/schema.sql agent/src/db.py
git commit -m "feat: clickhouse schema (shared contract) + db helpers"
```

---

### Task 3: Synthetic data generator (Person A)

**Files:**
- Create: `agent/src/seed.py`

> ~5 contracts, ~1,000 claims, ~150 denials (~13%). 2–3 contracts get **deliberate ugly patterns** tied to the monitored policies so the agent's rec is obviously sensible. No PHI.

- [ ] **Step 1: write seed.py**

`agent/src/seed.py`:
```python
import random, uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from .db import insert, client

random.seed(42)

# 5 contracts. C-AETNA-OON and C-UHC-IN carry the deliberate bleed patterns.
CONTRACTS = [
    dict(contract_id="C-AETNA-OON", payer_name="Aetna",        network_status="out", terms_summary="Out-of-network; high prior-auth burden on imaging."),
    dict(contract_id="C-UHC-IN",    payer_name="UnitedHealth", network_status="in",  terms_summary="In-network; strict medical-necessity on CPT 70553 MRI."),
    dict(contract_id="C-CIGNA-IN",  payer_name="Cigna",        network_status="in",  terms_summary="In-network; standard terms."),
    dict(contract_id="C-BCBS-IN",   payer_name="BlueCross",    network_status="in",  terms_summary="In-network; standard terms."),
    dict(contract_id="C-CMS-A",     payer_name="CMS Medicare", network_status="in",  terms_summary="LCD-governed coverage for sleep studies CPT 95810."),
]

# CARC/RARC pairs we use (real codes).
DENIAL_REASONS = [
    ("50",  "N115", "Non-covered: service not deemed medically necessary per payer policy."),
    ("197", "N210", "Precertification/authorization absent."),
    ("16",  "M51",  "Claim lacks information; missing/incorrect procedure code."),
    ("96",  "N130", "Non-covered charge; consult payer coverage policy."),
]
CPT = ["70553", "95810", "99214", "73721", "45378"]   # MRI brain, sleep study, office visit, MRI knee, colonoscopy
ICD = ["G43.909", "G47.33", "M54.5", "M25.561", "Z12.11"]

def run():
    cli = client()
    for t in ("recommendations","policy_changes","policy_snapshots","denials","claims","contracts"):
        cli.command(f"TRUNCATE TABLE IF EXISTS denials.{t}")

    insert("contracts", [
        {**c, "effective_date": date(2025, 1, 1)} for c in CONTRACTS
    ])

    claims, dens = [], []
    today = date(2026, 5, 1)
    for _ in range(1000):
        c = random.choice(CONTRACTS)
        # Ugly patterns: Aetna OON imaging + UHC MRI 70553 denied far more often.
        base_rate = 0.08
        cpt = random.choice(CPT)
        if c["contract_id"] == "C-AETNA-OON" and cpt in ("70553","73721"):
            base_rate = 0.55
        elif c["contract_id"] == "C-UHC-IN" and cpt == "70553":
            base_rate = 0.45
        denied = random.random() < base_rate
        claim_id = f"CLM-{uuid.uuid4().hex[:10]}"
        billed = Decimal(str(round(random.uniform(180, 4200), 2)))
        dos = today - timedelta(days=random.randint(0, 120))
        claims.append(dict(
            claim_id=claim_id, contract_id=c["contract_id"], payer_name=c["payer_name"],
            cpt_code=cpt, icd_code=random.choice(ICD), billed_amount=billed,
            date_of_service=dos, status="denied" if denied else random.choice(["paid","paid","submitted"]),
        ))
        if denied:
            carc, rarc, txt = random.choice(DENIAL_REASONS)
            dens.append(dict(
                denial_id=f"DEN-{uuid.uuid4().hex[:10]}", claim_id=claim_id,
                contract_id=c["contract_id"], payer_name=c["payer_name"],
                carc_code=carc, rarc_code=rarc, reason_text=txt,
                denied_amount=billed, denied_at=datetime.combine(dos, datetime.min.time()),
            ))

    insert("claims", claims)
    insert("denials", dens)
    print(f"Seeded {len(claims)} claims, {len(dens)} denials.")

if __name__ == "__main__":
    run()
```

- [ ] **Step 2: run & verify**
```bash
agent/.venv/bin/python -m agent.src.seed
agent/.venv/bin/python -c "from agent.src.db import query_rows; print(query_rows('SELECT contract_id,total_claims,total_denials,denial_rate,dollars_at_risk FROM denials.denial_rate_by_contract ORDER BY dollars_at_risk DESC'))"
```
Expected: ~150 denials; `C-AETNA-OON` and `C-UHC-IN` top the `dollars_at_risk` ranking.

- [ ] **Step 3: Commit**
```bash
git add agent/src/seed.py
git commit -m "feat: synthetic claims/denials generator with deliberate bleed patterns"
```

---

### Task 4: Next.js + Tremor dashboard (Person A)

**Files:**
- Create: `dashboard/` (Next.js app), `dashboard/lib/clickhouse.ts`, `dashboard/app/api/metrics/route.ts`, `dashboard/app/page.tsx`

- [ ] **Step 1: scaffold**
```bash
cd /Users/nagakarumuri/Documents/agentic-engineering-hack
npx create-next-app@latest dashboard --ts --app --tailwind --no-src-dir --no-eslint --use-npm --yes
cd dashboard && npm install @tremor/react @clickhouse/client
```

- [ ] **Step 2: ClickHouse reader** — `dashboard/lib/clickhouse.ts`:
```ts
import { createClient } from "@clickhouse/client";

// ClickHouse Cloud: HTTPS on 8443. Set these in dashboard/.env.local:
//   CLICKHOUSE_URL=https://<id>.<region>.<provider>.clickhouse.cloud:8443
//   CLICKHOUSE_USER=default
//   CLICKHOUSE_PASSWORD=<from console>
export const ch = createClient({
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD ?? "",
  database: "denials",
});

export async function rows<T>(query: string): Promise<T[]> {
  const rs = await ch.query({ query, format: "JSONEachRow" });
  return rs.json<T>();
}
```

- [ ] **Step 3: metrics API** — `dashboard/app/api/metrics/route.ts`:
```ts
import { rows } from "@/lib/clickhouse";
export const dynamic = "force-dynamic";

export async function GET() {
  const byContract = await rows(
    `SELECT contract_id, payer_name, network_status, total_claims, total_denials,
            denial_rate, toFloat64(dollars_at_risk) AS dollars_at_risk
     FROM denials.denial_rate_by_contract ORDER BY dollars_at_risk DESC`
  );
  const recs = await rows(
    `SELECT rec_id, contract_id, payer_name, trigger, rec_text,
            grounded_policy_url, confidence, created_at
     FROM denials.recommendations ORDER BY created_at DESC LIMIT 20`
  );
  const changes = await rows(
    `SELECT change_id, payer_name, source_url, diff_summary, detected_at, processed
     FROM denials.policy_changes ORDER BY detected_at DESC LIMIT 10`
  );
  return Response.json({ byContract, recs, changes });
}
```

- [ ] **Step 4: dashboard page** — `dashboard/app/page.tsx` (Tremor BarChart of $-at-risk per contract, a recs feed, a policy-change feed; polls `/api/metrics` every 3s so the live moment appears without refresh):
```tsx
"use client";
import { useEffect, useState } from "react";
import { Card, Title, BarChart, Badge } from "@tremor/react";

export default function Page() {
  const [data, setData] = useState<any>({ byContract: [], recs: [], changes: [] });
  useEffect(() => {
    const tick = () => fetch("/api/metrics").then(r => r.json()).then(setData);
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <main className="p-8 space-y-6 max-w-6xl mx-auto">
      <Title>Contract Denial Intelligence — live</Title>
      <Card>
        <Title>Dollars at risk by contract</Title>
        <BarChart data={data.byContract} index="contract_id"
          categories={["dollars_at_risk"]} valueFormatter={(v) => `$${v.toLocaleString()}`} />
      </Card>
      <Card>
        <Title>Agent recommendations ({data.recs.length})</Title>
        {data.recs.map((r: any) => (
          <div key={r.rec_id} className="border-t py-3">
            <div className="flex gap-2 items-center">
              <Badge color="emerald">{r.contract_id}</Badge>
              <span className="text-sm text-gray-500">conf {(r.confidence*100).toFixed(0)}%</span>
            </div>
            <p className="text-sm mt-1">{r.rec_text}</p>
            <a className="text-xs text-blue-600" href={r.grounded_policy_url}>grounded policy →</a>
          </div>
        ))}
      </Card>
      <Card>
        <Title>Live policy changes</Title>
        {data.changes.map((c: any) => (
          <div key={c.change_id} className="border-t py-2 text-sm">
            <Badge color={c.processed ? "gray" : "amber"}>{c.processed ? "processed" : "new"}</Badge>{" "}
            {c.payer_name}: {c.diff_summary}
          </div>
        ))}
      </Card>
    </main>
  );
}
```

- [ ] **Step 5: run & verify**
```bash
cd dashboard && npm run dev
# open http://localhost:3000 — BarChart shows C-AETNA-OON / C-UHC-IN highest. Recs/changes empty until agent runs.
```
Expected: chart renders with seeded data; no console errors.

- [ ] **Step 6: Commit**
```bash
git add dashboard
git commit -m "feat: next.js+tremor dashboard reading clickhouse views (3s poll)"
```

---

### Task 5: LangGraph multi-agent graph (Person B) — the depth

**Files:**
- Create: `agent/src/state.py`, `agent/src/nodes.py`, `agent/src/graph.py`

- [ ] **Step 1: state** — `agent/src/state.py`:
```python
from typing import TypedDict, Optional

class AgentState(TypedDict, total=False):
    change: dict            # row from policy_changes
    policy_text: str        # changed policy content (latest snapshot)
    implicated: dict        # router: {cpt_codes:[], contracts:[], summary:str}
    impact: dict            # impact analyst: {contracts:[{contract_id,denials,dollars}], total_dollars}
    contestable: dict       # policy reasoner: {verdict:str, rationale:str}
    rec_text: str           # drafter output
    confidence: float
    critique: dict          # critic: {ok:bool, feedback:str}
    revisions: int
    grounded_policy_url: str
```

- [ ] **Step 2: nodes** — `agent/src/nodes.py` (each node = one Gemini call with a focused prompt; Impact Analyst hits ClickHouse directly):
```python
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from .config import GEMINI_API_KEY
from .db import query_rows

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.2,
                             google_api_key=GEMINI_API_KEY, max_retries=2)
critic_llm = ChatGoogleGenerativeAI(model="gemini-3.1-pro-preview", temperature=0.0,
                                    google_api_key=GEMINI_API_KEY, max_retries=2)

def _json(resp_text: str) -> dict:
    t = resp_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(t)

def router(state):
    change = state["change"]
    prompt = (
        "You are a health-claims policy router. Given a payer policy change, "
        "identify which CPT codes and which of these contracts are implicated. "
        f"Policy change: {change['diff_summary']} (payer: {change['payer_name']}).\n"
        f"Changed policy text:\n{state.get('policy_text','')[:4000]}\n"
        'Return JSON: {"cpt_codes":[...],"contracts":[...],"summary":"..."}'
    )
    return {"implicated": _json(llm.invoke(prompt).content)}

def impact_analyst(state):
    cpts = state["implicated"].get("cpt_codes", [])
    cpt_list = ",".join(f"'{c}'" for c in cpts) or "''"
    rows = query_rows(f"""
        SELECT contract_id, payer_name,
               count() AS denials, toFloat64(sum(denied_amount)) AS dollars
        FROM denials.denials
        WHERE claim_id IN (SELECT claim_id FROM denials.claims WHERE cpt_code IN ({cpt_list}))
        GROUP BY contract_id, payer_name ORDER BY dollars DESC""")
    total = sum(r["dollars"] for r in rows)
    return {"impact": {"contracts": rows, "total_dollars": total}}

def policy_reasoner(state):
    prompt = (
        "You judge whether claim denials are CONTESTABLE under the payer's OWN published policy. "
        f"Changed policy text:\n{state.get('policy_text','')[:4000]}\n"
        f"Impacted contracts/denials: {json.dumps(state['impact'])}\n"
        'Return JSON: {"verdict":"contestable|legitimate|mixed","rationale":"cite the policy language"}'
    )
    return {"contestable": _json(llm.invoke(prompt).content)}

def rec_drafter(state):
    fb = state.get("critique", {}).get("feedback", "")
    prompt = (
        "Draft a concise contract-amendment recommendation (3-4 sentences) that would stop the "
        "denial bleed, grounded ONLY in the payer's published policy language. "
        f"Impact: {json.dumps(state['impact'])}\nContestability: {json.dumps(state['contestable'])}\n"
        f"Policy excerpt: {state.get('policy_text','')[:2000]}\n"
        + (f"Revise per critic feedback: {fb}\n" if fb else "")
        + 'Return JSON: {"rec_text":"...","confidence":0.0}'
    )
    out = _json(llm.invoke(prompt).content)
    return {"rec_text": out["rec_text"], "confidence": float(out.get("confidence", 0.7))}

def critic(state):
    prompt = (
        "Critique this contract-amendment rec. Is it grounded in the cited policy, specific, and sensible? "
        f"Rec: {state['rec_text']}\nPolicy excerpt: {state.get('policy_text','')[:2000]}\n"
        'Return JSON: {"ok": true|false, "feedback":"what to fix if not ok"}'
    )
    crit = _json(critic_llm.invoke(prompt).content)
    return {"critique": crit, "revisions": state.get("revisions", 0) + 1}
```

- [ ] **Step 3: graph wiring + critic cycle** — `agent/src/graph.py`:
```python
from langgraph.graph import StateGraph, END
from .state import AgentState
from . import nodes

def _after_critic(state) -> str:
    if state["critique"].get("ok") or state.get("revisions", 0) >= 2:
        return "end"
    return "revise"

def build_graph():
    g = StateGraph(AgentState)
    g.add_node("router", nodes.router)
    g.add_node("impact_analyst", nodes.impact_analyst)
    g.add_node("policy_reasoner", nodes.policy_reasoner)
    g.add_node("rec_drafter", nodes.rec_drafter)
    g.add_node("critic", nodes.critic)
    g.set_entry_point("router")
    g.add_edge("router", "impact_analyst")
    g.add_edge("impact_analyst", "policy_reasoner")
    g.add_edge("policy_reasoner", "rec_drafter")
    g.add_edge("rec_drafter", "critic")
    g.add_conditional_edges("critic", _after_critic, {"revise": "rec_drafter", "end": END})
    return g.compile()
```

- [ ] **Step 4: smoke test the graph (no monitor yet)**
```bash
agent/.venv/bin/python -c "
from agent.src.graph import build_graph
s = build_graph().invoke({
  'change': {'payer_name':'UnitedHealth','diff_summary':'CPT 70553 MRI brain now requires documented prior failed conservative therapy.'},
  'policy_text':'UnitedHealth medical policy: MRI brain (CPT 70553) is covered only with documented 6 weeks failed conservative therapy. Absent documentation, claims are non-covered (CARC 50).',
  'revisions':0})
print('REC:', s['rec_text']); print('CONF:', s['confidence']); print('REVISIONS:', s['revisions'])
"
```
Expected: a grounded rec string, confidence float, revisions 1–3. (Requires `GEMINI_API_KEY` in `agent/.env`.)

- [ ] **Step 5: Commit**
```bash
git add agent/src/state.py agent/src/nodes.py agent/src/graph.py
git commit -m "feat: langgraph multi-agent graph (router->impact->reasoner->drafter->critic cycle)"
```

---

### Task 6: Datadog LLM Observability (Person B)

**Files:**
- Create: `agent/src/observability.py`

- [ ] **Step 1: enable LLM Obs** — `agent/src/observability.py`:
```python
import os
from ddtrace.llmobs import LLMObs

def init_observability():
    if not os.getenv("DD_API_KEY"):
        print("[obs] DD_API_KEY unset — skipping Datadog LLM Obs")
        return
    LLMObs.enable(
        ml_app=os.getenv("DD_LLMOBS_ML_APP", "contract-denial-agent"),
        api_key=os.environ["DD_API_KEY"],
        site=os.getenv("DD_SITE", "datadoghq.com"),
        agentless_enabled=True,   # no local datadog-agent needed
    )
    print("[obs] Datadog LLM Obs enabled (agentless)")
```

> Enabling LLMObs auto-instruments the `langchain` integration; LangGraph nodes built on LangChain become spans automatically. Run the loop with `ddtrace-run` to be safe (Task 8).

- [ ] **Step 2: verify import**
```bash
agent/.venv/bin/python -c "from agent.src.observability import init_observability; init_observability()"
```
Expected: prints either "enabled" (if DD_API_KEY set) or "skipping".

- [ ] **Step 3: Commit**
```bash
git add agent/src/observability.py
git commit -m "feat: datadog llm observability (agentless, auto-instruments langchain)"
```

---

## TIER 2 — the win (live reaction)

### Task 7: Nimble live policy monitor (poll → hash → diff)

**Files:**
- Create: `agent/src/monitor.py`

- [ ] **Step 1: monitor** — `agent/src/monitor.py` (fetch via Nimble if `NIMBLE_API_KEY` set, else plain `requests`; hash content, diff against last snapshot, emit `policy_changes`):
```python
import hashlib, os, uuid, requests
from datetime import datetime
from .db import query_rows, insert
from .config import DEMO_POLICY_URL

# (id, payer, url). 2 real + 1 controllable. CONFIRM real URLs are login-free before locking.
TARGETS = [
    ("uhc-mri-70553", "UnitedHealth", os.getenv("DEMO_POLICY_URL", DEMO_POLICY_URL)),
    ("cms-lcd-sleep", "CMS Medicare", "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33405"),
    ("aetna-imaging", "Aetna", "https://www.aetna.com/cpb/medical/data/1_99/0001.html"),
]

def _fetch(url: str) -> str:
    key = os.getenv("NIMBLE_API_KEY")
    if key:
        r = requests.post("https://api.webit.live/api/v1/realtime/web",
                          headers={"Authorization": f"Basic {key}"},
                          json={"url": url, "render": True, "format": "markdown"}, timeout=30)
        r.raise_for_status()
        return r.json().get("html_content") or r.text
    return requests.get(url, timeout=20).text

def poll_once() -> int:
    changes = 0
    for policy_id, payer, url in TARGETS:
        try:
            text = _fetch(url)
        except Exception as e:
            print(f"[monitor] fetch failed {url}: {e}")
            continue
        h = hashlib.sha256(text.encode()).hexdigest()
        prev = query_rows(
            "SELECT content_hash FROM denials.policy_snapshots WHERE policy_id={p:String} "
            "ORDER BY fetched_at DESC LIMIT 1", {"p": policy_id})
        now = datetime.utcnow()
        insert("policy_snapshots", [dict(policy_id=policy_id, payer_name=payer, source_url=url,
                                         content_hash=h, content_text=text, fetched_at=now)])
        if prev and prev[0]["content_hash"] != h:
            insert("policy_changes", [dict(
                change_id=f"CHG-{uuid.uuid4().hex[:10]}", policy_id=policy_id, payer_name=payer,
                source_url=url, old_hash=prev[0]["content_hash"], new_hash=h,
                diff_summary=f"Policy content changed for {payer} ({policy_id}).",
                detected_at=now, processed=0)])
            changes += 1
            print(f"[monitor] CHANGE detected: {policy_id}")
    return changes
```

- [ ] **Step 2: verify (first run records baseline snapshots, no changes)**
```bash
agent/.venv/bin/python -c "from agent.src.monitor import poll_once; print('changes:', poll_once())"
```
Expected: `changes: 0` first run (baseline). Edit `demo/policy-page/index.html` (Task 9) then re-run → `changes: 1`.

- [ ] **Step 3: Commit**
```bash
git add agent/src/monitor.py
git commit -m "feat: nimble policy monitor (poll, hash, diff, emit policy_changes)"
```

---

### Task 8: Heartbeat loop — wire monitor → graph → recommendations

**Files:**
- Create: `agent/src/run_loop.py`

- [ ] **Step 1: run_loop** — `agent/src/run_loop.py`:
```python
import time, uuid
from datetime import datetime
from .observability import init_observability
from .monitor import poll_once
from .graph import build_graph
from .db import query_rows, insert, client

def latest_policy_text(policy_id: str) -> str:
    rows = query_rows("SELECT content_text FROM denials.policy_snapshots "
                      "WHERE policy_id={p:String} ORDER BY fetched_at DESC LIMIT 1", {"p": policy_id})
    return rows[0]["content_text"] if rows else ""

def process_unhandled(graph):
    pending = query_rows("SELECT * FROM denials.policy_changes WHERE processed=0 ORDER BY detected_at")
    for ch in pending:
        state = graph.invoke({
            "change": ch, "policy_text": latest_policy_text(ch["policy_id"]),
            "grounded_policy_url": ch["source_url"], "revisions": 0})
        impacted = state.get("impact", {}).get("contracts", [{}])
        contract_id = impacted[0].get("contract_id", "UNKNOWN") if impacted else "UNKNOWN"
        insert("recommendations", [dict(
            rec_id=f"REC-{uuid.uuid4().hex[:10]}", change_id=ch["change_id"],
            contract_id=contract_id, payer_name=ch["payer_name"], trigger=ch["diff_summary"],
            rec_text=state.get("rec_text", ""), grounded_policy_url=ch["source_url"],
            confidence=state.get("confidence", 0.0), created_at=datetime.utcnow())])
        client().command(
            "ALTER TABLE denials.policy_changes UPDATE processed=1 WHERE change_id=%(c)s",
            parameters={"c": ch["change_id"]})
        print(f"[loop] processed {ch['change_id']} -> rec for {contract_id}")

def main(interval=10):
    init_observability()
    graph = build_graph()
    print("[loop] heartbeat started")
    while True:
        poll_once()
        process_unhandled(graph)
        time.sleep(interval)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: run the heartbeat (instrumented)**
```bash
cd agent && .venv/bin/ddtrace-run .venv/bin/python -m src.run_loop
```
Expected: `[obs] enabled` (if DD set), `[loop] heartbeat started`, polls every 10s. On a demo-page edit it prints `CHANGE detected` then `processed ... -> rec`.

- [ ] **Step 3: Commit**
```bash
git add agent/src/run_loop.py
git commit -m "feat: heartbeat loop wiring monitor->graph->recommendations + datadog"
```

---

### Task 9: Controllable demo policy page

**Files:**
- Create: `demo/policy-page/index.html`

- [ ] **Step 1: mock payer policy page** — `demo/policy-page/index.html`:
```html
<!doctype html><html><head><meta charset="utf-8"><title>UnitedHealth Medical Policy — MRI Brain (CPT 70553)</title></head>
<body style="font-family:Georgia,serif;max-width:760px;margin:40px auto;line-height:1.6">
<h1>UnitedHealth Medical Policy</h1>
<h2>MRI Brain — CPT 70553</h2>
<p id="coverage"><strong>Coverage:</strong> MRI of the brain (CPT 70553) is covered when ordered
for evaluation of persistent headache after clinical examination. No prior conservative therapy
documentation is required.</p>
<p>Effective date: 2026-01-01. CARC 50 applies only to clearly cosmetic indications.</p>
</body></html>
```

- [ ] **Step 2: serve it & point the monitor at it**
```bash
cd demo/policy-page && python3 -m http.server 8080
# ensure agent/.env DEMO_POLICY_URL=http://localhost:8080/index.html
```
Expected: page loads at http://localhost:8080/index.html.

- [ ] **Step 3: the live edit (this is the on-stage move)** — change the `#coverage` paragraph to the *restrictive* version, e.g.:
> Coverage: MRI brain (CPT 70553) is covered **only with documented 6 weeks of failed conservative therapy**. Absent documentation, claims are **non-covered (CARC 50)**.

Then within one poll cycle the monitor detects the diff → agent drafts a rec. Verify a new row appears in the dashboard recs feed.

- [ ] **Step 4: Commit**
```bash
git add demo/policy-page/index.html
git commit -m "feat: controllable mock payer policy page for live demo"
```

---

### Task 10: End-to-end dry run + demo rehearsal

- [ ] **Step 1: full stack up** — ClickHouse Cloud is already running (warm it: `agent/.venv/bin/python -c "from agent.src.db import client; print(client().command('SELECT 1'))"`). Then 3 terminals: `cd demo/policy-page && python3 -m http.server 8080`; `cd agent && .venv/bin/ddtrace-run .venv/bin/python -m src.run_loop`; `cd dashboard && npm run dev`.
- [ ] **Step 2: seed fresh** — `agent/.venv/bin/python -m agent.src.seed`.
- [ ] **Step 3: baseline poll** — wait one cycle (changes:0). Confirm dashboard chart shows bleed ranking.
- [ ] **Step 4: trigger** — edit the demo page restrictive. Within ~10s: monitor logs CHANGE, loop logs a rec, dashboard recs feed updates, Datadog shows the graph trace with the critic cycle.
- [ ] **Step 5: time it** — run the 3-min demo script from `docs/implementation-plan.md`. Confirm the live moment lands under 60s.
- [ ] **Step 6: Commit** any tweaks: `git commit -am "chore: e2e dry run fixes"`.

---

## TIER 3 — stretch (cut-first, decide at ~4h)

### Task 11: ClickHouse MCP for the Impact Analyst (NL → SQL on stage)

**Files:** Modify `agent/src/nodes.py` (swap the hard-coded SQL in `impact_analyst` for an MCP tool call), create `agent/src/mcp_clickhouse.py`.

- [ ] **Step 1:** `pip install langchain-mcp-adapters mcp-clickhouse` and run the ClickHouse MCP server pointed at the **Cloud** instance (same host/8443/secure creds from `agent/.env`). The official `mcp-clickhouse` server takes these via env — confirm exact var names from its repo (docs-first rule).
- [ ] **Step 2:** load MCP tools via `langchain_mcp_adapters.client.MultiServerMCPClient`, bind to a small ReAct sub-agent inside `impact_analyst` so it generates SQL from natural language.
- [ ] **Step 3:** verify the analyst answers "which contracts bleed most on CPT 70553?" via MCP. Keep the Task-5 direct-SQL path as fallback. Commit.

### Task 12: Senso publish to cited.md

**Files:** Create `agent/src/publish_senso.py`, add a `publisher` node + edge after the critic passes.

- [ ] **Step 1:** confirm Senso API + cited.md endpoint and key.
- [ ] **Step 2:** add `publisher` node that posts the grounded rec; add `g.add_edge` from the critic's `end` branch to `publisher` (or a second conditional). Verify a published URL is stored on the recommendation. Commit.

---

## Open item to verify before locking the monitor (from strategic doc)
- [ ] Confirm the two **real** policy URLs in `monitor.py` (`TARGETS`) are publicly fetchable without login. If a real URL needs auth, replace it with another login-free CMS/commercial policy page. The controllable demo page is the only one edited on stage.

## Self-review notes
- **Spec coverage:** schema (Task 2) ✓, synthetic data with ugly patterns (Task 3) ✓, dashboard from materialized view (Task 4) ✓, agent loop + critic cycle (Task 5) ✓, Datadog LLM Obs (Task 6) ✓, Nimble monitor (Task 7) ✓, heartbeat wiring (Task 8) ✓, controllable demo page (Task 9) ✓, demo rehearsal (Task 10) ✓, MCP + Senso stretch (Tasks 11–12) ✓.
- **Type consistency:** `change_id`/`contract_id`/`confidence`/`grounded_policy_url` names match across `recommendations` schema, `run_loop.py` insert, and the dashboard query.
- **Known assumptions to confirm at build time:** exact Nimble realtime endpoint/auth header; ClickHouse MCP server package name; Senso cited.md endpoint. Each is isolated to one file so a wrong guess is cheap to fix.
