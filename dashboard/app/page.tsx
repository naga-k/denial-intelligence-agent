"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  DollarSign,
  FileX,
  Lightbulb,
  Activity,
} from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { DenialsByContractChart } from "@/components/dashboard/DenialsByContractChart"
import { DenialRateChart } from "@/components/dashboard/DenialRateChart"
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart"
import { ReasonCodeChart } from "@/components/dashboard/ReasonCodeChart"
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable"
import {
  contracts as fakeContracts,
  kpis as fakeKpis,
  denialReasons as fakeReasons,
  monthlyTrend as fakeMonthly,
  recommendations as fakeRecs,
} from "@/lib/fake-data"

type Metrics = {
  contracts: typeof fakeContracts
  kpis: typeof fakeKpis
  denialReasons: typeof fakeReasons
  monthlyTrend: typeof fakeMonthly
  recommendations: typeof fakeRecs
}

const FALLBACK: Metrics = {
  contracts: fakeContracts,
  kpis: fakeKpis,
  denialReasons: fakeReasons,
  monthlyTrend: fakeMonthly,
  recommendations: fakeRecs,
}

function fmt$(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

export default function DashboardPage() {
  // Seed with fake data so the first paint is never empty; then poll real data.
  const [m, setM] = useState<Metrics>(FALLBACK)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () =>
      fetch("/api/metrics")
        .then((r) => r.json())
        .then((d) => {
          if (alive) {
            setM(d)
            setLive(true)
          }
        })
        .catch(() => {})
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const kpis = m.kpis

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-verdigris/20 border border-verdigris/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-verdigris" />
            </span>
            <div>
              <h1 className="text-sm font-semibold text-cream leading-none">
                Denial Intelligence
              </h1>
              <p className="text-[10px] text-cream/40 mt-0.5 leading-none">
                Contract analytics · synthetic data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-cream/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verdigris opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-verdigris" />
              </span>
              {live ? "live · agent active" : "connecting…"}
            </span>
            <span className="text-cream/20 mx-1">·</span>
            <span className="text-xs text-cream/30">
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="$ at Risk"
            value={fmt$(kpis.totalDollarsAtRisk)}
            subtitle={`across ${kpis.totalClaims.toLocaleString()} submitted claims`}
            icon={DollarSign}
            accentClass="text-amber-warm"
            trend={{ value: "+25% YoY", up: true }}
          />
          <StatCard
            title="Total Denials"
            value={kpis.totalDenials.toLocaleString()}
            subtitle="across all active contracts"
            icon={FileX}
            accentClass="text-coral"
            trend={{ value: "+4.8%", up: true }}
          />
          <StatCard
            title="Avg Denial Rate"
            value={fmtPct(kpis.avgDenialRate)}
            subtitle="weighted across payer contracts"
            icon={AlertCircle}
            accentClass="text-amber-warm"
          />
          <StatCard
            title="Open Recs"
            value={`${kpis.totalRecs}`}
            subtitle="contract amendment recommendations"
            icon={Lightbulb}
            accentClass="text-verdigris"
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-cream">
                Denials by Contract
              </h2>
              <p className="text-xs text-cream/40 mt-0.5">
                Total denied claims per payer contract
              </p>
            </div>
            <DenialsByContractChart data={m.contracts} />
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-cream">
                Denial Rate by Contract
              </h2>
              <p className="text-xs text-cream/40 mt-0.5">
                Sorted high → low ·{" "}
                <span className="text-coral/70">&gt;20%</span> critical ·{" "}
                <span className="text-amber-warm/70">&gt;15%</span> elevated
              </p>
            </div>
            <DenialRateChart data={m.contracts} />
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-6 lg:col-span-2 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-cream">
                $ at Risk — Monthly Trend
              </h2>
              <p className="text-xs text-cream/40 mt-0.5">
                Top 3 contracts by dollar exposure, last 7 months
              </p>
            </div>
            <MonthlyTrendChart data={m.monthlyTrend} />
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-cream">
                Denial Reason Codes
              </h2>
              <p className="text-xs text-cream/40 mt-0.5">
                CARC breakdown across all contracts
              </p>
            </div>
            <ReasonCodeChart data={m.denialReasons} />
          </div>
        </div>

        {/* Recommendations table */}
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-cream">
                Contract Amendment Recommendations
              </h2>
              <p className="text-xs text-cream/40 mt-0.5">
                Agent-generated, grounded in payer policy · ranked by confidence
              </p>
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-widest text-verdigris/70 border border-verdigris/20 bg-verdigris/08 rounded-full px-2.5 py-1">
              {kpis.totalRecs} total
            </span>
          </div>
          <RecommendationsTable data={m.recommendations} />
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-cream/20 pb-4">
          All claims, contracts, and denial data are synthetic. No PHI. Built
          for Agentic Engineering Hack · Datadog NYC.
        </p>
      </main>
    </div>
  )
}
