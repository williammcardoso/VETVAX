import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function pageWindow(current: number, total: number, size: number) {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return { start, end };
}

export default function PaginationBar({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);

  const { start, end } = pageWindow(current, total, 7);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Button
        variant="outline"
        className="h-9 rounded-[10px] border-[1.5px] px-3"
        disabled={current <= 1}
        onClick={() => onPageChange(Math.max(1, current - 1))}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        <span className="text-sm">Anterior</span>
      </Button>

      <div className="flex items-center gap-1">
        {pages.map((p) => {
          const active = p === current;
          return (
            <Button
              key={p}
              variant={active ? "default" : "outline"}
              className={cn(
                "h-9 w-9 rounded-[10px] border-[1.5px] px-0",
                active ? "bg-primary text-primary-foreground hover:bg-[#1E40AF]" : "bg-background",
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          );
        })}
      </div>

      <Button
        className={cn(
          "h-9 rounded-[10px] border-[1.5px] px-3",
          current >= total
            ? "bg-transparent text-muted-foreground hover:bg-transparent"
            : "bg-primary text-primary-foreground hover:bg-[#1E40AF]",
        )}
        variant={current >= total ? "outline" : "default"}
        disabled={current >= total}
        onClick={() => onPageChange(Math.min(total, current + 1))}
      >
        <span className="text-sm">Próximo</span>
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
