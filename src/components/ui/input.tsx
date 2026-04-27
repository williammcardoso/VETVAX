import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-control border border-vetvax-border-soft bg-white px-3 py-2 text-sm text-vetvax-text-main shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-offset-background transition-[border-color,box-shadow,ring] duration-vetvax file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-vetvax-text-main placeholder:text-vetvax-text-tertiary focus-visible:outline-none focus-visible:border-vetvax-primary/40 focus-visible:ring-2 focus-visible:ring-vetvax-primary/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
