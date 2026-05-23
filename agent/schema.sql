CREATE DATABASE IF NOT EXISTS denials;

CREATE TABLE IF NOT EXISTS denials.contracts (
  contract_id    String,
  payer_name     String,
  network_status Enum('in' = 1, 'out' = 2),
  effective_date Date,
  terms_summary  String
) ENGINE = MergeTree ORDER BY contract_id;

CREATE TABLE IF NOT EXISTS denials.claims (
  claim_id        String,
  contract_id     String,
  payer_name      String,
  cpt_code        String,
  icd_code        String,
  billed_amount   Decimal(12,2),
  date_of_service Date,
  status          Enum('submitted' = 1, 'denied' = 2, 'paid' = 3)
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
  policy_id    String,
  payer_name   String,
  source_url   String,
  content_hash String,
  content_text String,
  fetched_at   DateTime
) ENGINE = MergeTree ORDER BY (policy_id, fetched_at);

CREATE TABLE IF NOT EXISTS denials.policy_changes (
  change_id    String,
  policy_id    String,
  payer_name   String,
  source_url   String,
  old_hash     String,
  new_hash     String,
  diff_summary String,
  detected_at  DateTime,
  processed    UInt8 DEFAULT 0   -- 0 = needs agent run, 1 = done
) ENGINE = MergeTree ORDER BY detected_at;

CREATE TABLE IF NOT EXISTS denials.recommendations (
  rec_id              String,
  change_id           String,
  contract_id         String,
  payer_name          String,
  trigger             String,
  rec_text            String,
  grounded_policy_url String,
  confidence          Float32,
  status              Enum('new' = 1, 'in-review' = 2, 'accepted' = 3, 'dismissed' = 4) DEFAULT 'new',
  created_at          DateTime
) ENGINE = MergeTree ORDER BY created_at;

-- Dashboard reads THIS, not raw scans.  (Contract type in fake-data.ts)
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

-- CARC reason-code breakdown  (DenialReason type / ReasonCodeChart)
CREATE VIEW IF NOT EXISTS denials.denials_by_reason AS
SELECT carc_code AS code, any(reason_text) AS label, count() AS count
FROM denials.denials GROUP BY carc_code ORDER BY count DESC;

-- Monthly $-at-risk per payer  (MonthlyPoint type / MonthlyTrendChart)
CREATE VIEW IF NOT EXISTS denials.monthly_dollars_at_risk AS
SELECT formatDateTime(denied_at, '%b') AS month,
       toStartOfMonth(denied_at)       AS month_start,
       payer_name,
       sum(denied_amount)              AS dollars_at_risk
FROM denials.denials
GROUP BY month, month_start, payer_name
ORDER BY month_start;
