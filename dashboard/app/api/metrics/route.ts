import { chQuery } from "@/lib/clickhouse";

// Always hit ClickHouse fresh — the agent writes recs continuously.
export const dynamic = "force-dynamic";

// Maps ClickHouse views -> the exact shapes in lib/fake-data.ts, so the existing
// dashboard components render real data unchanged (snake_case->camelCase,
// fraction->percent, 'in'/'out' -> 'in-network'/'out-of-network').

const PALETTE = ["#45A89A", "#8DD4C3", "#5B8C6B", "#2E9E8E", "#D4915B", "#7B6BAB", "#4A5568"];
// MonthlyPoint has fixed payer keys (top 3 by exposure in the mock).
const MONTH_KEY: Record<string, "medicareAdv" | "blueCross" | "unitedHealth"> = {
  "Medicare Adv.": "medicareAdv",
  "Blue Cross": "blueCross",
  UnitedHealth: "unitedHealth",
};

export async function GET() {
  const rawContracts = await chQuery<Record<string, unknown>>(`
    SELECT v.contract_id AS id, v.payer_name AS payer, v.network_status AS network,
           v.total_claims AS totalClaims, v.total_denials AS denials,
           round(v.denial_rate * 100, 1) AS denialRate,
           toFloat64(v.dollars_at_risk) AS dollarsAtRisk,
           (SELECT count() FROM denials.recommendations r WHERE r.contract_id = v.contract_id) AS recCount
    FROM denials.denial_rate_by_contract v
    ORDER BY dollarsAtRisk DESC`);

  const contracts = rawContracts.map((c) => ({
    id: String(c.id),
    payer: String(c.payer),
    network: c.network === "in" ? "in-network" : "out-of-network",
    totalClaims: Number(c.totalClaims),
    denials: Number(c.denials),
    denialRate: Number(c.denialRate),
    dollarsAtRisk: Number(c.dollarsAtRisk),
    recCount: Number(c.recCount),
  }));

  const kpis = {
    totalDollarsAtRisk: contracts.reduce((s, c) => s + c.dollarsAtRisk, 0),
    totalDenials: contracts.reduce((s, c) => s + c.denials, 0),
    avgDenialRate: contracts.length
      ? contracts.reduce((s, c) => s + c.denialRate, 0) / contracts.length
      : 0,
    totalRecs: contracts.reduce((s, c) => s + c.recCount, 0),
    totalClaims: contracts.reduce((s, c) => s + c.totalClaims, 0),
  };

  const reasonRows = await chQuery<Record<string, unknown>>(
    `SELECT code, label, count FROM denials.denials_by_reason LIMIT 7`
  );
  const denialReasons = reasonRows.map((r, i) => ({
    code: String(r.code),
    label: String(r.label),
    count: Number(r.count),
    fill: PALETTE[i % PALETTE.length],
  }));

  const monthlyRows = await chQuery<Record<string, unknown>>(
    `SELECT month, payer_name, toFloat64(dollars_at_risk) AS d FROM denials.monthly_dollars_at_risk`
  );
  const byMonth: Record<string, { month: string; medicareAdv: number; blueCross: number; unitedHealth: number }> = {};
  for (const row of monthlyRows) {
    const key = MONTH_KEY[String(row.payer_name)];
    if (!key) continue;
    const month = String(row.month);
    byMonth[month] ??= { month, medicareAdv: 0, blueCross: 0, unitedHealth: 0 };
    byMonth[month][key] = Number(row.d);
  }
  const monthlyTrend = Object.values(byMonth);

  const recRows = await chQuery<Record<string, unknown>>(`
    SELECT rec_id AS id, contract_id AS contractId, payer_name AS payer, trigger,
           rec_text AS recommendation, grounded_policy_url AS policyUrl,
           toFloat64(confidence) AS confidence, status, toString(created_at) AS createdAt
    FROM denials.recommendations ORDER BY created_at DESC LIMIT 20`);
  const recommendations = recRows.map((r) => ({
    id: String(r.id),
    contractId: String(r.contractId),
    payer: String(r.payer),
    trigger: String(r.trigger),
    recommendation: String(r.recommendation),
    policyUrl: String(r.policyUrl),
    confidence: Number(r.confidence),
    status: String(r.status),
    createdAt: String(r.createdAt),
  }));

  return Response.json({ contracts, kpis, denialReasons, monthlyTrend, recommendations });
}
