import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";

export default function DeleteRecordDialog({
  open,
  row,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  row: VaccinationReportRow | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const deleteRecord = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { error } = await supabase.from("vaccination_records").update({ is_active: false }).eq("id", row.record_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Registro excluído" });
      onChanged();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Falha ao excluir", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted">
              <Trash2 className="h-4.5 w-4.5" />
            </span>
            Excluir registro
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div className="text-sm text-muted-foreground">
            Isso remove este registro de aplicação do relatório e do histórico do tutor. Use apenas para corrigir um lançamento
            errado — os lembretes já criados a partir dele não são apagados automaticamente.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="h-10 rounded-[10px]" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-[10px]"
              onClick={() => deleteRecord.mutate()}
              disabled={deleteRecord.isPending}
            >
              {deleteRecord.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
