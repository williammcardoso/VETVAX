import type { ReactNode } from "react";

export default function FormSection({
  step,
  title,
  description,
  actions,
  children,
}: {
  step?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02] md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="vetvax-section-title">
            {step ? `${step}. ` : ""}
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-sm leading-relaxed text-vetvax-text-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
