import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill border border-transparent px-3 py-1 text-[11px] font-semibold leading-none tracking-wide transition-[color,background-color,box-shadow] duration-vetvax focus:outline-none focus:ring-2 focus:ring-vetvax-primary/25 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-vetvax-primary text-white shadow-sm hover:bg-vetvax-primary-hover",
        secondary: "border-transparent bg-slate-100/90 text-slate-700 hover:bg-slate-200/80",
        destructive: "bg-vetvax-danger-soft text-vetvax-danger hover:bg-red-100/90",
        outline: "border-vetvax-border-soft bg-white text-vetvax-text-main shadow-sm hover:bg-vetvax-surface-panel",
        success: "bg-[rgba(16,185,129,0.14)] text-[#047857]",
        warning: "bg-[rgba(245,158,11,0.16)] text-[#b45309]",
        info: "bg-[rgba(59,130,246,0.14)] text-[#1d4ed8]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
