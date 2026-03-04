import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, CheckCircle2, FileDown, MessagesSquare, ShieldAlert } from "lucide-react";
import type { DueReminderRow } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppLink } from "@/lib/phone";
import { daysDiffFromToday, formatDateBr } from "@/lib/datetime";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import ResolveReminderDialog from "@/components/reminders/ResolveReminderDialog";
import { useNavigate } from "react-router-dom";
import { dayjs } from "@/lib/datetime";

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

function toCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RemindersTable({
  rows,
  loading,
  onChanged,
}: {
  rows: DueReminderRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const nav = useNavigate();
  const { buildReminderMessage, pickPhone } = useWhatsMessage();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState<DueReminderRow | null>(null);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedIds = useMemo(() => ids.filter((id) => selected[id]), [ids, selected]);
  const selectedRows = useMemo(() => rows.filter((r) => selected[r.id]), [rows, selected]);

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const id of ids) next[id] = true;
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

  const openWhats = useMutation({
    mutationFn: async (row: DueReminderRow) => {
      const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
      if (!phone) throw new Error("Tutor sem telefone");

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

  const bulkSetStatus = useMutation({
    mutationFn: async ({ status, ids }: { status: "FEITO" | "ARQUIVADO"; ids: string[] }) => {
      if (!ids.length) return;
      const { error } = await supabase.from("reminders").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Atualizado" });
      setSelected({});
      onChanged();
    },
    onError: (e: any) => {
      toast({ title: "Falha ao atualizar", description: e?.message, variant: "destructive" });
    },
  });

  const empty = !loading && rows.length === 0;
  const allChecked = ids.length > 0 && selectedIds.length === ids.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < ids.length;

  const bulkLinks = useMemo(() => {
    return selectedRows.map((r) => {
      const phone = pickPhone(r.tutor_phone1, r.tutor_phone2);
      const digits = phone ? phone.replace(/\D/g, "") : "";
      return {
        id: r.id,
        tutor: r.tutor_name,
        pet: r.pet_name,
        due: r.due_date,
        phoneDigits: digits,
      };
    });
  }, [pickPhone, selectedRows]);

  return (
    <div className="overflow-hidden rounded-[10px] border-[1.5px] border-border">
      <div className="flex flex-col gap-2 border-b border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="h-10 rounded-[10px]"
            onClick={() => {
              const flat = (rows ?? []).map((r) => ({
                id: r.id,
                vencimento: r.due_date,
                tutor: r.tutor_name,
                pet: r.pet_name ?? "",
                tipo: r.reminder_type,
                status: r.status,
                ultima_aplicacao: r.last_applied_at ?? "",
                ultimo_envio: r.last_sent_at ?? "",
                envios: r.send_count ?? 0,
              }));
              const csv = toCsv(flat);
              if (!csv) {
                toast({ title: "Sem dados" });
                return;
              }
              downloadText(`vetvax_lembretes_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>

          <div className="h-6 w-px bg-border" />

          <Button
            variant="secondary"
            className="h-10 rounded-[10px]"
            disabled={!selectedIds.length || bulkSetStatus.isPending}
            onClick={() => bulkSetStatus.mutate({ status: "FEITO", ids: selectedIds })}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar resolvido ({selectedIds.length})
          </Button>
          <Button
            variant="secondary"
            className="h-10 rounded-[10px]"
            disabled={!selectedIds.length || bulkSetStatus.isPending}
            onClick={() => bulkSetStatus.mutate({ status: "ARQUIVADO", ids: selectedIds })}
          >
            <Archive className="mr-2 h-4 w-4" />
            Arquivar ({selectedIds.length})
          </Button>

          <Button variant="secondary" className="h-10 rounded-[10px]" disabled={!selectedIds.length} onClick={() => setBulkOpen(true)}>
            <MessagesSquare className="mr-2 h-4 w-4" />
            Whats em lote
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">Selecione linhas para ações em lote.</div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[44px]">
              <Checkbox checked={allChecked ? true : someChecked ? "indeterminate" : false} onCheckedChange={(v) => toggleAll(Boolean(v))} />
            </TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="hidden lg:table-cell">Contexto</TableHead>
            <TableHead className="w-[160px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-9 w-full rounded-xl" />
                </TableCell>
              </TableRow>
            ))}

          {rows.map((r) => {
            const diff = daysDiffFromToday(r.due_date);
            const urgent = diff <= 0;
            const dueText = dueLabel(r.due_date);
            const lastText = lastAppliedLabel(r.last_applied_at);
            const lastSentRecently = r.last_sent_at
              ? (Date.now() - new Date(r.last_sent_at).getTime()) / (1000 * 60 * 60) < 24
              : false;

            const leftBar = urgent ? "border-l-[#DC2626]" : "border-l-[#16A34A]";

            return (
              <TableRow key={r.id} className={`hover:bg-muted/30 border-l-4 ${leftBar}`}>
                <TableCell className="align-top">
                  <Checkbox checked={!!selected[r.id]} onCheckedChange={(v) => toggleOne(r.id, Boolean(v))} />
                </TableCell>

                <TableCell className="align-top">
                  <div className="text-xs font-medium">{formatDateBr(r.due_date)}</div>
                  <div className="mt-1">
                    <Badge className="rounded-full" variant={urgent ? "destructive" : "secondary"}>
                      {urgent && <ShieldAlert className="mr-1 h-3 w-3" />}
                      {dueText}
                    </Badge>
                    <Badge variant="secondary" className="ml-2 rounded-full text-[11px]">
                      {r.status}
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
                    {r.send_count > 0 && (
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        envios: {r.send_count}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="hidden lg:table-cell align-top">
                  <div className="text-xs text-muted-foreground">
                    {r.notes ? r.notes : "—"}
                    {r.last_sent_at && <div className="mt-1 text-[11px]">último envio: {new Date(r.last_sent_at).toLocaleString("pt-BR")}</div>}
                  </div>
                </TableCell>

                <TableCell className="text-right align-top">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-[10px]"
                      onClick={() => openWhats.mutate(r)}
                      disabled={openWhats.isPending || lastSentRecently}
                      title={lastSentRecently ? "Envio recente (menos de 24h)." : "Abrir WhatsApp"}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 rounded-[10px]"
                      onClick={() => {
                        setResolveRow(r);
                        setResolveOpen(true);
                      }}
                      disabled={bulkSetStatus.isPending}
                      title="Marcar como resolvido"
                    >
                      Resolver
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 rounded-[10px]"
                      onClick={() => bulkSetStatus.mutate({ status: "ARQUIVADO", ids: [r.id] })}
                      disabled={bulkSetStatus.isPending}
                      title="Arquivar"
                    >
                      Arquivar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {empty && (
            <TableRow>
              <TableCell colSpan={5} className="py-10">
                <div className="mx-auto max-w-sm text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-[10px] bg-muted">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 text-sm font-medium">Nenhum lembrete no filtro</div>
                  <p className="mt-1 text-xs text-muted-foreground">Lembretes são criados na baixa de um agendamento quando você informa uma próxima aplicação.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="rounded-[10px] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Whats em lote ({selectedRows.length})</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <div className="text-sm text-muted-foreground">
              Dica: para cada lembrete, use o botão abaixo para abrir o Whats com a mensagem do template. Dependendo do navegador,
              múltiplas abas podem ser bloqueadas.
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                className="rounded-[10px]"
                onClick={async () => {
                  const links: string[] = [];
                  for (const r of selectedRows) {
                    const phone = pickPhone(r.tutor_phone1, r.tutor_phone2);
                    if (!phone) continue;
                    const msg = await buildReminderMessage(r);
                    links.push(buildWhatsAppLink(phone, msg));
                  }

                  try {
                    await navigator.clipboard.writeText(links.join("\n"));
                    toast({ title: "Links copiados", description: "Cole em um bloco de notas/planilha." });
                  } catch {
                    toast({ title: "Não foi possível copiar" });
                  }
                }}
              >
                Copiar links
              </Button>

              <Button
                className="rounded-[10px]"
                onClick={async () => {
                  for (const r of selectedRows) {
                    try {
                      await openWhats.mutateAsync(r);
                    } catch {
                      // openWhats já notifica
                    }
                  }
                  setBulkOpen(false);
                }}
              >
                Abrir Whats (1 a 1)
              </Button>
            </div>

            <div className="overflow-hidden rounded-[10px] border-[1.5px] border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Tutor</TableHead>
                    <TableHead className="hidden sm:table-cell">Pet</TableHead>
                    <TableHead className="hidden sm:table-cell">Venc.</TableHead>
                    <TableHead className="text-right">Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkLinks.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm font-medium">{l.tutor}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{l.pet ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDateBr(l.due)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{l.phoneDigits ? `…${l.phoneDigits.slice(-4)}` : "sem telefone"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ResolveReminderDialog
        open={resolveOpen}
        row={resolveRow}
        onOpenChange={(v) => {
          setResolveOpen(v);
          if (!v) setResolveRow(null);
        }}
        onOnlyResolve={(row) => {
          setResolveOpen(false);
          setResolveRow(null);
          bulkSetStatus.mutate({ status: "FEITO", ids: [row.id] });
        }}
        onScheduleNow={(row) => {
          setResolveOpen(false);
          setResolveRow(null);
          const date = dayjs().format("YYYY-MM-DD");
          nav(`/appointments/new?tutor=${encodeURIComponent(row.tutor_id)}&resolveReminder=${encodeURIComponent(row.id)}&date=${encodeURIComponent(date)}`);
        }}
      />
    </div>
  );
}