# Contract Denial Intelligence Agent

Built for the **Agentic Engineering Hack** (Datadog NYC, ~5.5 hr build, 3-min demo).

## The idea

An **autonomous agent** that watches a stream of health-insurance claim denials
and, for each one, decides: was this denial legitimate under the payer's *own*
published rules, which **contract** is systematically bleeding, and what
**contract amendment** would stop the leak. It runs on its own loop with no human
in the seat. A live dashboard plus a Datadog trace show it reasoning.

Most denial tools fight claim-by-claim. We attack the **root cause at the
contract level**: find the contracts that bleed and recommend how to fix them.

Validated in person by a Luminai forward-deployed engineer (see
`docs/sponsor-notes-luminai-fde.md`).

## Why it matters (high level)

- Initial claim denial rate hit **11.8% in 2024**, up from 10.2%.
- Denials + uncompensated care = **$48B+ in losses** across 2,300 hospitals in
  2025 (up 25% from $38.6B in 2024).
- Reworking denials costs **~$20B/yr**; $25–$181 per claim.
- **35–60% of denied claims are never resubmitted** = pure lost revenue.

Full sourced breakdown: `docs/problem-stats.md`.

## Stack (sponsor tools)

```
Synthetic generator  -> claims + denials on a timer (CARC/RARC, payer,
                        contract, ICD/CPT, $). No PHI.
Agent (Gemini)       -> classify denial, pull payer policy via Nimble,
                        judge contestable?, draft contract amendment rec
ClickHouse           -> denials by contract, denial rate, reasons, $ at risk
Datadog LLM Obs      -> live trace of the agent's decision graph (showpiece)
Senso -> cited.md    -> (stretch) publish grounded amendment recs
```

- **ClickHouse** — locked. The analytics brain + live dashboard.
- **Nimble** — open-web enrichment: payer policies, ICD/CPT rules, CMS data.
- **Datadog** — agent observability (AI Agent Monitoring / LLM Obs).
- **Gemini** — agent reasoning (via Google ADK = auto-instrumented by Datadog).
- **Senso** — stretch goal.

## Repo structure

```
docs/
  problem-stats.md            <- market size / why-this-matters research
  sponsor-notes-luminai-fde.md<- notes from the Luminai FDE chat
```

## Status

Pre-build. Ideation + research done. Next: lock ClickHouse schema, then build.
