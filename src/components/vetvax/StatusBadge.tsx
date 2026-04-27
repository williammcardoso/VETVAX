import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "default" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  default: "border-vetvax-border-soft bg-vetvax-surface-alt text-vetvax-text-secondary",
  success: "border-transparent bg-vetvax-success-soft text-vetvax-success",
  warning: "border-transparent bg-vetvax-warning-soft text-vetvax-warning",
  danger: "border-transparent bg-vetvax-danger-soft text-vetvax-danger",
};

export default function StatusBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return <Badge className={cn("rounded-pill border", toneClasses[tone], className)}>{children}</Badge>;
}
