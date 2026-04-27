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
        "min-h-[84px] rounded-card-md border border-transparent bg-white px-4 py-3 transition-colors hover:border-vetvax-border-soft hover:bg-vetvax-surface-alt",
        className,
      )}
    >
      {children}
    </article>
  );
}
