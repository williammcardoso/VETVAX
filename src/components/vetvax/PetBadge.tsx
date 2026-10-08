import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PetBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border border-emerald-600 bg-emerald-200 px-2 py-0.5 text-xs font-bold leading-none text-emerald-900",
        className,
      )}
    >
      <PawPrint className="h-3 w-3 text-black" />
      {name}
    </span>
  );
}
