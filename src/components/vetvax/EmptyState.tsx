import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[14px] border border-dashed border-vetvax-border-medium/90 bg-gradient-to-b from-vetvax-surface-panel/80 to-vetvax-surface-alt p-8 text-center shadow-inner">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] border border-vetvax-border-soft bg-white text-vetvax-primary shadow-sm">
        <Icon className="h-5 w-5 stroke-[2]" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-vetvax-text-main">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-vetvax-text-secondary">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
