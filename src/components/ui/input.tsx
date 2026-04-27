import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-control border border-vetvax-border-soft bg-vetvax-surface-alt px-3 py-2 text-sm text-vetvax-text-main ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-vetvax-text-main placeholder:text-vetvax-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
