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
    <div className="vetvax-elevate relative rounded-[10px] bg-card border-[1.5px] p-6">
      <Badge className={cn("absolute right-4 top-4 rounded-full border-0", palette.chip)}>
        {badge}
      </Badge>

      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-foreground" strokeWidth={2} />
      </div>

      <div className="mt-5">
        <div className={cn("text-[38px] font-semibold leading-none tracking-tight", palette.num)}>
          {value}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}