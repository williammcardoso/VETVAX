import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DueReminderRow } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";

export default function ResolveReminderDialog({
  open,
  row,
  onOpenChange,
  onOnlyResolve,
  onScheduleNow,
}: {
  open: boolean;
  row: DueReminderRow | null;
  onOpenChange: (v: boolean) => void;
  onOnlyResolve: (row: DueReminderRow) => void;
  onScheduleNow: (row: DueReminderRow) => void;
}) {
  if (!row) return null;

  const due = dayjs(row.due_date);
  const when = due.isValid() ? due.format("DD/MM/YYYY") : row.due_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] border-[1.5px] border-border">
        <DialogHeader>
          <DialogTitle>A vacina já foi aplicada?</DialogTitle>
        </DialogHeader>

        <div className="mt-2 text-sm text-muted-foreground">
          Tutor: <span className="font-medium text-foreground">{row.tutor_name}</span>
          <div className="mt-1">Vencimento do lembrete: {when}</div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="rounded-[10px]" onClick={() => onOnlyResolve(row)}>
            Apenas marcar como resolvido
          </Button>
          <Button className="rounded-[10px]" onClick={() => onScheduleNow(row)}>
            Registrar aplicação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
