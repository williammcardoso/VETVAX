import { useState } from "react";
import type { DueReminderRow } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppLink } from "@/lib/phone";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function useWhatsReminderSend(onRecorded: () => Promise<void> | void) {
  const { buildReminderMessage, pickPhone } = useWhatsMessage();
  const [pending, setPending] = useState<DueReminderRow | null>(null);
  const [saving, setSaving] = useState(false);

  const openWhats = async (row: DueReminderRow) => {
    const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
    if (!phone) {
      toast({ title: "Tutor sem telefone", variant: "destructive" });
      return;
    }
    const msg = await buildReminderMessage(row);
    window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
    setPending(row);
  };

  const confirmSent = async () => {
    if (!pending) return;
    setSaving(true);
    const { error } = await supabase
      .from("reminders")
      .update({
        last_sent_at: new Date().toISOString(),
        send_count: Math.max(0, pending.send_count ?? 0) + 1,
      })
      .eq("id", pending.id);
    setSaving(false);
    if (error) {
      toast({ title: "Falha ao registrar envio", description: error.message, variant: "destructive" });
      return;
    }
    setPending(null);
    await onRecorded();
  };

  const whatsDialog = (
    <Dialog open={!!pending} onOpenChange={(v) => (!v ? setPending(null) : undefined)}>
      <DialogContent className="max-w-md rounded-[14px]">
        <DialogHeader>
          <DialogTitle>Você enviou a mensagem?</DialogTitle>
          <DialogDescription>
            {pending ? `Conversa com ${pending.tutor_name} aberta no WhatsApp. ` : ""}
            Só marque "Sim" se a mensagem foi realmente enviada — o contato só é registrado nesse caso.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>
            Não enviei
          </Button>
          <Button onClick={confirmSent} disabled={saving}>
            {saving ? "Registrando..." : "Sim, enviei"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { openWhats, whatsDialog };
}
