import { recommendations, type RecStatus } from "@/lib/fake-data"
import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"

const statusStyles: Record<RecStatus, string> = {
  new:       "bg-verdigris/15 text-verdigris border border-verdigris/25",
  "in-review": "bg-amber-warm/15 text-amber-warm border border-amber-warm/25",
  accepted:  "bg-mint/15 text-mint border border-mint/25",
  dismissed: "bg-white/5 text-cream/40 border border-white/10",
}

const statusLabel: Record<RecStatus, string> = {
  new:         "New",
  "in-review": "In Review",
  accepted:    "Accepted",
  dismissed:   "Dismissed",
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 88 ? "#45A89A" : pct >= 78 ? "#D4915B" : "#C4716B"
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-cream/70 tabular-nums">{pct}%</span>
    </div>
  )
}

export function RecommendationsTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/08">
            {["Contract", "Payer", "Trigger", "Recommendation", "Confidence", "Status"].map((h) => (
              <th
                key={h}
                className="text-left text-xs uppercase tracking-widest text-cream/40 font-medium py-3 px-4 first:pl-0 last:pr-0 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec, i) => (
            <tr
              key={rec.id}
              className={cn(
                "border-b border-white/05 transition-colors hover:bg-white/[0.025]",
                i === recommendations.length - 1 && "border-b-0"
              )}
            >
              <td className="py-4 px-4 pl-0 whitespace-nowrap">
                <span className="font-mono text-xs text-cream/50">{rec.contractId}</span>
              </td>
              <td className="py-4 px-4 whitespace-nowrap">
                <span className="text-cream/80 font-medium text-xs">{rec.payer}</span>
              </td>
              <td className="py-4 px-4 max-w-[160px]">
                <span className="text-xs text-amber-warm/90 leading-relaxed line-clamp-2">
                  {rec.trigger}
                </span>
              </td>
              <td className="py-4 px-4 max-w-[340px]">
                <p className="text-xs text-cream/65 leading-relaxed line-clamp-2">
                  {rec.recommendation}
                </p>
              </td>
              <td className="py-4 px-4 whitespace-nowrap">
                <ConfidencePill value={rec.confidence} />
              </td>
              <td className="py-4 px-4 pr-0 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusStyles[rec.status]
                    )}
                  >
                    {statusLabel[rec.status]}
                  </span>
                  {rec.policyUrl !== "#" && (
                    <a
                      href={rec.policyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cream/30 hover:text-mint transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
