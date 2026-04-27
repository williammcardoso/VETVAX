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
    <div className="rounded-card-md border border-dashed border-vetvax-border-medium bg-vetvax-surface-alt p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-control bg-white text-vetvax-text-tertiary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-vetvax-text-main">{title}</h3>
      <p className="mt-1 text-xs text-vetvax-text-tertiary">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
