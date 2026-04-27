import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionButtonProps = ButtonProps & {
  emphasis?: "primary" | "secondary";
};

export default function ActionButton({ className, emphasis = "secondary", ...props }: ActionButtonProps) {
  return (
    <Button
      className={cn(emphasis === "primary" ? "h-11 rounded-control" : "h-10 rounded-control", className)}
      variant={emphasis === "primary" ? "default" : "outline"}
      {...props}
    />
  );
}
