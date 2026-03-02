import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, MessageCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UpcomingAppointmentsTable from "@/components/dashboard/UpcomingAppointmentsTable";
import DueRemindersTable from "@/components/dashboard/DueRemindersTable";
import { dayjs } from "@/lib/datetime";
import KpiCard from "@/components/dashboard/KpiCard";

type Filters = {
  channel: "all" | "store" | "phone" | "whatsapp" | "other";
  q: string;
};

const LS_KEY = "vetvax.dashboard.filters";

function defaultFilters(): Filters {
  return { channel: "all", q: "" };
}

async function fetchKpis() {
  const { data, error } = await supabase.from("vw_dashboard_kpis").select("*").limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as DashboardKpis | null;
}

export default function Dashboard() {
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultFilters();
      return { ...defaultFilters(), ...(JSON.parse(raw) as Partial<Filters>) };
    } catch {
      return defaultFilters();
    }
  });

  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const end7 = useMemo(() => dayjs().add(6, "day").format("YYYY-MM-DD"), []);

  const kpis = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKpis });

  const todayAppointments = useQuery({
    queryKey: ["dashboard", "today", today, filters.channel, filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_upcoming_appointments")
        .select("*")
        .eq("scheduled_date", today)
        .order("scheduled_time", { ascending: true });

      if (filters.channel !== "all") q = q.eq("channel", filters.channel);

      const term = filters.q.trim();
      if (term) {
        q = q.or(`tutor_name.ilike.%${term}%,tutor_phone1.ilike.%${term}%,tutor_phone2.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UpcomingAppointmentRow[];
    },
  });

  const next7Appointments = useQuery({
    queryKey: ["dashboard", "next7", today, end7, filters.channel, filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_upcoming_appointments")
        .select("*")
        .gt("scheduled_date", today)
        .lte("scheduled_date", end7)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (filters.channel !== "all") q = q.eq("channel", filters.channel);

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
    queryKey: ["dashboard", "reminders", today, end7, filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_due_reminders")
        .select("*")
        .lte("due_date", end7)
        .order("due_date", { ascending: true })
        .limit(200);

      const term = filters.q.trim();
      if (term) {
        q = q.or(`tutor_name.ilike.%${term}%,tutor_phone1.ilike.%${term}%,tutor_phone2.ilike.%${term}%,pet_name.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DueReminderRow[];
    },
  });

  const overdueReminders = useMemo(() => {
    const list = reminders.data ?? [];
    return list.filter((r) => r.due_date < today);
  }, [reminders.data, today]);

  const upcomingReminders7 = useMemo(() => {
    const list = reminders.data ?? [];
    return list.filter((r) => r.due_date >= today && r.due_date <= end7);
  }, [reminders.data, today, end7]);

  const onRefetch = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "today"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "next7"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "reminders"] }),
      qc.invalidateQueries({ queryKey: ["dashboard", "kpis"] }),
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground">Hoje</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[82ch] leading-relaxed">
            O que precisa acontecer hoje: agendamentos do dia e lembretes críticos.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-[360px]">
            <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 rounded-md border-border bg-card focus-visible:ring-primary/25"
              placeholder="Buscar tutor / telefone…"
              value={filters.q}
              onChange={(e) => persist({ ...filters, q: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.channel}
              onValueChange={(v) => persist({ ...filters, channel: v as Filters["channel"] })}
            >
              <SelectTrigger className="w-[170px] rounded-md bg-card">
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="store">Loja</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="rounded-md" onClick={onRefetch}>
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          icon={MessageCircle}
          badge="Hoje"
          label="Agendamentos hoje"
          value={kpis.data?.pending_today ?? "–"}
          tone="blue"
        />
        <KpiCard
          icon={ShieldAlert}
          badge="Hoje"
          label="Lembretes vencidos"
          value={kpis.data?.overdue_reminders ?? "–"}
          tone="red"
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold tracking-tight">Agendamentos de hoje</div>
            <div className="mt-1 text-xs text-muted-foreground">{dayjs().format("DD/MM/YYYY")}</div>
          </div>
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
            FOCO
          </Badge>
        </div>

        <UpcomingAppointmentsTable
          loading={todayAppointments.isLoading}
          rows={todayAppointments.data ?? []}
          onChanged={onRefetch}
          variant="today"
        />
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold tracking-tight">Próximos 7 dias</div>
              <div className="mt-1 text-xs text-muted-foreground">Amanhã → {dayjs().add(6, "day").format("DD/MM")}</div>
            </div>
            <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
              COMPACTO
            </Badge>
          </div>

          <UpcomingAppointmentsTable
            loading={next7Appointments.isLoading}
            rows={next7Appointments.data ?? []}
            onChanged={onRefetch}
            variant="compact"
          />
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold tracking-tight">Lembretes vencidos</div>
                <div className="mt-1 text-xs text-muted-foreground">Somente críticos</div>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full bg-red-600/10 text-red-700"
              >
                {overdueReminders.length}
              </Badge>
            </div>

            <div className="mt-4">
              {overdueReminders.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nenhum vencido. Tudo em dia.</div>
              ) : (
                <DueRemindersTable loading={reminders.isLoading} rows={overdueReminders} onChanged={onRefetch} />
              )}
            </div>
          </div>

          <div className="rounded-lg bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold tracking-tight">Próximos 7 dias</div>
                <div className="mt-1 text-xs text-muted-foreground">Para antecipar contato</div>
              </div>
              <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
                {upcomingReminders7.length}
              </Badge>
            </div>

            <div className="mt-4">
              {upcomingReminders7.length === 0 ? (
                <div className="text-xs text-muted-foreground">Sem lembretes próximos.</div>
              ) : (
                <DueRemindersTable
                  loading={reminders.isLoading}
                  rows={upcomingReminders7}
                  onChanged={onRefetch}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}