"""Synthetic claims/contracts/denials. No PHI.

Aligned with dashboard/lib/fake-data.ts: same contract ids, payer names, network
status, and CARC reason codes, so the live ClickHouse data resembles the mock the
dashboard already renders. Deliberate "bleed" patterns: each contract has a
signature CPT + CARC denied at an elevated rate. C-003 (UnitedHealth, OON) bleeds
on CPT 70553 MRI brain — the target of the controllable demo policy page.
"""
import random
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from .db import insert, client

random.seed(42)

CONTRACTS = [
    dict(contract_id="C-007", payer_name="Medicare Adv.", network_status="in",  rate=0.165, sig_carc="CO-50", sig_cpt="99214", terms_summary="In-network; LCD-governed medical necessity on E&M and home health."),
    dict(contract_id="C-002", payer_name="Blue Cross",    network_status="in",  rate=0.11,  sig_carc="CO-50", sig_cpt="70553", terms_summary="In-network; defers to BCBS clinical policies without a version lock."),
    dict(contract_id="C-003", payer_name="UnitedHealth",  network_status="out", rate=0.20,  sig_carc="CO-50", sig_cpt="70553", terms_summary="Out-of-network; strict medical-necessity on CPT 70553 MRI brain."),
    dict(contract_id="C-001", payer_name="Aetna",         network_status="in",  rate=0.151, sig_carc="CO-4",  sig_cpt="99213", terms_summary="In-network; modifier-25 carve-out unspecified for same-day E&M."),
    dict(contract_id="C-006", payer_name="Anthem",        network_status="out", rate=0.228, sig_carc="CO-29", sig_cpt="73721", terms_summary="Out-of-network; submission window references payer guidelines, no hard date."),
    dict(contract_id="C-005", payer_name="Humana",        network_status="in",  rate=0.169, sig_carc="CO-97", sig_cpt="77300", terms_summary="In-network; bundling rules for therapeutic radiology unspecified."),
    dict(contract_id="C-004", payer_name="Cigna",         network_status="in",  rate=0.09,  sig_carc="CO-16", sig_cpt="45378", terms_summary="In-network; standard terms."),
]

# CARC -> (RARC, short label). Labels match dashboard ReasonCodeChart.
REASONS = {
    "CO-50": ("N115", "Medical Necessity"),
    "CO-4":  ("M51",  "Incorrect Modifier"),
    "CO-97": ("N130", "Bundled Service"),
    "CO-29": ("N211", "Timely Filing"),
    "CO-16": ("M51",  "Missing Info"),
    "CO-22": ("N130", "COB Adjustment"),
}
ALL_CARC = list(REASONS.keys())
CPTS = ["70553", "73721", "99213", "99214", "77300", "77315", "45378"]
ICDS = ["G43.909", "G47.33", "M54.5", "M25.561", "Z12.11", "Z87.39"]

CLAIMS_PER_CONTRACT = 170  # ~1190 claims total
SIG_FREQ = 0.20   # share of a contract's claims that are its signature CPT
SIG_MULT = 2.0    # signature CPT denied at 2x the contract's baseline
# Normalizer so the blended denial rate stays at the contract's target `rate`.
_BLEND = SIG_FREQ * SIG_MULT + (1 - SIG_FREQ)


def run():
    cli = client()
    for t in ("recommendations", "policy_changes", "policy_snapshots", "denials", "claims", "contracts"):
        cli.command(f"TRUNCATE TABLE IF EXISTS denials.{t}")

    insert("contracts", [
        dict(contract_id=c["contract_id"], payer_name=c["payer_name"],
             network_status=c["network_status"], effective_date=date(2025, 1, 1),
             terms_summary=c["terms_summary"]) for c in CONTRACTS
    ])

    claims, dens = [], []
    end = date(2026, 5, 20)
    for c in CONTRACTS:
        baseline = c["rate"] / _BLEND  # so blended rate ≈ c["rate"] (realistic target)
        others = [x for x in CPTS if x != c["sig_cpt"]]
        for _ in range(CLAIMS_PER_CONTRACT):
            is_sig = random.random() < SIG_FREQ
            cpt = c["sig_cpt"] if is_sig else random.choice(others)
            # Signature CPT bleeds at SIG_MULT× baseline, but overall stays realistic.
            p_deny = min(baseline * (SIG_MULT if is_sig else 1.0), 0.85)
            denied = random.random() < p_deny
            claim_id = f"CLM-{uuid.uuid4().hex[:10]}"
            billed = Decimal(str(round(random.uniform(180, 4200), 2)))
            dos = end - timedelta(days=random.randint(0, 200))  # ~7 months back
            claims.append(dict(
                claim_id=claim_id, contract_id=c["contract_id"], payer_name=c["payer_name"],
                cpt_code=cpt, icd_code=random.choice(ICDS), billed_amount=billed,
                date_of_service=dos,
                status="denied" if denied else random.choice(["paid", "paid", "submitted"]),
            ))
            if denied:
                carc = c["sig_carc"] if random.random() < 0.55 else random.choice(ALL_CARC)
                rarc, label = REASONS[carc]
                dens.append(dict(
                    denial_id=f"DEN-{uuid.uuid4().hex[:10]}", claim_id=claim_id,
                    contract_id=c["contract_id"], payer_name=c["payer_name"],
                    carc_code=carc, rarc_code=rarc, reason_text=label,
                    denied_amount=billed,
                    denied_at=datetime.combine(dos, datetime.min.time()),
                ))

    insert("claims", claims)
    insert("denials", dens)
    print(f"Seeded {len(claims)} claims, {len(dens)} denials across {len(CONTRACTS)} contracts.")


if __name__ == "__main__":
    run()
