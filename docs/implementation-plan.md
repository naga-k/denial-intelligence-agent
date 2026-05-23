# Implementation Plan — Contract Denial Intelligence Agent

For the Agentic Engineering Hack (Datadog NYC). Team of 2, ~5.5 hr build,
3-min demo. This is the working doc both of us build against.

## The product in one line

An autonomous agent that **monitors real payer coverage policies on the open
web**; when a policy changes, it re-scans the claims/contracts book, flags which
claims just became deniable or newly contestable, ranks the contracts that bleed
the most, and drafts a grounded contract-amendment recommendation. Runs on its
own loop, no human in the seat. Live dashboard + Datadog trace show it thinking.

## Core architecture (the heartbeat is LIVE policy monitoring)

```
Nimble policy monitor (live)            Synthetic data (no PHI)
  polls N payer-policy URLs              claims + contracts + denials
  hashes + diffs content                 seeded into ClickHouse
        |                                        |
        v                                        |
  policy_change event ----> AGENT (Gemini) <-----+
                              |  - read changed policy (Nimble)
                              |  - query ClickHouse: which contracts/claims hit?
                              |  - judge contestable? vs payer's own rule
                              |  - draft amendment recommendation (grounded)
                              v
                          ClickHouse  ----> live dashboard
                          (denials by contract, rate, $ at risk, recs)
                              |
                              v
                    Datadog LLM Obs traces every decision (showpiece)
                              |
                              v
                  (stretch) Senso -> cited.md publish of the rec
```

Why this shape: the autonomy criterion is "acts on **real-time data** without
manual intervention." A real policy change on the open web is the live signal.
Synthetic claims are just the backdrop (no PHI). This also satisfies the brief's
"real action on the open web" via the **monitor** verb.

## How it maps to the judging criteria (each ~20%)

- **Idea** — $48B problem, FDE-validated, contract-level wedge. Strongest axis.
- **Autonomy** — live policy change triggers an autonomous re-scan + rec. No keyboard.
- **Tech** — ClickHouse materialized views (sub-second dashboard) + agent loop + diffing monitor.
- **Tool Use** — ClickHouse + Nimble + Datadog (+ Gemini, + Senso stretch). 3+ sponsors.
- **Demo** — a real external page changes and the agent reacts live in seconds.

Sponsor prizes: Nimble (real live-web research, not toy queries — we hit real
payer policies); ClickHouse (impact story + agent-facing analytics via their MCP);
Senso (only if we publish to cited.md); Datadog (host, instrument with LLM Obs).

## Build tiers (priority order)

**Tier 1 — must work (the core, do first):**
- ClickHouse schema + synthetic data seeded.
- Live dashboard reading denials-by-contract from a materialized view.
- Agent loop that reasons over a denial/contract and writes a recommendation.
- Datadog LLM Obs instrumentation so the decision graph is visible.

**Tier 2 — the win (what makes us competitive, do second):**
- Nimble live policy monitor: poll URLs, hash/diff, write policy_change events.
- Wire policy_change -> agent re-scan -> grounded recommendation.
- The controllable demo page (see Demo section) so the reaction is live on stage.

**Tier 3 — stretch (only if Tier 1+2 solid):**
- Senso publish of the grounded rec to cited.md (adds the "publish" verb + prize).
- ClickHouse MCP so the agent queries analytics in natural language on stage.

## Division of labor (2 people, parallel after schema is locked)

**Person A — data + dashboard**
- Synthetic generator: claims, contracts (in/out of network), denials with real
  CARC/RARC reason codes, ICD/CPT codes, $ amounts.
- ClickHouse schema + ingestion + materialized views.
- Live dashboard (denials per contract, denial rate, $ at risk, recs table).

**Person B — agent + monitor**
- Nimble policy monitor loop (poll, hash, diff, emit change events).
- Agent (Gemini via Google ADK so Datadog auto-instruments it): read policy,
  query ClickHouse, judge contestability, draft amendment rec.
- Datadog LLM Obs wiring.

**First 30 min, together:** lock the ClickHouse schema below. It is the contract
between the two of us. Once fixed, build in parallel without blocking.

## Starter ClickHouse schema (the contract — refine together)

```sql
-- contracts a provider has with payers
contracts(
  contract_id String, payer_name String,
  network_status Enum('in','out'), effective_date Date,
  terms_summary String )

-- claims submitted (synthetic, no PHI)
claims(
  claim_id String, contract_id String, payer_name String,
  cpt_code String, icd_code String, billed_amount Decimal,
  date_of_service Date, status Enum('submitted','denied','paid') )

-- denial events
denials(
  denial_id String, claim_id String, contract_id String, payer_name String,
  carc_code String, rarc_code String, reason_text String,
  denied_amount Decimal, denied_at DateTime )

-- live policy snapshots pulled via Nimble
policy_snapshots(
  policy_id String, payer_name String, source_url String,
  content_hash String, content_text String, fetched_at DateTime )

-- detected policy changes (the live trigger)
policy_changes(
  change_id String, policy_id String, payer_name String, source_url String,
  old_hash String, new_hash String, diff_summary String, detected_at DateTime )

-- agent output
recommendations(
  rec_id String, contract_id String, payer_name String,
  trigger String, rec_text String, grounded_policy_url String,
  confidence Float32, created_at DateTime )

-- materialized view: the dashboard reads THIS, not raw scans
denial_rate_by_contract(
  contract_id, payer_name, total_claims, total_denials,
  denial_rate, dollars_at_risk )
```

## Demo script (3 min)

1. **The bleed (20s):** $48B lost, 35-60% of denials never fought. Why now.
2. **Dashboard alive (20s):** pre-seeded denials, contracts ranked by $ bleed.
   The agent has already been running, "N denials processed, M recs."
3. **The moment (60s):** teammate edits the controllable payer-policy page ->
   Nimble fetches it (real HTTP) -> agent detects the diff -> re-scans claims ->
   flags newly-deniable claims -> drafts an amendment rec. Datadog graph shows
   the reasoning live.
4. **Punchline (20s):** the rec is grounded in the payer's own published policy,
   and nobody touched the keyboard.
5. **Honesty + close (20s):** "In production this monitors real payer portals via
   Nimble; for the demo we control one source page so you can watch it react."

### The controllable demo page
Host a mock "payer coverage policy" page (GitHub Pages or a tiny site). The
monitor also watches 2-3 **real** payer policy URLs (proves real-web capability,
shown pre-demo). On stage, only the controllable page is edited so the live
reaction lands inside the 3 minutes. The fetch + diff + reaction are all real;
we only control the timing.

## Honesty framing (non-negotiable)
- Claims/denials are synthetic. State it. No PHI, by design.
- The on-stage policy change is on a page we control. State it.
- Everything else (the fetch, the diff, the agent reasoning, the analytics) is real.

## Risks + mitigations
- **Weak-looking recs** -> pre-define 3-4 contracts with obvious denial patterns
  so the agent's recommendation is clearly sensible.
- **Live fetch flaky on venue wifi** -> cache last-known snapshots; the diff still
  works against the controllable page even if a real URL times out.
- **Scope creep** -> Tier 3 is cut the moment Tier 1+2 isn't rock solid.

## Open decisions (for Naga to think through)
- [ ] Dashboard tech: Streamlit (fastest) vs Next.js (prettier) vs ClickHouse-native UI.
- [ ] Agent framework: Google ADK (Datadog auto-instrument) vs plain loop + manual spans.
- [ ] Which real payer policies to monitor (pick 2-3 with clean, public coverage pages).
- [ ] Synthetic data volume + how many contracts to seed.
- [ ] Do we attempt Senso (Tier 3) at all, given time.
```
