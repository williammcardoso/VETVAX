import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DataToolbarProps = {
  leading?: ReactNode;
  filters?: ReactNode;
  className?: string;
  sticky?: boolean;
};

export default function DataToolbar({ leading, filters, className, sticky = false }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-vetvax-border-soft bg-white/95 p-3.5 shadow-vetvax-card ring-1 ring-black/[0.02] backdrop-blur-sm transition-[box-shadow,border-color] duration-vetvax hover:border-vetvax-border-medium/50 hover:shadow-vetvax-card-hover",
        sticky ? "sticky top-[84px] z-20" : "",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {leading ? <div className="flex items-center gap-2">{leading}</div> : <div />}
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
    </div>
  );
}
