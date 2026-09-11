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
    <header className={cn("vetvax-fade-in mb-7 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2.5">
        {badge ? (
          <span className="inline-flex h-7 items-center rounded-pill border border-vetvax-primary-border bg-vetvax-primary-soft px-[11px] text-[11px] font-semibold uppercase tracking-wide text-vetvax-primary shadow-sm">
            {badge}
          </span>
        ) : null}
        <h1 className="vetvax-page-title">{title}</h1>
        {description ? <p className="max-w-[640px] text-sm leading-relaxed text-vetvax-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
