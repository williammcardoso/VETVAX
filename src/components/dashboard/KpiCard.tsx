import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function KpiCard({
  icon: Icon,
  label,
  value,
  badge,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  badge: string;
  tone?: "blue" | "green" | "red" | "amber";
}) {
  const palette =
    tone === "green"
      ? { num: "text-green-600", chip: "bg-green-600 text-white" }
      : tone === "red"
        ? { num: "text-red-600", chip: "bg-red-600 text-white" }
        : tone === "amber"
          ? { num: "text-amber-600", chip: "bg-amber-500 text-white" }
          : { num: "text-primary", chip: "bg-primary text-primary-foreground" };

  return (
    <div className="vetvax-elevate relative rounded-[10px] bg-card border-[1.5px] border-border p-[18px] shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
      <Badge className={cn("absolute right-3 top-3 rounded-full border-0 px-2.5 py-1 text-[11px]", palette.chip)}>
        {badge}
      </Badge>

      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2} />
      </div>

      <div className="mt-4">
        <div className={cn("text-[40px] font-bold leading-none tracking-tight", palette.num)}>{value}</div>
        <div className="mt-1.5 text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}