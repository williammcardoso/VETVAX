import type { ReactNode } from "react";

export default function SummaryCard({
  title,
  children,
  footer,
  sticky = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <aside className={sticky ? "lg:sticky lg:top-[96px]" : ""}>
      <div className="rounded-[16px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02] transition-[box-shadow,border-color] duration-vetvax hover:border-vetvax-border-medium/60 hover:shadow-vetvax-card-hover">
        <h3 className="text-[15px] font-semibold tracking-tight text-vetvax-text-main">{title}</h3>
        <div className="mt-4 space-y-3">{children}</div>
        {footer ? <div className="mt-5 space-y-2">{footer}</div> : null}
      </div>
    </aside>
  );
}
