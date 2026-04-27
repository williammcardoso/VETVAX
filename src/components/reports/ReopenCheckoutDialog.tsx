import { useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";

export default function ReopenCheckoutDialog({
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
  const reopen = useMutation({
    mutationFn: async () => {
      if (!row?.checkout_id) return;

      // Minimal "reopen": remove checkout record and set appointment back to PENDENTE.
      // This preserves core business rules and uses only permitted tables.
      const { error: updErr } = await supabase
        .from("appointments")
        .update({ status: "PENDENTE" })
        .eq("id", row.appointment_id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase.from("appointment_checkouts").delete().eq("id", row.checkout_id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      toast({ title: "Registro reaberto" });
      onChanged();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Falha ao reabrir", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted">
              <RotateCcw className="h-4.5 w-4.5" />
            </span>
            Reabrir registro
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div className="text-sm">
            Você deseja reabrir esta vacinação? Isso vai:
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              <li>remover a baixa (checkout)</li>
              <li>voltar o agendamento para <span className="font-medium">PENDENTE</span></li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="h-10 rounded-[10px]" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="h-10 rounded-[10px]" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
              {reopen.isPending ? "Reabrindo…" : "Reabrir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
