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
      ? "border border-white/20 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px]"
      : "border border-vetvax-border-soft bg-white text-vetvax-text-main shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";

  return (
    <div
      className={cn(
        "rounded-[15px] px-4 py-3.5 transition-[transform,box-shadow,border-color,background-color] duration-vetvax",
        tone === "inverse" ? "hover:bg-white/[0.12]" : "hover:-translate-y-px",
        toneClass,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wide", tone === "inverse" ? "text-white/75" : "text-vetvax-text-tertiary")}>{label}</span>
        {Icon ? (
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-[11px]",
              tone === "inverse" ? "bg-white/10 text-white" : "bg-vetvax-primary-soft text-vetvax-primary",
            )}
          >
            <Icon className="h-[18px] w-[18px] stroke-[2]" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-1.5 text-[26px] font-bold tabular-nums leading-none tracking-tight", tone === "inverse" ? "text-white" : "text-vetvax-text-main")}>{value}</p>
    </div>
  );
}
