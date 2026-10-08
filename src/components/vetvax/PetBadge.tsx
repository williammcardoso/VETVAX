import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PetBadge({ name, size = "lg", className }: { name: string; size?: "lg" | "sm"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border-emerald-600 bg-emerald-200 font-extrabold leading-none text-emerald-900",
        size === "lg" ? "border-2 px-3 py-1 text-base" : "border px-2.5 py-1 text-sm",
        className,
      )}
    >
      <PawPrint className={size === "lg" ? "h-4 w-4 text-black" : "h-3.5 w-3.5 text-black"} />
      {name}
    </span>
  );
}
