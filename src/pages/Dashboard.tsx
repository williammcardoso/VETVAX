import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, MoreHorizontal, Search, Syringe, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dayjs } from "@/lib/datetime";
import PageHeader from "@/components/layout/PageHeader";
import MetricTile from "@/components/vetvax/MetricTile";
import StatusBadge from "@/components/vetvax/StatusBadge";
import RichListItem from "@/components/vetvax/RichListItem";
import EmptyState from "@/components/vetvax/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatTutorAddressLine } from "@/lib/address";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { buildWhatsAppLink } from "@/lib/phone";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import CheckoutDialog from "@/components/dashboard/CheckoutDialog";
import RescheduleDialog from "@/components/dashboard/RescheduleDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import type { Tutor } from "@/types/vetvax";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Filters = {
  q: string;
};

const LS_KEY = "vetvax.dashboard.filters";

function defaultFilters(): Filters {
  return { q: "" };
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
  const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");

  const [totalClients, newClients, appliedMonth, activeReminders] = await Promise.all([
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("is_active", true).gte("created_at", `${monthStart}T00:00:00`),
    supabase
      .from("appointment_checkouts")
      .select("id", { count: "exact", head: true })
      .eq("status_result", "APLICADO")
      .gte("checkout_date", monthStart)
      .lte("checkout_date", monthEnd),
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
  const { buildAppointmentMessage, pickPhone } = useWhatsMessage();
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
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

  const upcoming = useQuery({
    queryKey: ["dashboard", "upcoming", filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_upcoming_appointments")
        .select("*")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      const term = filters.q.trim();
      if (term) {
        q = q.or(`tutor_name.ilike.%${term}%,tutor_phone1.ilike.%${term}%,tutor_phone2.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UpcomingAppointmentRow[];
    },
  });

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

  const overdueAppointments = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return (upcoming.data ?? []).filter((row) => row.scheduled_date < today).length;
  }, [upcoming.data]);

  const onRefetch = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "upcoming"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
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

  const todayPendingCount = (upcoming.data ?? []).length;
  const criticalReminders = remindersSorted.slice(0, 5);
  const filteredRows = upcoming.data ?? [];
  const priorityTotalPages = Math.max(1, Math.ceil(filteredRows.length / priorityPageSize));
  const priorityRows = useMemo(() => {
    const start = (priorityPage - 1) * priorityPageSize;
    return filteredRows.slice(start, start + priorityPageSize);
  }, [filteredRows, priorityPage, priorityPageSize]);

  useEffect(() => {
    setPriorityPage(1);
  }, [filters.q, priorityPageSize]);

  useEffect(() => {
    if (priorityPage > priorityTotalPages) setPriorityPage(priorityTotalPages);
  }, [priorityPage, priorityTotalPages]);

  const cancelAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "CANCELADO" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setCancelConfirmId(null);
      toast({ title: "Atendimento cancelado" });
      await onRefetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível cancelar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Operação"
        title="Central de vacinação"
        description="Acompanhe pendências, atrasos, lembretes e aplicações em uma visão operacional."
      />

      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#0d4f4a] p-6 text-white shadow-vetvax-card ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Hoje, o que precisa acontecer?</h2>
            <p className="mt-1 text-sm text-white/75">{todayPendingCount} ações operacionais aguardando atendimento.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Pendentes" value={todayPendingCount} tone="inverse" />
            <MetricTile label="Atrasados" value={overdueAppointments} tone="inverse" />
            <MetricTile label="Lembretes" value={kpis.data?.overdue_reminders ?? 0} tone="inverse" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Clientes ativos" value={businessKpis.data?.totalClients ?? 0} icon={Users} />
        <MetricTile label="Novos no mês" value={businessKpis.data?.newClientsMonth ?? 0} icon={UserPlus} />
        <MetricTile label="Vacinas no mês" value={businessKpis.data?.vaccinesMonth ?? 0} icon={Syringe} />
        <MetricTile label="Lembretes ativos" value={businessKpis.data?.activeReminders ?? 0} icon={Clock3} />
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <section className="min-w-0 rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="vetvax-section-title">Prioridade operacional</h2>
              <p className="mt-1 text-xs text-vetvax-text-tertiary">Atendimentos pendentes com foco nos atrasados. ({filteredRows.length} registros)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
                <Input
                  className="pl-9"
                  placeholder="Buscar cliente / telefone..."
                  value={filters.q}
                  onChange={(e) => persist({ ...filters, q: e.target.value })}
                />
              </div>
              <Button variant="outline" onClick={onRefetch}>
                Atualizar
              </Button>
              <Select value={String(priorityPageSize)} onValueChange={(v) => setPriorityPageSize(Number(v) as 10 | 20 | 30 | 50 | 100)}>
                <SelectTrigger className="w-[96px]">
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

          <div className="space-y-2">
            {upcoming.isLoading &&
              Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-[84px] rounded-card-md" />)}

            {!upcoming.isLoading && (upcoming.data?.length ?? 0) === 0 && (
              <EmptyState
                icon={Clock3}
                title="Sem pendências no momento"
                description="Quando novos agendamentos pendentes surgirem, eles aparecerão nesta fila."
              />
            )}

            {priorityRows.map((row) => {
              const isOverdue = row.scheduled_date < dayjs().format("YYYY-MM-DD");
              const rowAddressData: Pick<Tutor, "street" | "number" | "city" | "neighborhood" | "uf"> = {
                street: (row as UpcomingAppointmentRow & Partial<Pick<Tutor, "street">>).street ?? null,
                number: (row as UpcomingAppointmentRow & Partial<Pick<Tutor, "number">>).number ?? null,
                city: (row as UpcomingAppointmentRow & Partial<Pick<Tutor, "city">>).city ?? null,
                neighborhood: (row as UpcomingAppointmentRow & Partial<Pick<Tutor, "neighborhood">>).neighborhood ?? null,
                uf: (row as UpcomingAppointmentRow & Partial<Pick<Tutor, "uf">>).uf ?? null,
              };
              const address = formatTutorAddressLine(rowAddressData);
              return (
                <RichListItem key={row.id}>
                  <div className="grid min-h-[84px] gap-3 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,240px)_auto] md:items-center">
                    <div>
                      <p className="text-[18px] font-bold text-vetvax-primary">{String(row.scheduled_time).slice(0, 5)}</p>
                      <p className="text-xs text-vetvax-text-tertiary">{dayjs(row.scheduled_date).format("DD/MM/YYYY")}</p>
                      {isOverdue ? <StatusBadge tone="danger" className="mt-1">Atrasado</StatusBadge> : null}
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
                        {address ? <p className="truncate text-xs text-vetvax-text-tertiary">{address}</p> : null}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {(row.items ?? []).slice(0, 3).map((it, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex min-h-[26px] items-center rounded-pill border px-2.5 py-1 text-[11px] font-bold leading-none ${getItemTone(it.item)}`}
                          title={it.item}
                        >
                          {it.quantity}x {it.item}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
                          if (!phone) return;
                          const msg = await buildAppointmentMessage(row);
                          window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
                        }}
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => setCheckoutId(row.id)}>Aplicar</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-control">
                          <DropdownMenuItem onClick={() => setRescheduleId(row.id)}>Reagendar</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setCancelConfirmId(row.id)}
                            disabled={cancelAppointment.isPending}
                          >
                            Marcar como cancelado
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

          {!upcoming.isLoading && filteredRows.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-vetvax-text-tertiary">
                Mostrando {(priorityPage - 1) * priorityPageSize + 1}-{Math.min(priorityPage * priorityPageSize, filteredRows.length)} de {filteredRows.length}
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

        <aside className="min-w-0 rounded-[16px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/50 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="vetvax-section-title">Lembretes críticos</h2>
            <StatusBadge tone="danger">{criticalReminders.length}</StatusBadge>
          </div>
          <div className="space-y-3">
            {reminders.isLoading &&
              Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-16 rounded-card-md" />)}
            {!reminders.isLoading &&
              criticalReminders.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/80 p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-vetvax hover:-translate-y-px hover:border-amber-200/80 hover:shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-vetvax-danger" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-vetvax-danger">{dayjs(row.due_date).format("DD/MM/YYYY")}</p>
                      <p className="truncate text-sm font-bold text-vetvax-text-main">{row.tutor_name}</p>
                      <p className="truncate text-xs text-vetvax-text-secondary">{row.reminder_type}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav("/reminders")}
                      className="h-8 px-2.5 text-xs"
                    >
                      WhatsApp
                    </Button>
                  </div>
                </div>
              ))}
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => nav("/reminders")}>
            Ver todos
          </Button>
        </aside>
      </div>

      <CheckoutDialog
        open={!!checkoutId}
        appointmentId={checkoutId}
        onOpenChange={(v) => !v && setCheckoutId(null)}
        onChanged={() => {
          setCheckoutId(null);
          onRefetch();
        }}
      />
      <RescheduleDialog open={!!rescheduleId} appointmentId={rescheduleId} onOpenChange={(v) => !v && setRescheduleId(null)} onChanged={onRefetch} />

      <AlertDialog open={!!cancelConfirmId} onOpenChange={(open) => !open && setCancelConfirmId(null)}>
        <AlertDialogContent className="rounded-control border-vetvax-border-soft">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse agendamento será mantido no histórico como <strong>cancelado</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-vetvax-danger hover:bg-[#b91c1c]"
              onClick={(event) => {
                event.preventDefault();
                if (!cancelConfirmId) return;
                cancelAppointment.mutate(cancelConfirmId);
              }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}