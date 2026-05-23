"use client"

import { PieChart, Pie, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { denialReasons, type DenialReason } from "@/lib/fake-data"

export function ReasonCodeChart({ data = denialReasons }: { data?: DenialReason[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d) => [d.code, { label: d.label, color: d.fill }])
  )
  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <PieChart>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              const pct = ((Number(item.value) / total) * 100).toFixed(1)
              return (
                <div className="glass rounded-lg px-3 py-2 text-xs text-cream">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-cream/60">
                    {Number(item.value).toLocaleString()} denials ({pct}%)
                  </p>
                </div>
              )
            }}
          />
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} fillOpacity={0.88} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((d) => {
          const pct = ((d.count / total) * 100).toFixed(0)
          return (
            <div key={d.code} className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              <span className="text-xs text-cream/55 truncate">{d.label}</span>
              <span className="text-xs font-semibold text-cream/80 ml-auto shrink-0">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
