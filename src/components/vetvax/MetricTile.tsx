import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTileProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "inverse";
  className?: string;
};

export default function MetricTile({ label, value, icon: Icon, tone = "default", className }: MetricTileProps) {
  const toneClass =
    tone === "inverse"
      ? "border border-white/15 bg-white/10 text-white"
      : "border border-vetvax-border-soft bg-white text-vetvax-text-main";

  return (
    <div className={cn("rounded-[16px] px-3.5 py-3", toneClass, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-semibold", tone === "inverse" ? "text-white/80" : "text-vetvax-text-tertiary")}>{label}</span>
        {Icon ? <Icon className={cn("h-4 w-4", tone === "inverse" ? "text-white" : "text-vetvax-primary")} /> : null}
      </div>
      <p className="mt-1 text-[26px] font-bold leading-none">{value}</p>
    </div>
  );
}
