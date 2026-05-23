// Fake data mirroring the ClickHouse schema. Swap getContracts() etc.
// for real API/MCP calls when the backend is ready.

export type NetworkStatus = "in-network" | "out-of-network"
export type RecStatus = "new" | "in-review" | "accepted" | "dismissed"

export interface Contract {
  id: string
  payer: string
  network: NetworkStatus
  totalClaims: number
  denials: number
  denialRate: number // percent
  dollarsAtRisk: number
  recCount: number
}

export interface DenialReason {
  code: string
  label: string
  count: number
  fill: string
}

export interface MonthlyPoint {
  month: string
  medicareAdv: number
  blueCross: number
  unitedHealth: number
}

export interface Recommendation {
  id: string
  contractId: string
  payer: string
  trigger: string
  recommendation: string
  policyUrl: string
  confidence: number
  status: RecStatus
  createdAt: string
}

// ── Contracts ──────────────────────────────────────────────────────────────

export const contracts: Contract[] = [
  {
    id: "C-007",
    payer: "Medicare Adv.",
    network: "in-network",
    totalClaims: 1890,
    denials: 312,
    denialRate: 16.5,
    dollarsAtRisk: 521000,
    recCount: 5,
  },
  {
    id: "C-002",
    payer: "Blue Cross",
    network: "in-network",
    totalClaims: 2100,
    denials: 231,
    denialRate: 11.0,
    dollarsAtRisk: 412200,
    recCount: 2,
  },
  {
    id: "C-003",
    payer: "UnitedHealth",
    network: "out-of-network",
    totalClaims: 890,
    denials: 178,
    denialRate: 20.0,
    dollarsAtRisk: 389000,
    recCount: 4,
  },
  {
    id: "C-001",
    payer: "Aetna",
    network: "in-network",
    totalClaims: 1240,
    denials: 187,
    denialRate: 15.1,
    dollarsAtRisk: 284500,
    recCount: 3,
  },
  {
    id: "C-006",
    payer: "Anthem",
    network: "out-of-network",
    totalClaims: 430,
    denials: 98,
    denialRate: 22.8,
    dollarsAtRisk: 245800,
    recCount: 3,
  },
  {
    id: "C-005",
    payer: "Humana",
    network: "in-network",
    totalClaims: 720,
    denials: 122,
    denialRate: 16.9,
    dollarsAtRisk: 167400,
    recCount: 2,
  },
  {
    id: "C-004",
    payer: "Cigna",
    network: "in-network",
    totalClaims: 1560,
    denials: 140,
    denialRate: 9.0,
    dollarsAtRisk: 198600,
    recCount: 1,
  },
]

// ── KPI summaries ──────────────────────────────────────────────────────────

export const kpis = {
  totalDollarsAtRisk: contracts.reduce((s, c) => s + c.dollarsAtRisk, 0),
  totalDenials: contracts.reduce((s, c) => s + c.denials, 0),
  avgDenialRate:
    contracts.reduce((s, c) => s + c.denialRate, 0) / contracts.length,
  totalRecs: contracts.reduce((s, c) => s + c.recCount, 0),
  totalClaims: contracts.reduce((s, c) => s + c.totalClaims, 0),
}

// ── CARC reason code breakdown ─────────────────────────────────────────────

export const denialReasons: DenialReason[] = [
  { code: "CO-50", label: "Medical Necessity", count: 432, fill: "#45A89A" },
  { code: "CO-4",  label: "Incorrect Modifier", count: 248, fill: "#8DD4C3" },
  { code: "CO-97", label: "Bundled Service",   count: 196, fill: "#5B8C6B" },
  { code: "CO-29", label: "Timely Filing",      count: 143, fill: "#2E9E8E" },
  { code: "CO-16", label: "Missing Info",       count: 94,  fill: "#D4915B" },
  { code: "CO-22", label: "COB Adjustment",     count: 87,  fill: "#7B6BAB" },
  { code: "Other", label: "Other CARC",         count: 68,  fill: "#4A5568" },
]

// ── Monthly $ at risk trend (top 3 contracts, last 7 months) ───────────────

export const monthlyTrend: MonthlyPoint[] = [
  { month: "Nov",  medicareAdv: 62000, blueCross: 48000, unitedHealth: 41000 },
  { month: "Dec",  medicareAdv: 67000, blueCross: 52000, unitedHealth: 38000 },
  { month: "Jan",  medicareAdv: 71000, blueCross: 56000, unitedHealth: 45000 },
  { month: "Feb",  medicareAdv: 78000, blueCross: 61000, unitedHealth: 49000 },
  { month: "Mar",  medicareAdv: 85000, blueCross: 65000, unitedHealth: 55000 },
  { month: "Apr",  medicareAdv: 91000, blueCross: 69000, unitedHealth: 59000 },
  { month: "May",  medicareAdv: 98000, blueCross: 74000, unitedHealth: 64000 },
]

// ── Recommendations ────────────────────────────────────────────────────────

export const recommendations: Recommendation[] = [
  {
    id: "REC-001",
    contractId: "C-007",
    payer: "Medicare Adv.",
    trigger: "CO-50 spike — 89 denials in 30d",
    recommendation:
      "Add CPT-ICD specificity clause for 99213/99214 with Z87.39. Current language is silent on diagnosis specificity; aligns with MAC LCD L38578.",
    policyUrl: "#",
    confidence: 0.91,
    status: "new",
    createdAt: "2026-05-22T14:31:00Z",
  },
  {
    id: "REC-002",
    contractId: "C-003",
    payer: "UnitedHealth",
    trigger: "CO-97 cluster — 54 modifier-59 disputes",
    recommendation:
      "Negotiate explicit unbundling language for therapeutic radiology (77300+77315) in §4.2. UHC policy UHC-P-2024-068 permits modifier 59 for separate sessions — contract conflicts.",
    policyUrl: "#",
    confidence: 0.87,
    status: "in-review",
    createdAt: "2026-05-21T09:14:00Z",
  },
  {
    id: "REC-003",
    contractId: "C-006",
    payer: "Anthem",
    trigger: "CO-29 timely filing — 38 out-of-window denials",
    recommendation:
      "Define the submission window explicitly in §6 — current language references 'payer guidelines' without a hard date. Anthem's BCN-2025-004 specifies 180 days; contract should match.",
    policyUrl: "#",
    confidence: 0.83,
    status: "new",
    createdAt: "2026-05-22T11:02:00Z",
  },
  {
    id: "REC-004",
    contractId: "C-001",
    payer: "Aetna",
    trigger: "CO-4 modifier denials — 29 claims, modifier-25 disputes",
    recommendation:
      "Add modifier-25 pre-authorization carve-out language for E&M services on the same day as a procedure. Aetna's CG-MED-103 requires this; contract §3.1 is silent.",
    policyUrl: "#",
    confidence: 0.79,
    status: "accepted",
    createdAt: "2026-05-20T16:45:00Z",
  },
  {
    id: "REC-005",
    contractId: "C-002",
    payer: "Blue Cross",
    trigger: "CO-50 medical necessity — 61 MRI denials",
    recommendation:
      "Reference BCBS medical policy MRI-2025-07 directly in contract §5 for musculoskeletal imaging criteria. Current language defers to 'BCBS clinical policies' without a version lock.",
    policyUrl: "#",
    confidence: 0.76,
    status: "new",
    createdAt: "2026-05-23T08:20:00Z",
  },
  {
    id: "REC-006",
    contractId: "C-007",
    payer: "Medicare Adv.",
    trigger: "CO-16 missing info — 44 denials on home health claims",
    recommendation:
      "Require face-to-face encounter documentation checklist in the billing workflow for G0180/G0179. MAC CGS requires physician certification within 30 days; claims are missing the linkage.",
    policyUrl: "#",
    confidence: 0.88,
    status: "in-review",
    createdAt: "2026-05-21T13:55:00Z",
  },
]
