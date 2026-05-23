"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { contracts, type Contract } from "@/lib/fake-data"

function rateColor(rate: number) {
  if (rate >= 20) return "#C4716B"
  if (rate >= 15) return "#D4915B"
  if (rate >= 10) return "#C4AA5B"
  return "#45A89A"
}

const chartConfig: ChartConfig = {
  rate: { label: "Denial Rate %", color: "#45A89A" },
}

export function DenialRateChart({ data = contracts }: { data?: Contract[] }) {
  const chartData = [...data]
    .sort((a, b) => b.denialRate - a.denialRate)
    .map((c) => ({ payer: c.payer, rate: c.denialRate, network: c.network }))
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 48, left: 4, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={[0, 28]}
          tick={{ fill: "rgba(242,237,228,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="payer"
          tick={{ fill: "rgba(242,237,228,0.55)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={88}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                <span key="v" className="font-semibold text-cream">
                  {Number(value).toFixed(1)}% denial rate
                </span>,
                "",
              ]}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={rateColor(d.rate)} fillOpacity={0.88} />
          ))}
          <LabelList
            dataKey="rate"
            position="right"
            formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
            style={{ fill: "rgba(242,237,228,0.65)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
