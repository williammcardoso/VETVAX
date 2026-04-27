import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RichListItemProps = {
  children: ReactNode;
  className?: string;
};

export default function RichListItem({ children, className }: RichListItemProps) {
  return (
    <article
      className={cn(
        "min-h-[84px] rounded-[14px] border border-vetvax-border-soft/60 bg-white px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-[border-color,box-shadow,background-color,transform] duration-vetvax hover:-translate-y-px hover:border-vetvax-border-medium/70 hover:bg-vetvax-surface-panel hover:shadow-vetvax-card",
        className,
      )}
    >
      {children}
    </article>
  );
}
