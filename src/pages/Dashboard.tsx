import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ShieldAlert, Syringe, CheckCircle2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UpcomingAppointmentsTable from "@/components/dashboard/UpcomingAppointmentsTable";
import { dayjs } from "@/lib/datetime";
import KpiCard from "@/components/dashboard/KpiCard";
import PaginationBar from "@/components/vetvax/PaginationBar";
import DueRemindersList from "@/components/dashboard/DueRemindersList";
import { Button } from "@/components/ui/button";

type Filters = {
  q: string;
};

const LS_KEY = "vetvax.dashboard.filters";

function defaultFilters(): Filters {
  return { q: "" };
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

  const kpis = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKpis });

  const upcoming = useQuery({
    queryKey: ["dashboard", "upcoming", filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_upcoming_appointments")
        .select("*")
        .gte("scheduled_date", dayjs().format("YYYY-MM-DD"))
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

  const onRefetch = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard", "upcoming"] }),
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

  const upcomingPageSize = 14;
  const remindersPageSize = 8;
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [remindersPage, setRemindersPage] = useState(1);

  const upcomingPaged = useMemo(() => {
    const rows = upcoming.data ?? [];
    const start = (upcomingPage - 1) * upcomingPageSize;
    return rows.slice(start, start + upcomingPageSize);
  }, [upcoming.data, upcomingPage]);

  const remindersPaged = useMemo(() => {
    const rows = remindersSorted;
    const start = (remindersPage - 1) * remindersPageSize;
    return rows.slice(start, start + remindersPageSize);
  }, [remindersSorted, remindersPage]);

  const upcomingTotalPages = Math.max(1, Math.ceil((upcoming.data?.length ?? 0) / upcomingPageSize));
  const remindersTotalPages = Math.max(1, Math.ceil(remindersSorted.length / remindersPageSize));

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Hoje, o que precisa acontecer?</h1>
        <p className="text-sm text-muted-foreground">
          Os próximos agendamentos e lembretes importantes aparecem aqui. <span aria-hidden>⚠️</span> Fique de olho no resumo do mês.
        </p>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CalendarClock}
          badge="Total"
          label="Agendamentos futuros"
          value={upcoming.data?.length ?? "–"}
          tone="blue"
        />
        <KpiCard
          icon={Syringe}
          badge="Total"
          label="Lembretes ativos"
          value={reminders.data?.length ?? "–"}
          tone="amber"
        />
        <KpiCard
          icon={ShieldAlert}
          badge="Vencidos"
          label="Lembretes vencidos"
          value={kpis.data?.overdue_reminders ?? "–"}
          tone="red"
        />
        <KpiCard
          icon={CheckCircle2}
          badge="Mês"
          label="Aplicados (mês)"
          value={kpis.data?.applied_month ?? "–"}
          tone="green"
        />
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-5 lg:grid-cols-[0.66fr_0.34fr]">
        <section className="rounded-[14px] bg-card border border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold">Próximos agendamentos</div>
              <div className="mt-1 text-xs text-muted-foreground">Ordenado por data/hora • total {upcoming.data?.length ?? 0}</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-[12px] border bg-background pl-9"
                  placeholder="Buscar tutor / telefone..."
                  value={filters.q}
                  onChange={(e) => {
                    setUpcomingPage(1);
                    setRemindersPage(1);
                    persist({ ...filters, q: e.target.value });
                  }}
                />
              </div>
              <Button variant="outline" className="h-10 rounded-[12px] border" onClick={onRefetch}>
                Atualizar
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <UpcomingAppointmentsTable
              loading={upcoming.isLoading}
              rows={upcomingPaged}
              onChanged={onRefetch}
              variant="compact"
            />
          </div>

          <div className="mt-4">
            <PaginationBar page={upcomingPage} totalPages={upcomingTotalPages} onPageChange={setUpcomingPage} />
          </div>
        </section>

        <section className="rounded-[14px] bg-card border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Lembretes</div>
              <div className="mt-1 text-xs text-muted-foreground">Vencidos primeiro • total {reminders.data?.length ?? 0}</div>
            </div>
            <Badge className="rounded-full border bg-muted text-foreground">Total</Badge>
          </div>

          <div className="mt-4 overflow-hidden rounded-[12px] border border-border bg-background">
            <DueRemindersList loading={reminders.isLoading} rows={remindersPaged} onChanged={onRefetch} />
          </div>

          <div className="mt-4">
            <PaginationBar page={remindersPage} totalPages={remindersTotalPages} onPageChange={setRemindersPage} />
          </div>
        </section>
      </div>
    </div>
  );
}