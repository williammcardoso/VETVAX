import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, CheckCircle2, Clock, MessageCircle, ShieldAlert } from "lucide-react";
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
  if (diff === 0) return "Vence hoje";
  if (diff < 0) return `Vencido há ${Math.abs(diff)} dias`;
  return `Faltam ${diff} dias`;
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
      const diff = daysDiffFromToday(r.due_date);
      const overdue = diff < 0;
      const dueText = dueLabel(r.due_date);
      const lastText = lastAppliedLabel(r.last_applied_at);
      return { r, dueText, lastText, overdue, diff };
    });
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-[12px] border-[1.5px] bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Vencimento</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="w-[132px]"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="[&_tr]:border-0">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={3}>
                  <Skeleton className="h-10 w-full rounded-md" />
                </TableCell>
              </TableRow>
            ))}

          {rowsWithMeta.map(({ r, dueText, lastText, overdue, diff }) => {
            const urgent = diff <= 0;
            const lastSentRecently = r.last_sent_at
              ? (Date.now() - new Date(r.last_sent_at).getTime()) / (1000 * 60 * 60) < 24
              : false;

            return (
              <TableRow
                key={r.id}
                className={
                  "group transition-colors hover:bg-slate-50 " +
                  (overdue ? "border-l-[4px] border-l-destructive" : "")
                }
              >
                <TableCell className="align-top py-4">
                  <div className="text-xs font-semibold text-foreground">{formatDateBr(r.due_date)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        "rounded-full border-0 " +
                        (urgent ? "bg-destructive text-destructive-foreground" : "bg-slate-800 text-white")
                      }
                    >
                      {urgent && <ShieldAlert className="mr-1 h-3 w-3" strokeWidth={2} />}
                      {dueText}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      {r.status}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="align-top py-4">
                  <div className="text-sm font-semibold leading-tight">
                    {r.tutor_name}
                    {r.pet_name ? <span className="text-muted-foreground"> • {r.pet_name}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge className="rounded-full border-0 bg-slate-100 text-slate-700 text-[11px]">
                      {r.reminder_type}
                    </Badge>
                    {lastText && (
                      <Badge className="rounded-full border-0 bg-slate-200 text-slate-800 text-[11px]">
                        {lastText}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right align-top py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-[10px] border-[1.5px]"
                            onClick={() => openWhats.mutate(r)}
                            disabled={openWhats.isPending || lastSentRecently}
                          >
                            <MessageCircle className="h-4 w-4" strokeWidth={2} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-md">
                        {lastSentRecently ? "Envio recente (menos de 24h)." : "Abrir WhatsApp"}
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      className="h-8 rounded-[10px] bg-primary text-primary-foreground hover:bg-[#1E40AF]"
                      onClick={() => setStatus.mutate({ id: r.id, status: "FEITO" })}
                      disabled={setStatus.isPending}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" strokeWidth={2} />
                      Resolvido
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-[10px] border-[1.5px]"
                      onClick={() => setStatus.mutate({ id: r.id, status: "ARQUIVADO" })}
                      disabled={setStatus.isPending}
                      title="Arquivar"
                    >
                      <Archive className="h-4 w-4" strokeWidth={2} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {empty && (
            <TableRow>
              <TableCell colSpan={3} className="py-10">
                <div className="mx-auto max-w-sm text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="mt-3 text-sm font-semibold">Tudo em dia</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lembretes aparecem aqui quando você define uma próxima aplicação na baixa.
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