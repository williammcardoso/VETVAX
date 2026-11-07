import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Pencil, Search, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Branch, DueReminderRow } from "@/types/vetvax";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dayjs, daysDiffFromToday } from "@/lib/datetime";
import { getReminderUrgency, URGENCY_BADGE_TONE, URGENCY_STRIPE_CLASS } from "@/lib/reminderUrgency";
import { formatTutorAddressLine, buildGoogleMapsUrl } from "@/lib/address";
import { matchesSearchAny } from "@/lib/search";
import { displayReminderNotes } from "@/lib/reminderNotes";
import PageHeader from "@/components/layout/PageHeader";
import DataToolbar from "@/components/vetvax/DataToolbar";
import StatusBadge from "@/components/vetvax/StatusBadge";
import RichListItem from "@/components/vetvax/RichListItem";
import PetBadge from "@/components/vetvax/PetBadge";
import PaginationBar from "@/components/vetvax/PaginationBar";
import EmptyState from "@/components/vetvax/EmptyState";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import EditReminderDialog from "@/components/reminders/EditReminderDialog";
import { useWhatsReminderSend } from "@/components/reminders/useWhatsReminderSend";
import ResolveReminderDialog from "@/components/reminders/ResolveReminderDialog";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

type DuePreset = "overdue" | "7d" | "30d" | "60d" | "all";

type StatusFilter = "all" | "ATIVO" | "FEITO" | "ARQUIVADO";

type ContactFilter = "all" | "not_contacted" | "no_response";

type Filters = {
  q: string;
  due: DuePreset;
  status: StatusFilter;
  reminderType: "all" | "vacina" | "medicação" | "outro";
  pet: "all" | "with_pet" | "without_pet";
  branchId: string;
  contact: ContactFilter;
};

const LS_KEY = "vetvax.reminders.filters";
const NO_RESPONSE_DAYS = 3;

function defaults(): Filters {
  return {
    q: "",
    due: "all",
    status: "ATIVO",
    reminderType: "all",
    pet: "all",
    branchId: "all",
    contact: "all",
  };
}

const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

/**
 * The list state (filters, page, page size) lives in the URL so that leaving for "Registrar aplicação"
 * and coming back lands on the exact same spot. A fresh visit (sidebar) has no params, so it starts clean.
 */
function readListState(params: URLSearchParams) {
  const base = defaults();
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T) => {
    const v = params.get(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  };
  const filters: Filters = {
    q: params.get("q") ?? base.q,
    due: pick<DuePreset>("due", ["overdue", "7d", "30d", "60d", "all"], base.due),
    status: pick<StatusFilter>("status", ["all", "ATIVO", "FEITO", "ARQUIVADO"], base.status),
    reminderType: pick("tipo", ["all", "vacina", "medicação", "outro"], base.reminderType),
    pet: pick("pet", ["all", "with_pet", "without_pet"], base.pet),
    branchId: params.get("filial") ?? base.branchId,
    contact: pick<ContactFilter>("contato", ["all", "not_contacted", "no_response"], base.contact),
  };
  const size = Number(params.get("exibir"));
  const page = Number(params.get("pagina"));
  return {
    filters,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : 25,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeListState(filters: Filters, page: number, pageSize: PageSize) {
  const d = defaults();
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.due !== d.due) params.set("due", filters.due);
  if (filters.status !== d.status) params.set("status", filters.status);
  if (filters.reminderType !== d.reminderType) params.set("tipo", filters.reminderType);
  if (filters.pet !== d.pet) params.set("pet", filters.pet);
  if (filters.branchId !== d.branchId) params.set("filial", filters.branchId);
  if (filters.contact !== d.contact) params.set("contato", filters.contact);
  if (pageSize !== 25) params.set("exibir", String(pageSize));
  if (page > 1) params.set("pagina", String(page));
  return params;
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

function tutorAddressParts(row: DueReminderRow) {
  return {
    street: row.tutor_street,
    number: row.tutor_number,
    city: row.tutor_city,
    neighborhood: row.tutor_neighborhood,
    uf: row.tutor_uf,
  };
}

function formatTutorAddress(row: DueReminderRow) {
  return formatTutorAddressLine(tutorAddressParts(row)) || null;
}

export default function Reminders() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState<DueReminderRow | null>(null);
  const [editRow, setEditRow] = useState<DueReminderRow | null>(null);
  const initial = useMemo(() => readListState(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState<PageSize>(initial.pageSize);

  const [filters, setFilters] = useState<Filters>(() => {
    // Filters are intentionally not remembered between visits: a forgotten search used to hide reminders.
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    return initial.filters;
  });

  useEffect(() => {
    setSearchParams(writeListState(filters, page, pageSize), { replace: true });
  }, [filters, page, pageSize, setSearchParams]);

  const persist = (next: Filters) => {
    setFilters(next);
  };

  const hasActiveFilters = useMemo(() => {
    const d = defaults();
    return (Object.keys(d) as Array<keyof Filters>).some((k) => filters[k] !== d[k]);
  }, [filters]);

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
          "id, org_id, branch_id, tutor_id, pet_id, due_date, reference_appointment_id, reference_record_id, last_applied_at, reminder_type, item_name, message_template_id, status, last_sent_at, send_count, notes, quantity, created_at, is_active, tutor:tutors(name, phone1, phone2, street, number, complement, neighborhood, city, uf), pet:pets(name)",
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
        quantity: number | null;
        tutor: {
          name: string;
          phone1: string | null;
          phone2: string | null;
          street: string | null;
          number: string | null;
          complement: string | null;
          neighborhood: string | null;
          city: string | null;
          uf: string | null;
        } | null;
        pet: { name: string | null } | null;
      };

      const mapped = ((data ?? []) as unknown as ReminderJoinRow[]).map((r) => ({
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
        quantity: r.quantity ?? 1,
        tutor_name: r.tutor?.name ?? "",
        tutor_phone1: r.tutor?.phone1 ?? null,
        tutor_phone2: r.tutor?.phone2 ?? null,
        tutor_street: r.tutor?.street ?? null,
        tutor_number: r.tutor?.number ?? null,
        tutor_complement: r.tutor?.complement ?? null,
        tutor_neighborhood: r.tutor?.neighborhood ?? null,
        tutor_city: r.tutor?.city ?? null,
        tutor_uf: r.tutor?.uf ?? null,
        pet_name: r.pet?.name ?? null,
      })) as DueReminderRow[];

      const today = dayjs();
      const byContact = mapped.filter((row) => {
        if (filters.contact === "not_contacted") return (row.send_count ?? 0) === 0;
        if (filters.contact === "no_response") {
          if (row.status !== "ATIVO" || !row.last_sent_at || (row.send_count ?? 0) === 0) return false;
          return today.diff(dayjs(row.last_sent_at), "day") >= NO_RESPONSE_DAYS;
        }
        return true;
      });

      if (!term) return byContact;

      return byContact.filter((row) =>
        matchesSearchAny(
          [row.tutor_name, row.pet_name, row.tutor_phone1, row.tutor_phone2, row.notes, row.reminder_type, row.item_name],
          term,
        ),
      );
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

  const { openWhats: sendWhatsReminder, whatsDialog } = useWhatsReminderSend(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["reminders", "list"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
    ]);
  });

  useEffect(() => {
    // Only clamp once the list is loaded, otherwise a page restored from the URL would collapse to 1 while loading.
    if (rows.isSuccess && page > totalPages) setPage(totalPages);
  }, [rows.isSuccess, page, totalPages]);

  // Changing a filter or the page size goes back to page 1, except for the initial render (page restored from the URL).
  const listStateRef = useRef({ filters, pageSize });
  useEffect(() => {
    const prev = listStateRef.current;
    if (prev.filters !== filters || prev.pageSize !== pageSize) setPage(1);
    listStateRef.current = { filters, pageSize };
  }, [filters, pageSize]);

  return (
    <div className="space-y-7">
      <PageHeader
        badge="Fila operacional"
        title="Lembretes"
        description="Priorize lembretes vencidos, resolva contatos e arquive pendências."
        actions={
          <Button onClick={() => nav("/reminders/new")}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Agendar vacinação
          </Button>
        }
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
            <Select value={filters.contact} onValueChange={(v) => persist({ ...filters, contact: v as ContactFilter })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Contato" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Qualquer contato</SelectItem>
                <SelectItem value="not_contacted">Nunca contatado</SelectItem>
                <SelectItem value="no_response">Contatado sem retorno ({NO_RESPONSE_DAYS}+ dias)</SelectItem>
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
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs font-medium text-vetvax-text-secondary">Exibir</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPage(1);
                  setPageSize(Number(v) as 10 | 25 | 50 | 100);
                }}
              >
                <SelectTrigger className="w-[84px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={refetchAll}>
              Atualizar
            </Button>
          </>
        }
      />

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-vetvax-warning/40 bg-vetvax-warning-soft px-4 py-2.5">
          <p className="text-sm font-semibold text-vetvax-warning">Filtros ativos — a lista pode estar mostrando só parte dos lembretes.</p>
          <Button size="sm" variant="outline" onClick={() => persist(defaults())}>
            Limpar filtros
          </Button>
        </div>
      ) : null}

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
            const days = daysDiffFromToday(row.due_date);
            const urgency = getReminderUrgency(row.due_date);
            const dueLabel =
              urgency === "overdue"
                ? `vencido há ${Math.abs(days)}d`
                : urgency === "soon"
                  ? days === 0
                    ? "vence hoje"
                    : `vence em ${days}d`
                  : "a vencer";
            return (
              <RichListItem key={row.id} className="border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40">
                <div className="grid gap-3 md:grid-cols-[5px_1fr_auto] md:items-center">
                  <div className={`h-full rounded-pill ${row.status === "ATIVO" ? URGENCY_STRIPE_CLASS[urgency] : "bg-transparent"}`} />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-vetvax-text-tertiary">{dayjs(row.due_date).format("DD/MM/YYYY")}</p>
                      <StatusBadge tone={URGENCY_BADGE_TONE[urgency]}>{dueLabel}</StatusBadge>
                      {row.status === "ATIVO" ? <StatusBadge tone="warning">ativo</StatusBadge> : null}
                      {row.status === "FEITO" ? <StatusBadge tone="success">resolvido</StatusBadge> : null}
                      {row.status === "ARQUIVADO" ? <StatusBadge>arquivado</StatusBadge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-sm font-semibold text-vetvax-text-main">{row.tutor_name}</p>
                      {row.pet_name ? (
                        <PetBadge name={row.pet_name} />
                      ) : null}
                    </div>
                    <p className="text-xs text-vetvax-text-secondary">
                      {[row.tutor_phone1, row.tutor_phone2].filter(Boolean).join(" • ") || "Sem contato"} • {row.item_name ?? row.reminder_type}
                      {" • "}
                      {row.quantity} {row.quantity === 1 ? "dose" : "doses"}
                    </p>
                    {formatTutorAddress(row) ? (
                      <a
                        href={buildGoogleMapsUrl(tutorAddressParts(row)) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex w-fit items-center gap-1 text-xs text-vetvax-text-tertiary hover:text-vetvax-primary hover:underline"
                      >
                        📍 {formatTutorAddress(row)}
                      </a>
                    ) : null}
                    {displayReminderNotes(row.notes) ? (
                      <p className="text-xs text-vetvax-text-tertiary">{displayReminderNotes(row.notes)}</p>
                    ) : null}
                    {(row.send_count ?? 0) > 0 ? (
                      <p className="text-[11px] font-medium text-vetvax-text-tertiary">
                        📤 Contatado {row.send_count}x
                        {row.last_sent_at ? ` • último há ${Math.max(0, dayjs().diff(dayjs(row.last_sent_at), "day"))}d` : ""}
                        {row.status === "ATIVO" && row.last_sent_at && dayjs().diff(dayjs(row.last_sent_at), "day") >= NO_RESPONSE_DAYS
                          ? " • sem retorno"
                          : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-vetvax-text-tertiary">Nunca contatado</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => sendWhatsReminder(row)}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" title="Mudar data, vacina ou observação deste agendamento" onClick={() => setEditRow(row)}>
                      <Pencil className="mr-1.5 h-4 w-4" />Editar
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
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      {whatsDialog}

      <EditReminderDialog
        row={editRow}
        onOpenChange={(v) => {
          if (!v) setEditRow(null);
        }}
        onSaved={async () => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["reminders", "list"] }),
            qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
            qc.invalidateQueries({ queryKey: ["topbar", "reminders"] }),
          ]);
        }}
      />

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
          nav(`/vaccinations/new?tutor=${encodeURIComponent(row.tutor_id)}&resolveReminder=${encodeURIComponent(row.id)}`, {
            state: { returnTo: `${location.pathname}${location.search}` },
          });
        }}
      />
    </div>
  );
}