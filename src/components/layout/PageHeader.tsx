import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  badge?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({ badge, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2">
        {badge ? (
          <span className="inline-flex h-7 items-center rounded-pill border border-vetvax-primary-border bg-[#f0fdfa] px-[10px] text-xs font-bold text-vetvax-primary">
            {badge}
          </span>
        ) : null}
        <h1 className="vetvax-page-title">{title}</h1>
        {description ? <p className="max-w-[640px] text-sm text-vetvax-text-tertiary">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
