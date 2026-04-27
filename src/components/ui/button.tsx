import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold ring-offset-background transition-[color,background-color,box-shadow,transform,border-color] duration-vetvax ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vetvax-primary/35 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[2]",
  {
    variants: {
      variant: {
        default: "bg-vetvax-primary text-white shadow-vetvax-button hover:bg-vetvax-primary-hover hover:shadow-[0_12px_28px_rgba(15,118,110,0.28)]",
        destructive: "bg-vetvax-danger text-white shadow-sm hover:bg-[#b91c1c] hover:shadow-md",
        outline: "border border-vetvax-border-soft bg-white text-vetvax-text-main shadow-sm hover:border-vetvax-border-medium hover:bg-vetvax-surface-panel",
        secondary: "border border-transparent bg-vetvax-surface-alt text-vetvax-text-secondary hover:bg-[#eef2f6] hover:text-vetvax-text-main",
        ghost: "text-vetvax-text-secondary hover:bg-vetvax-surface-alt/90 hover:text-vetvax-text-main",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
