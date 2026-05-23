import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accentClass?: string
  trend?: { value: string; up: boolean }
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass = "text-verdigris",
  trend,
}: StatCardProps) {
  return (
    <div className="glass rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden">
      {/* subtle top-edge glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-cream/50">
          {title}
        </span>
        <span
          className={cn(
            "p-2 rounded-xl glass-bright",
            accentClass
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold tracking-tight text-cream leading-none">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold mb-0.5 px-1.5 py-0.5 rounded-md",
              trend.up
                ? "text-coral bg-coral/10"
                : "text-mint bg-mint/10"
            )}
          >
            {trend.up ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-cream/40 leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}
