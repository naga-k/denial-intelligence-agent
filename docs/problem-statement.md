# Problem Statement — Contract Denial Intelligence Agent

## The Problem

Healthcare providers lose **$48 billion or more annually** to claim denials and
uncompensated care. Denial rates hit **11.8% in 2024**, up from 10.2% just a few
years prior. Medicare Advantage denials jumped 4.8% in a single year.

The most damning stat: **35–60% of denied claims are never resubmitted.** Not
because providers believe the payer is right — but because chasing a denial
costs $25–$181 per claim in labor, and most billing teams simply don't have the
bandwidth to fight every one.

The root cause isn't bad medicine. It's a language barrier encoded in a system
of codes most people outside healthcare have never heard of.

---

## The Code Labyrinth

When a payer denies a claim, they don't say "we don't want to pay this." They
return a structured string of reason codes that providers are expected to decode,
dispute, and resubmit — correctly — or lose the revenue:

**CARC codes (Claim Adjustment Reason Codes)**
~250 standardized codes that explain *why* a payer reduced or denied a payment.
`CO-4`: service inconsistent with the modifier used. `CO-97`: service bundled
into another, no separate payment. `CO-50`: not medically necessary under the
payer's criteria. Each code implies a specific corrective action — but the
correct action for `CO-50` depends entirely on which payer's "medical necessity
policy" applies, which CPT and ICD-10 codes were on the claim, and what the
provider's contract actually says.

**RARC codes (Remittance Advice Remark Codes)**
Supplemental codes appended to CARC codes to add specificity. `N95`: incorrect
attending provider NPI. `MA13`: missing or invalid information. A denial is
usually a *pair* — CARC + RARC — and the right response depends on reading both
together.

**ICD-10 codes (International Classification of Diseases)**
A vocabulary of ~70,000 diagnosis codes. Whether a claim is "medically
necessary" — the most common denial trigger — hinges on whether the ICD-10
diagnosis on the claim is consistent with what the payer's coverage policy says
it must be. A provider submitting the right procedure for the right patient can
still be denied because the ICD-10 code selected doesn't map to the payer's
internal necessity criteria.

**CPT codes (Current Procedural Terminology)**
Procedure codes that must be simultaneously consistent with the diagnosis codes,
the modifier codes, the network status on the contract, and the payer's
fee-schedule — all at once. A single mismatch anywhere in that chain produces a
denial.

**HL7 / FHIR (the plumbing underneath)**
The exchange standard that carries patient notes, encounters, and diagnoses from
EHRs into claims. When the clinical data doesn't translate cleanly into the
claim format, the diagnosis-to-code mapping breaks — and a medically justified
service gets denied before it's even reviewed by a human.

Every payer layers its own interpretation on top of these national standards.
Their "coverage determination policies," "medical necessity criteria," and
"clinical utilization guidelines" are all publicly posted — but scattered across
dozens of portals and PDFs, updated without notice. When a payer quietly tightens
a policy, every claim under every affected contract becomes newly deniable
overnight. The provider finds out weeks later when the remittance advice arrives
full of `CO-50` codes.

That's the gap. The signals exist. The payer's own published policies are on
the open web. The CARC/RARC pattern across a contract reveals exactly which
policy is the problem. The fix — monitor policy changes live, map them to the
contracts they'll hit, draft amendment recommendations grounded in the payer's
own language — is technically within reach.

---

## Why a Hackathon?

This problem has been documented for years. The dollar amounts are not new. So
why isn't it solved? And why is a hackathon the right place to start?

**1. The tooling just became viable.**
An agent that reads live payer policy pages, compares them to a structured
denials database, reasons about contestability, and drafts grounded amendment
language requires the combination of: large-language-model reasoning, live web
monitoring at scale, and sub-second analytics on millions of claim records.
That combination wasn't practical 18 months ago. Hackathons are where "newly
possible" things get their first working proof. Established vendors are still
designing requirements docs while we have a working loop.

**2. Real clinical validation, instantly.**
We got in-person feedback from a Luminai forward-deployed engineer — someone
who works with healthcare revenue cycle teams daily — within the first hour.
He described the exact product: contract-level denial analytics, denial rate by
contract, per-claim reason codes, and amendment recommendations. That's the
kind of signal that takes months to extract through normal enterprise sales
discovery. We got it in a conversation.

**3. No PHI gating.**
Healthcare software is bottlenecked by HIPAA compliance cycles, business
associate agreements with data vendors, and security reviews that can run
6–12 months before a developer can touch real patient data. In a hackathon, a
realistic synthetic dataset — real CARC/RARC codes, real ICD-10 and CPT codes,
plausible contract structures — proves the architecture without any of that
overhead. The compliance work comes later, after the concept is validated, not
before.

**4. The sponsor tools are assembled in one room.**
Nimble for live payer policy monitoring. ClickHouse for sub-second denial
analytics and materialized contract-level views. Datadog for live agent
observability — so judges can watch the reasoning graph in real time. Getting
access to, onboarding, and integrating all three in a normal engineering cycle
takes months of procurement. Here it takes hours.

**5. The problem doesn't care about the venue.**
$48 billion in annual losses. 35–60% of denials abandoned. A fix that
technically exists but hasn't been built yet. The hackathon is the fastest path
from "this should exist" to "this exists, watch it run."

The contract-level wedge — find the contracts that bleed systematically, not
just the individual claims — is the systemic fix the industry hasn't reached
because every existing tool is optimized for claim-by-claim triage. Fixing the
contract stops the recurring bleed. That's the bet. And this is where we build it.
