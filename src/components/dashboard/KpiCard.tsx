import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  const toneClasses =
    tone === "green"
      ? "bg-green-600/10 text-green-700"
      : tone === "red"
        ? "bg-red-600/10 text-red-700"
        : tone === "amber"
          ? "bg-amber-600/10 text-amber-700"
          : "bg-primary/10 text-primary";

  return (
    <Card className="vetvax-kpi relative rounded-lg border-0 bg-card p-6">
      <Badge
        variant="secondary"
        className="absolute right-4 top-4 rounded-full bg-muted text-muted-foreground"
      >
        {badge}
      </Badge>

      <div className={cn("grid h-8 w-8 place-items-center rounded-full", toneClasses)}>
        <Icon className="h-4 w-4 opacity-90" />
      </div>

      <div className="mt-5">
        <div className="text-[32px] font-bold tracking-tight leading-none text-foreground">{value}</div>
        <div className="mt-2 text-sm font-medium text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}