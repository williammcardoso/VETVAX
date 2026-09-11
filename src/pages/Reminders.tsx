import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Branch, DueReminderRow } from "@/types/vetvax";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dayjs } from "@/lib/datetime";
import PageHeader from "@/components/layout/PageHeader";
import DataToolbar from "@/components/vetvax/DataToolbar";
import StatusBadge from "@/components/vetvax/StatusBadge";
import RichListItem from "@/components/vetvax/RichListItem";
import EmptyState from "@/components/vetvax/EmptyState";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { buildWhatsAppLink } from "@/lib/phone";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import ResolveReminderDialog from "@/components/reminders/ResolveReminderDialog";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

type DuePreset = "overdue" | "7d" | "30d" | "60d" | "all";

type StatusFilter = "all" | "ATIVO" | "FEITO" | "ARQUIVADO";

type Filters = {
  q: string;
  due: DuePreset;
  status: StatusFilter;
  reminderType: "all" | "vacina" | "medicação" | "outro";
  pet: "all" | "with_pet" | "without_pet";
  branchId: string;
};

const LS_KEY = "vetvax.reminders.filters";

function defaults(): Filters {
  return {
    q: "",
    due: "all",
    status: "ATIVO",
    reminderType: "all",
    pet: "all",
    branchId: "all",
  };
}

function dueRange(due: DuePreset) {
  const today = dayjs().startOf("day");
  if (due === "overdue") return { from: null as string | null, to: today.subtract(1, "day").format("YYYY-MM-DD") };
  if (due === "7d") return { from: today.format("YYYY-MM-DD"), to: today.add(7, "day").format("YYYY-MM-DD") };
  if (due === "30d") return { from: today.format("YYYY-MM-DD"), to: today.add(30, "day").format("YYYY-MM-DD") };
  if (due === "60d") return { from: today.format("YYYY-MM-DD"), to: today.add(60, "day").format("YYYY-MM-DD") };
  return { from: null, to: null };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function Reminders() {
  const qc = useQueryClient();
  const { buildReminderMessage, pickPhone } = useWhatsMessage();
  const nav = useNavigate();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState<DueReminderRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 30 | 50>(10);

  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaults();
      return { ...defaults(), ...(JSON.parse(raw) as Partial<Filters>) };
    } catch {
      return defaults();
    }
  });

  const persist = (next: Filters) => {
    setFilters(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const branches = useQuery({
    queryKey: ["branches", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, org_id, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const rows = useQuery({
    queryKey: ["reminders", "list", filters],
    queryFn: async () => {
      // IMPORTANT: the view vw_due_reminders is fixed to ATIVO only, so it can't power the full list.
      // Here we query from reminders + tutors/pets to support: ativos, vencidos, arquivados, resolvidos.
      let q = supabase
        .from("reminders")
        .select(
          "id, org_id, branch_id, tutor_id, pet_id, due_date, reference_appointment_id, reference_record_id, last_applied_at, reminder_type, item_name, message_template_id, status, last_sent_at, send_count, notes, created_at, is_active, tutor:tutors(name, phone1, phone2), pet:pets(name)",
        )
        .eq("is_active", true)
        .order("due_date", { ascending: true })
        .limit(800);

      if (filters.status !== "all") q = q.eq("status", filters.status);

      const range = dueRange(filters.due);
      if (range.from) q = q.gte("due_date", range.from);
      if (range.to) q = q.lte("due_date", range.to);

      if (filters.reminderType !== "all") q = q.eq("reminder_type", filters.reminderType);

      if (filters.pet === "with_pet") q = q.not("pet_id", "is", null);
      if (filters.pet === "without_pet") q = q.is("pet_id", null);

      if (filters.branchId !== "all") q = q.eq("branch_id", filters.branchId);

      const term = filters.q.trim();

      const { data, error } = await q;
      if (error) throw error;

      type ReminderJoinRow = {
        id: string;
        org_id: string;
        branch_id: string | null;
        tutor_id: string;
        pet_id: string | null;
        due_date: string;
        reference_appointment_id: string | null;
        reference_record_id: string | null;
        last_applied_at: string | null;
        reminder_type: string;
        item_name: string | null;
        message_template_id: string | null;
        status: "ATIVO" | "FEITO" | "ARQUIVADO";
        last_sent_at: string | null;
        send_count: number | null;
        notes: string | null;
        tutor: { name: string; phone1: string | null; phone2: string | null } | null;
        pet: { name: string | null } | null;
      };

      const mapped = ((data ?? []) as ReminderJoinRow[]).map((r) => ({
        id: r.id,
        org_id: r.org_id,
        branch_id: r.branch_id,
        tutor_id: r.tutor_id,
        pet_id: r.pet_id,
        due_date: r.due_date,
        reference_appointment_id: r.reference_appointment_id,
        reference_record_id: r.reference_record_id,
        last_applied_at: r.last_applied_at,
        reminder_type: r.reminder_type,
        item_name: r.item_name,
        message_template_id: r.message_template_id,
        status: r.status,
        last_sent_at: r.last_sent_at,
        send_count: r.send_count ?? 0,
        notes: r.notes,
        tutor_name: r.tutor?.name ?? "",
        tutor_phone1: r.tutor?.phone1 ?? null,
        tutor_phone2: r.tutor?.phone2 ?? null,
        pet_name: r.pet?.name ?? null,
      })) as DueReminderRow[];

      if (!term) return mapped;

      const t = term.toLowerCase();
      return mapped.filter((row) => {
        const hay = [row.tutor_name, row.pet_name, row.tutor_phone1, row.tutor_phone2, row.notes, row.reminder_type, row.item_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(t);
      });
    },
  });

  const refetchAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["reminders", "list"] }),
      qc.invalidateQueries({ queryKey: ["branches", "active"] }),
    ]);
  };

  const count = useMemo(() => rows.data?.length ?? 0, [rows.data]);

  const countLabel =
    filters.status === "all"
      ? `${count} no total`
      : filters.status === "ATIVO"
        ? `${count} ativos`
        : filters.status === "FEITO"
          ? `${count} resolvidos`
          : `${count} arquivados`;

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "FEITO" | "ARQUIVADO" }) => {
      const { error } = await supabase.from("reminders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_data, vars) => {
      toast({ title: vars.status === "FEITO" ? "Lembrete marcado como resolvido" : "Lembrete arquivado" });
      await Promise.all([
        refetchAll(),
        qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
        qc.invalidateQueries({ queryKey: ["topbar", "reminders"] }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível atualizar o lembrete",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const list = useMemo(() => rows.data ?? [], [rows.data]);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize]);

  const sendWhatsReminder = async (row: DueReminderRow) => {
    const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
    if (!phone) {
      toast({ title: "Tutor sem telefone", variant: "destructive" });
      return;
    }
    const msg = await buildReminderMessage(row);
    const { error } = await supabase
      .from("reminders")
      .update({
        last_sent_at: new Date().toISOString(),
        send_count: Math.max(0, row.send_count ?? 0) + 1,
      })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Falha ao registrar envio", description: getErrorMessage(error), variant: "destructive" });
    } else {
      await qc.invalidateQueries({ queryKey: ["reminders", "list"] });
    }
    window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  return (
    <div className="space-y-7">
      <PageHeader
        badge="Fila operacional"
        title="Lembretes"
        description="Priorize lembretes vencidos, resolva contatos e arquive pendências."
      />

      <DataToolbar
        className="rounded-[18px] p-4"
        leading={
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-vetvax-warning-soft text-vetvax-warning">
              <TriangleAlert className="h-4 w-4" />
            </span>
            <StatusBadge>{countLabel}</StatusBadge>
          </div>
        }
        filters={
          <>
            <Select value={filters.status} onValueChange={(v) => persist({ ...filters, status: v as StatusFilter })}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativos</SelectItem>
                <SelectItem value="FEITO">Resolvidos</SelectItem>
                <SelectItem value="ARQUIVADO">Arquivados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.due} onValueChange={(v) => persist({ ...filters, due: v as DuePreset })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="overdue">Somente vencidos</SelectItem>
                <SelectItem value="7d">Próximos 7 dias</SelectItem>
                <SelectItem value="30d">Próximos 30 dias</SelectItem>
                <SelectItem value="60d">Próximos 60 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.reminderType} onValueChange={(v) => persist({ ...filters, reminderType: v as Filters["reminderType"] })}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="vacina">Vacina</SelectItem>
                <SelectItem value="medicação">Medicação</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.branchId} onValueChange={(v) => persist({ ...filters, branchId: v as Filters["branchId"] })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filial" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todas</SelectItem>
                {(branches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
              <Input
                className="pl-9"
                placeholder="Buscar tutor, telefone ou pet..."
                value={filters.q}
                onChange={(e) => persist({ ...filters, q: e.target.value })}
              />
            </div>
            <Button variant="outline" onClick={refetchAll}>
              Atualizar
            </Button>
          </>
        }
      />

      <section className="vetvax-card-polish rounded-[18px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <div className="space-y-3">
          {rows.isLoading && Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-[98px] rounded-card-md" />)}

          {!rows.isLoading && list.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nenhum lembrete no filtro"
              description="Ajuste os filtros para visualizar vencimentos e pendências de contato."
            />
          ) : null}

          {paged.map((row) => {
            const overdueDays = Math.abs(dayjs().startOf("day").diff(dayjs(row.due_date), "day"));
            const isOverdue = dayjs(row.due_date).isBefore(dayjs().startOf("day"));
            return (
              <RichListItem key={row.id} className="border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40">
                <div className="grid gap-3 md:grid-cols-[5px_1fr_auto] md:items-center">
                  <div className={isOverdue ? "h-full rounded-pill bg-vetvax-danger" : "h-full rounded-pill bg-transparent"} />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-vetvax-text-tertiary">{dayjs(row.due_date).format("DD/MM/YYYY")}</p>
                      {isOverdue ? <StatusBadge tone="danger">vencido há {overdueDays}d</StatusBadge> : <StatusBadge tone="warning">a vencer</StatusBadge>}
                      {row.status === "ATIVO" ? <StatusBadge tone="warning">ativo</StatusBadge> : null}
                      {row.status === "FEITO" ? <StatusBadge tone="success">resolvido</StatusBadge> : null}
                      {row.status === "ARQUIVADO" ? <StatusBadge>arquivado</StatusBadge> : null}
                    </div>
                    <p className="text-sm font-semibold text-vetvax-text-main">
                      {row.tutor_name}
                      {row.pet_name ? <span className="font-normal text-vetvax-text-tertiary"> • {row.pet_name}</span> : null}
                    </p>
                    <p className="text-xs text-vetvax-text-secondary">
                      {[row.tutor_phone1, row.tutor_phone2].filter(Boolean).join(" • ") || "Sem contato"} • {row.item_name ?? row.reminder_type}
                    </p>
                    {row.notes ? <p className="text-xs text-vetvax-text-tertiary">{row.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => sendWhatsReminder(row)}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      className="shadow-vetvax-button"
                      disabled={row.status !== "ATIVO" || setStatus.isPending}
                      onClick={() => {
                        setResolveRow(row);
                        setResolveOpen(true);
                      }}
                    >
                      Resolver
                    </Button>
                    <Button variant="secondary" disabled={row.status !== "ATIVO" || setStatus.isPending} onClick={() => setStatus.mutate({ id: row.id, status: "ARQUIVADO" })}>
                      Arquivar
                    </Button>
                  </div>
                </div>
              </RichListItem>
            );
          })}
        </div>
      </section>

      {!rows.isLoading && list.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[16px] border border-vetvax-border-soft bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-vetvax-text-tertiary">
            Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, list.length)} de {list.length}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(1); setPageSize(Number(v) as 10 | 20 | 30 | 50); }}>
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs font-semibold text-vetvax-text-secondary">Página {page} de {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Próxima
            </Button>
          </div>
        </div>
      ) : null}

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
          setStatus.mutate({ id: row.id, status: "FEITO" });
        }}
        onScheduleNow={(row) => {
          setResolveOpen(false);
          setResolveRow(null);
          nav(`/vaccinations/new?tutor=${encodeURIComponent(row.tutor_id)}&resolveReminder=${encodeURIComponent(row.id)}`);
        }}
      />
    </div>
  );
}