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
      <div className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <h3 className="text-base font-bold text-vetvax-text-main">{title}</h3>
        <div className="mt-4 space-y-3">{children}</div>
        {footer ? <div className="mt-5 space-y-2">{footer}</div> : null}
      </div>
    </aside>
  );
}
