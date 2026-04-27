import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-control border border-vetvax-border-soft bg-white px-3 py-2 text-sm text-vetvax-text-main shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-offset-background transition-[border-color,box-shadow] duration-vetvax placeholder:text-vetvax-text-tertiary focus-visible:outline-none focus-visible:border-vetvax-primary/40 focus-visible:ring-2 focus-visible:ring-vetvax-primary/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
