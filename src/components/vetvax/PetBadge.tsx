import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PetBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border-2 border-emerald-600 bg-emerald-200 px-3 py-1 text-base font-extrabold leading-none text-emerald-900",
        className,
      )}
    >
      <PawPrint className="h-4 w-4 text-black" />
      {name}
    </span>
  );
}
