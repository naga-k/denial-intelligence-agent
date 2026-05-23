"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { contracts } from "@/lib/fake-data"

const chartData = contracts.map((c) => ({
  payer: c.payer.replace(" Adv.", "\nAdv."),
  denials: c.denials,
  dollars: c.dollarsAtRisk,
}))

const chartConfig: ChartConfig = {
  denials: { label: "Denials", color: "#45A89A" },
}

const BAR_COLORS = [
  "#45A89A",
  "#3D9A8C",
  "#358C7E",
  "#2D7E70",
  "#257062",
  "#1D6254",
  "#155446",
]

export function DenialsByContractChart() {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="payer"
          tick={{ fill: "rgba(242,237,228,0.55)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fill: "rgba(242,237,228,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                <span key="v" className="font-semibold text-cream">
                  {Number(value).toLocaleString()} denials
                </span>,
                name,
              ]}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="denials" radius={[6, 6, 0, 0]} maxBarSize={44}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.9} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
