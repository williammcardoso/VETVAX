import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTileProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "inverse" | "success" | "warning" | "danger" | "info";
  className?: string;
};

type MetricTone = NonNullable<MetricTileProps["tone"]>;

export default function MetricTile({ label, value, icon: Icon, tone = "default", className }: MetricTileProps) {
  const toneClassMap: Record<MetricTone, string> = {
    inverse: "border border-white/20 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px]",
    default: "border border-vetvax-border-soft bg-white text-vetvax-text-main shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]",
    success: "border border-emerald-100 bg-emerald-50/65 text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
    warning: "border border-amber-100 bg-amber-50/80 text-amber-900 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
    danger: "border border-red-100 bg-red-50/75 text-red-900 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
    info: "border border-blue-100 bg-blue-50/70 text-blue-900 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
  };
  const toneClass = toneClassMap[tone];

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
              tone === "inverse" ? "bg-white/10 text-white" : "",
              tone === "default" ? "bg-vetvax-primary-soft text-vetvax-primary" : "",
              tone === "success" ? "bg-emerald-100 text-emerald-700" : "",
              tone === "warning" ? "bg-amber-100 text-amber-700" : "",
              tone === "danger" ? "bg-red-100 text-red-700" : "",
              tone === "info" ? "bg-blue-100 text-blue-700" : "",
            )}
          >
            <Icon className="h-[18px] w-[18px] stroke-[2]" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-1.5 text-[28px] font-bold tabular-nums leading-none tracking-tight", tone === "inverse" ? "text-white" : "")}>{value}</p>
    </div>
  );
}
