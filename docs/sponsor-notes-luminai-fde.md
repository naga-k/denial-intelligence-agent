# Sponsor notes — Luminai FDE conversation

**Date:** 2026-05-23
**Source:** In-person chat with a forward-deployed engineer (FDE) at Luminai
(you wrote "Lumen"; assuming Luminai, the healthcare-ops sponsor).
**Takeaway in one line:** he said building in this space would be great —
specifically pointed at contract-level denial analytics.

> Note: these are raw notes you took on the spot and couldn't fully decode
> afterward. Section 1 preserves them verbatim. Section 2 is my best
> interpretation with the uncertain bits flagged. Confirm or correct the
> flagged items before we build on them.

---

## 1. Raw notes (verbatim)

```
Agentic Engineer Hack Sponsor

1. Datadog - Lapdog

HL7 Codes
RCT Codes
NPPIAS API (Provider)

Centralized repo for healthcare data

Patient Note -> Diagnosis ->

Claims:
Require claims data, Contract (in-network, out of network)

Dashboard: Number of denial per contracts
Per claim denial reasons
Summary of denials in total for all denials
What are the recommendations for amendment for contracts
Denial rate per contract
```

---

## 2. Interpretation (flagged where unsure)

### Data sources / standards mentioned
- **HL7 Codes** — HL7 / FHIR, the standard for exchanging clinical data
  (patient notes, encounters, diagnoses). Public spec.
- **ICD Codes** — `[confirmed: ICD, the note's "RCT" was a mishear]`
  ICD-10 diagnosis codes. The diagnosis coding on a claim; central to whether
  a service is judged medically necessary, and therefore central to denials.
- **NPPIAS API (Provider)** — `[likely NPPES]` the National Plan & Provider
  Enumeration System NPI registry. Public API, maps providers to NPIs.
  This is the open, no-auth provider data source.

### The pipeline he sketched
```
Patient Note -> Diagnosis -> [Claim] -> [Submit] -> [Denial / Payment]
```
The arrow trailed off in the notes; the implied next steps are claim
generation, submission, and adjudication (denial or payment).

### "Centralized repo for healthcare data"
A theme he raised: one place that unifies the fragmented data. Matches
Luminai's pitch ("structure the chaos across every system").

### Claims — what's needed
- Requires **claims data** plus **contract data** (in-network vs out-of-network).
- Contracts are the join key: denials only make sense relative to the
  contract terms that should have governed payment.

### The dashboard he described (the actual feature direction)
A denial analytics dashboard keyed on **contracts**:
1. Number of denials per contract
2. Denial reasons, per claim
3. Summary of all denials in total
4. **Recommendations for contract amendments** (the agentic / value-add part)
5. Denial **rate** per contract

---

## 3. Why this matters for our build

This is a tighter, more demo-able wedge than a generic "appeal one denial"
flow. It's **contract-level denial intelligence**: aggregate denials, find
the contracts that bleed the most, and recommend specific amendment language.

- **ClickHouse fit:** denials grouped/aggregated by contract is exactly its
  strength (counts, rates, time-series per contract).
- **Agentic layer:** the "recommendations for contract amendments" step is
  the autonomous reasoning piece, not just a chart.
- **Luminai alignment:** maps directly to their "payor contract management"
  use case, validated by their own FDE.

## 4. Resolved (per Naga, 2026-05-23)
- [x] "RCT Codes" = **ICD codes**.
- [x] "Datadog - Lapdog" = a **Datadog product**. Optional for the prize, but
      we'll use it anyway. See section 5 for which one.
- [x] Data source = **search online and/or generate synthetic**. No real PHI.
- [x] Nimble = **yes, use it** (open-web enrichment layer). See section 5.

## 5. Sponsor tooling — research

### Datadog ("Lapdog" in the notes)
"Lapdog" is a mishear of a Datadog AI product. Datadog's current agentic-AI
lineup (DASH 2025 + 2026 releases):
- **AI Agent Monitoring** (GA, part of LLM Observability) — maps each agent's
  decision path (inputs, tool calls, agent-to-agent calls, outputs) as an
  interactive graph. **This is the one we want.** Instrument our agent with the
  LLM Obs SDK and the demo gets a live trace of the agent reasoning. Showpiece.
- **AI Agents Console** (preview) — governance: track agent usage, ROI,
  security/compliance risks across in-house + third-party agents.
- **Bits AI SRE / Security Analyst** — Datadog's own autonomous agents (not for
  us to build with, but phonetically "Bits" is another candidate for what the
  FDE named).
- **Datadog MCP Server** — gives agents real-time access to Datadog data.
- `[ ] confirm with the FDE which exact product he meant if it matters.`
- Plan: instrument the agent with Datadog **LLM Observability / AI Agent
  Monitoring** so judges see the decision graph. Optional for prize, free points.

### Nimble — 6 endpoints (confirmed from nimbleway.com)
- **Search** — live web search, all major sources.
- **Extract** — structured data from any page.
- **Crawl** — multi-page systematic navigation.
- **Map** — business/location data (Google Maps, Yelp, directories).
- **Agents** — orchestrates autonomous web-data teams for domain tasks.
- **Proxy** — large-scale access infra (anti-bot, proxy fabric).
- Also ships a **Claude plugin / "Web Data Toolkit"** (1.1M users) — easy agent
  wiring without writing scrapers.

**Nimble's role in the contract-denial idea:** the FDE's dashboard is mostly
internal-data driven (claims + contracts -> denials). Nimble is the open-web
enrichment that grounds the agentic part:
- Pull the **payer's published coverage / medical-necessity policy** for a
  denial reason -> is this denial even consistent with the payer's own rules?
- Pull **ICD / CPT coding policy** and payer-specific edits.
- Pull **CMS rules + public fee schedules** for underpayment / amendment context.
- Feed real, citeable policy into the **contract amendment recommendations** so
  they're grounded, not hallucinated (and publishable via Senso -> cited.md).
