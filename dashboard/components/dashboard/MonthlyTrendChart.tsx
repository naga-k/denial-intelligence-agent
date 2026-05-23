"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { monthlyTrend, type MonthlyPoint } from "@/lib/fake-data"

const chartConfig: ChartConfig = {
  medicareAdv:  { label: "Medicare Adv.",  color: "#45A89A" },
  blueCross:    { label: "Blue Cross",     color: "#8DD4C3" },
  unitedHealth: { label: "UnitedHealth",   color: "#D4915B" },
}

function formatDollar(v: number) {
  return `$${(v / 1000).toFixed(0)}k`
}

export function MonthlyTrendChart({ data = monthlyTrend }: { data?: MonthlyPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradMedicare" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#45A89A" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#45A89A" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#8DD4C3" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#8DD4C3" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradUnited" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#D4915B" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#D4915B" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(242,237,228,0.55)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(242,237,228,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
          tickFormatter={formatDollar}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                <span key="v" className="font-semibold text-cream">
                  ${Number(value).toLocaleString()}
                </span>,
                name,
              ]}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="medicareAdv"
          stroke="#45A89A"
          strokeWidth={2}
          fill="url(#gradMedicare)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="blueCross"
          stroke="#8DD4C3"
          strokeWidth={2}
          fill="url(#gradBlue)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="unitedHealth"
          stroke="#D4915B"
          strokeWidth={2}
          fill="url(#gradUnited)"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
