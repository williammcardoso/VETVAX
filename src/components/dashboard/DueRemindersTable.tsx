import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, CheckCircle2, MessageCircle, ShieldAlert } from "lucide-react";
import type { DueReminderRow } from "@/types/vetvax";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { buildWhatsAppLink } from "@/lib/phone";
import { daysDiffFromToday, formatDateBr } from "@/lib/datetime";
import { supabase } from "@/lib/supabase";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function dueLabel(dueDateISO: string) {
  const diff = daysDiffFromToday(dueDateISO);
  if (diff === 0) return "vence hoje";
  if (diff < 0) return `vencido há ${Math.abs(diff)}d`;
  return `faltam ${diff}d`;
}

function lastAppliedLabel(lastAppliedAt: string | null) {
  if (!lastAppliedAt) return null;
  const diff = Math.abs(daysDiffFromToday(lastAppliedAt));
  if (diff < 30) return `última há ${diff} dias`;
  const years = Math.floor(diff / 365);
  if (years >= 1) return `última há ${years} ano${years > 1 ? "s" : ""}`;
  const months = Math.floor(diff / 30);
  return `última há ${months} mês${months > 1 ? "es" : ""}`;
}

export default function DueRemindersTable({
  rows,
  loading,
  onChanged,
}: {
  rows: DueReminderRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { buildReminderMessage, pickPhone } = useWhatsMessage();

  const empty = !loading && rows.length === 0;

  const openWhats = useMutation({
    mutationFn: async (row: DueReminderRow) => {
      const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
      if (!phone) throw new Error("Tutor sem telefone");

      // anti-spam (24h)
      if (row.last_sent_at) {
        const last = new Date(row.last_sent_at).getTime();
        const hours = (Date.now() - last) / (1000 * 60 * 60);
        if (hours < 24) throw new Error("Envio recente (menos de 24h). Aguarde para reenviar.");
      }

      const msg = await buildReminderMessage(row);

      // Atualiza counters como "intenção" de envio (fase MVP wa.me)
      await supabase
        .from("reminders")
        .update({
          last_sent_at: new Date().toISOString(),
          send_count: (row.send_count ?? 0) + 1,
        })
        .eq("id", row.id);

      window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
    },
    onSuccess: () => onChanged(),
    onError: (e: any) => {
      toast({
        title: "Não foi possível abrir o WhatsApp",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "FEITO" | "ARQUIVADO" }) => {
      const { error } = await supabase.from("reminders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
    onError: (e: any) => {
      toast({
        title: "Falha ao atualizar lembrete",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const rowsWithMeta = useMemo(() => {
    return rows.map((r) => {
      const dueText = dueLabel(r.due_date);
      const lastText = lastAppliedLabel(r.last_applied_at);
      return { r, dueText, lastText };
    });
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Vencimento</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="hidden md:table-cell">Detalhe</TableHead>
            <TableHead className="w-[140px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-9 w-full rounded-xl" />
                </TableCell>
              </TableRow>
            ))}

          {rowsWithMeta.map(({ r, dueText, lastText }) => {
            const diff = daysDiffFromToday(r.due_date);
            const urgent = diff <= 0;
            const lastSentRecently = r.last_sent_at
              ? (Date.now() - new Date(r.last_sent_at).getTime()) / (1000 * 60 * 60) < 24
              : false;

            return (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="align-top">
                  <div className="text-xs font-medium">{formatDateBr(r.due_date)}</div>
                  <div className="mt-1">
                    <Badge
                      className="rounded-full"
                      variant={urgent ? "destructive" : "secondary"}
                    >
                      {urgent && <ShieldAlert className="mr-1 h-3 w-3" />}
                      {dueText}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="text-sm font-medium leading-tight">
                    {r.tutor_name}
                    {r.pet_name ? <span className="text-muted-foreground"> • {r.pet_name}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="rounded-full text-[11px]">
                      {r.reminder_type}
                    </Badge>
                    {lastText && (
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {lastText}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell align-top">
                  <div className="text-xs text-muted-foreground">
                    {r.notes ? r.notes : "—"}
                    {r.last_sent_at && (
                      <div className="mt-1 text-[11px]">
                        último envio: {new Date(r.last_sent_at).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-2xl"
                            onClick={() => openWhats.mutate(r)}
                            disabled={openWhats.isPending || lastSentRecently}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-2xl">
                        {lastSentRecently
                          ? "Envio recente (menos de 24h)."
                          : "Abrir WhatsApp com mensagem pronta"}
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-2xl"
                      onClick={() => setStatus.mutate({ id: r.id, status: "FEITO" })}
                      disabled={setStatus.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-2xl"
                      onClick={() => setStatus.mutate({ id: r.id, status: "ARQUIVADO" })}
                      disabled={setStatus.isPending}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {empty && (
            <TableRow>
              <TableCell colSpan={4} className="py-10">
                <div className="mx-auto max-w-sm text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-muted">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 text-sm font-medium">Nada pendente por aqui</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lembretes são criados na baixa de um agendamento (próxima aplicação).
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
