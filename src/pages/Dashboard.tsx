import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock3, MoreHorizontal, Search, Syringe, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, VaccinationRecordRow } from "@/types/vetvax";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dayjs } from "@/lib/datetime";
import PageHeader from "@/components/layout/PageHeader";
import MetricTile from "@/components/vetvax/MetricTile";
import StatusBadge from "@/components/vetvax/StatusBadge";
import RichListItem from "@/components/vetvax/RichListItem";
import EmptyState from "@/components/vetvax/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { buildWhatsAppLink } from "@/lib/phone";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

type Filters = {
  q: string;
  hideOverdue: boolean;
};

const LS_KEY = "vetvax.dashboard.filters";

function defaultFilters(): Filters {
  return { q: "", hideOverdue: true };
}

function getItemTone(itemName: string) {
  const palette = [
    "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]",
    "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    "border-[#a7f3d0] bg-[#ecfeff] text-[#0f766e]",
    "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
  ];
  const value = itemName.toLowerCase();
  if (value.includes("v8") || value.includes("v10") || value.includes("polivalente")) {
    return "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]";
  }
  if (value.includes("raiva") || value.includes("antirr")) {
    return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  }
  if (value.includes("giardia") || value.includes("verm")) {
    return "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]";
  }
  if (value.includes("lepto") || value.includes("gripe") || value.includes("influenza")) {
    return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
  }
  if (value.includes("fiv") || value.includes("felv")) {
    return "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  }
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

async function fetchKpis() {
  const { data, error } = await supabase.from("vw_dashboard_kpis").select("*").limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as DashboardKpis | null;
}

async function fetchBusinessKpis() {
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");

  const [totalClients, newClients, appliedMonth, activeReminders] = await Promise.all([
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("is_active", true).gte("created_at", `${monthStart}T00:00:00`),
    supabase
      .from("vaccination_records")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("applied_date", monthStart),
    supabase.from("reminders").select("id", { count: "exact", head: true }).eq("status", "ATIVO").eq("is_active", true),
  ]);

  if (totalClients.error) throw totalClients.error;
  if (newClients.error) throw newClients.error;
  if (appliedMonth.error) throw appliedMonth.error;
  if (activeReminders.error) throw activeReminders.error;

  return {
    totalClients: totalClients.count ?? 0,
    newClientsMonth: newClients.count ?? 0,
    vaccinesMonth: appliedMonth.count ?? 0,
    activeReminders: activeReminders.count ?? 0,
  };
}

export default function Dashboard() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { buildReminderMessage, pickPhone } = useWhatsMessage();
  const [priorityPage, setPriorityPage] = useState(1);
  const [priorityPageSize, setPriorityPageSize] = useState<10 | 20 | 30 | 50 | 100>(20);

  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultFilters();
      return { ...defaultFilters(), ...(JSON.parse(raw) as Partial<Filters>) };
    } catch {
      return defaultFilters();
    }
  });

  const kpis = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKpis });
  const businessKpis = useQuery({ queryKey: ["dashboard", "business-kpis"], queryFn: fetchBusinessKpis });

  const reminders = useQuery({
    queryKey: ["dashboard", "reminders", filters.q],
    queryFn: async () => {
      let q = supabase.from("vw_due_reminders").select("*").order("due_date", { ascending: true }).limit(500);

      const term = filters.q.trim();
      if (term) {
        q = q.or(`tutor_name.ilike.%${term}%,tutor_phone1.ilike.%${term}%,tutor_phone2.ilike.%${term}%,pet_name.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DueReminderRow[];
    },
  });

  const recentRecords = useQuery({
    queryKey: ["dashboard", "recent-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_vaccination_records")
        .select("*")
        .order("applied_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as VaccinationRecordRow[];
    },
  });

  const remindersSorted = useMemo(() => {
    const list = reminders.data ?? [];
    const today = dayjs().format("YYYY-MM-DD");
    return [...list].sort((a, b) => {
      const ao = a.due_date < today ? 0 : 1;
      const bo = b.due_date < today ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.due_date.localeCompare(b.due_date);
    });
  }, [reminders.data]);

  const overdueReminders = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return remindersSorted.filter((row) => row.due_date < today).length;
  }, [remindersSorted]);

  const onRefetch = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "recent-records"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "kpis"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "business-kpis"] }),
    ]);
  };

  const persist = (next: Filters) => {
    setFilters(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const visibleReminders = useMemo(() => {
    if (!filters.hideOverdue) return remindersSorted;
    const today = dayjs().format("YYYY-MM-DD");
    return remindersSorted.filter((row) => row.due_date >= today);
  }, [remindersSorted, filters.hideOverdue]);

  const priorityTotalPages = Math.max(1, Math.ceil(visibleReminders.length / priorityPageSize));
  const priorityRows = useMemo(() => {
    const start = (priorityPage - 1) * priorityPageSize;
    return visibleReminders.slice(start, start + priorityPageSize);
  }, [visibleReminders, priorityPage, priorityPageSize]);

  useEffect(() => {
    setPriorityPage(1);
  }, [filters.q, filters.hideOverdue, priorityPageSize]);

  useEffect(() => {
    if (priorityPage > priorityTotalPages) setPriorityPage(priorityTotalPages);
  }, [priorityPage, priorityTotalPages]);

  const archiveReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").update({ status: "ARQUIVADO" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Lembrete arquivado" });
      await onRefetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível arquivar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-7 overflow-x-hidden">
      <PageHeader
        badge="Operação"
        title="Central de vacinação"
        description="Acompanhe lembretes vencidos, próximas doses e as últimas aplicações registradas."
      />

      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#0d4f4a] p-6 text-white shadow-vetvax-card ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Hoje, quem precisa de contato?</h2>
            <p className="mt-1 text-sm text-white/75">{remindersSorted.length} lembretes ativos aguardando ação.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Vencidos" value={overdueReminders} tone="inverse" />
            <MetricTile label="Lembretes ativos" value={kpis.data?.active_reminders ?? 0} tone="inverse" />
            <MetricTile label="Aplicadas hoje" value={kpis.data?.applied_today ?? 0} tone="inverse" />
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-vetvax-border-soft/80 bg-white/80 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Clientes ativos" value={businessKpis.data?.totalClients ?? 0} icon={Users} tone="info" />
          <MetricTile label="Novos no mês" value={businessKpis.data?.newClientsMonth ?? 0} icon={UserPlus} tone="success" />
          <MetricTile label="Vacinas no mês" value={businessKpis.data?.vaccinesMonth ?? 0} icon={Syringe} tone="warning" />
          <MetricTile label="Lembretes ativos" value={businessKpis.data?.activeReminders ?? 0} icon={Clock3} tone="danger" />
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-start">
        <section className="min-w-0 rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02] lg:h-full">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="vetvax-section-title">Lembretes por vencer</h2>
              <p className="mt-1 text-xs text-vetvax-text-tertiary">
                Priorize contatos com vencidos primeiro. ({visibleReminders.length} registros
                {filters.hideOverdue && overdueReminders > 0 ? `, ${overdueReminders} vencido(s) oculto(s)` : ""})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="relative w-full sm:w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
                <Input
                  className="pl-9"
                  placeholder="Buscar cliente / telefone / pet..."
                  value={filters.q}
                  onChange={(e) => persist({ ...filters, q: e.target.value })}
                />
              </div>
              <Button variant="outline" className="shrink-0" onClick={onRefetch}>
                Atualizar
              </Button>
              <Select value={String(priorityPageSize)} onValueChange={(v) => setPriorityPageSize(Number(v) as 10 | 20 | 30 | 50 | 100)}>
                <SelectTrigger className="w-[96px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-vetvax-text-secondary">
            <Checkbox
              checked={filters.hideOverdue}
              onCheckedChange={(v) => persist({ ...filters, hideOverdue: v === true })}
            />
            Ocultar vencidos/atrasados
          </label>

          <div className="space-y-2">
            {reminders.isLoading &&
              Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-[84px] rounded-card-md" />)}

            {!reminders.isLoading && visibleReminders.length === 0 && (
              <EmptyState
                icon={Bell}
                title={filters.hideOverdue && overdueReminders > 0 ? "Nenhum lembrete a vencer" : "Sem lembretes ativos"}
                description={
                  filters.hideOverdue && overdueReminders > 0
                    ? `Há ${overdueReminders} vencido(s) oculto(s) — desmarque "Ocultar vencidos/atrasados" para vê-los.`
                    : "Quando uma aplicação tiver próxima dose prevista, o lembrete aparece aqui."
                }
              />
            )}

            {priorityRows.map((row) => {
              const isOverdue = row.due_date < dayjs().format("YYYY-MM-DD");
              return (
                <RichListItem key={row.id}>
                  <div className="grid min-h-[84px] gap-3 md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <p className="text-[13px] font-bold text-vetvax-primary">{dayjs(row.due_date).format("DD/MM/YYYY")}</p>
                      {isOverdue ? <StatusBadge tone="danger" className="mt-1">Vencido</StatusBadge> : <StatusBadge tone="warning" className="mt-1">A vencer</StatusBadge>}
                    </div>

                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-vetvax-primary-soft text-xs font-bold text-vetvax-primary">
                          {row.tutor_name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-vetvax-text-main">{row.tutor_name}</p>
                        <p className="text-xs text-vetvax-text-tertiary">{row.tutor_phone1 ?? row.tutor_phone2 ?? "Sem telefone"}</p>
                        <span className={`mt-1 inline-flex max-w-full min-h-[22px] items-center truncate rounded-pill border px-2 py-0.5 text-[11px] font-bold leading-none ${getItemTone(row.item_name ?? row.reminder_type)}`}>
                          {row.pet_name ? `${row.pet_name} • ` : ""}
                          {row.item_name ?? row.reminder_type}
                        </span>
                        {row.notes ? <p className="mt-1 line-clamp-2 text-xs text-vetvax-text-secondary">{row.notes}</p> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
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
                          if (!error) await onRefetch();
                          window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
                        }}
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => nav(`/vaccinations/new?tutor=${row.tutor_id}&resolveReminder=${row.id}`)}>Registrar aplicação</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-control">
                          <DropdownMenuItem onClick={() => archiveReminder.mutate(row.id)} disabled={archiveReminder.isPending}>
                            Arquivar lembrete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => nav(`/tutors/${row.tutor_id}`)}>Ver cliente</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </RichListItem>
              );
            })}
          </div>

          {!reminders.isLoading && visibleReminders.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-vetvax-text-tertiary">
                Mostrando {(priorityPage - 1) * priorityPageSize + 1}-{Math.min(priorityPage * priorityPageSize, visibleReminders.length)} de {visibleReminders.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={priorityPage <= 1} onClick={() => setPriorityPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <span className="text-xs font-semibold text-vetvax-text-secondary">
                  Página {priorityPage} de {priorityTotalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={priorityPage >= priorityTotalPages}
                  onClick={() => setPriorityPage((p) => Math.min(priorityTotalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 rounded-[16px] border border-vetvax-border-soft bg-gradient-to-b from-white via-vetvax-surface-panel/40 to-[#ecfdf5] p-4 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="vetvax-section-title">Últimos registros</h2>
            <StatusBadge tone="success">{recentRecords.data?.length ?? 0}</StatusBadge>
          </div>
          <div className="space-y-3">
            {recentRecords.isLoading &&
              Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 rounded-card-md" />)}
            {!recentRecords.isLoading &&
              (recentRecords.data ?? []).map((row) => (
                <div
                  key={row.id}
                  className="rounded-[14px] border border-vetvax-border-soft bg-white/95 p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-vetvax hover:-translate-y-px hover:border-vetvax-primary-border hover:shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-vetvax-success shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-vetvax-success">{dayjs(row.applied_date).format("DD/MM/YYYY")}</p>
                      <p className="break-words text-sm font-extrabold leading-tight text-vetvax-text-main">{row.tutor_name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(row.items ?? []).slice(0, 2).map((it, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex max-w-full items-center truncate rounded-pill border px-2 py-0.5 text-[10px] font-bold leading-none ${getItemTone(it.item)}`}
                          >
                            {it.quantity}x {it.item}
                            {it.pet_name ? ` • ${it.pet_name}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            {!recentRecords.isLoading && (recentRecords.data?.length ?? 0) === 0 && (
              <p className="rounded-[12px] border border-dashed border-vetvax-border-soft px-3 py-5 text-center text-xs text-vetvax-text-tertiary">
                Nenhuma aplicação registrada ainda.
              </p>
            )}
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => nav("/reports")}>
            Ver relatório completo
          </Button>
        </aside>
      </div>
    </div>
  );
}
