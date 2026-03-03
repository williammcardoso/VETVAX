import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Clock, ShieldAlert, Syringe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UpcomingAppointmentsTable from "@/components/dashboard/UpcomingAppointmentsTable";
import DueRemindersTable from "@/components/dashboard/DueRemindersTable";
import { dayjs } from "@/lib/datetime";
import KpiCard from "@/components/dashboard/KpiCard";

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
  const nav = useNavigate();

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
      let q = supabase
        .from("vw_due_reminders")
        .select("*")
        .order("due_date", { ascending: true })
        .limit(500);

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
  const remindersPageSize = 12;
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
      {/* Topo */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Agendamentos futuros e lembretes ativos — ordenados e prontos para ação.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-[420px]">
            <Input
              className="h-10 rounded-[12px] border-[1.5px] bg-card"
              placeholder="Busca global: tutor, telefone, pet…"
              value={filters.q}
              onChange={(e) => {
                setUpcomingPage(1);
                setRemindersPage(1);
                persist({ ...filters, q: e.target.value });
              }}
            />
          </div>
          <Button className="h-10 rounded-[12px] bg-primary hover:bg-[#1E40AF]" onClick={() => nav("/appointments/new")}>
            Novo agendamento
          </Button>
          <Button variant="outline" className="h-10 rounded-[12px] border-[1.5px]" onClick={onRefetch}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CalendarClock}
          badge="Futuro"
          label="Agendamentos futuros"
          value={upcoming.data?.length ?? "–"}
          tone="blue"
        />
        <KpiCard
          icon={Syringe}
          badge="Ativo"
          label="Lembretes ativos"
          value={reminders.data?.length ?? "–"}
          tone="amber"
        />
        <KpiCard
          icon={ShieldAlert}
          badge="Crítico"
          label="Lembretes vencidos"
          value={kpis.data?.overdue_reminders ?? "–"}
          tone="red"
        />
        <KpiCard
          icon={Clock}
          badge="Mês"
          label="Aplicações realizadas"
          value={kpis.data?.applied_month ?? "–"}
          tone="green"
        />
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-5 lg:grid-cols-[0.65fr_0.35fr]">
        <section className="vetvax-elevate rounded-[12px] bg-card border-[1.5px] p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Próximos agendamentos</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Ordenado por data/hora • total {upcoming.data?.length ?? 0}
              </div>
            </div>
            <Badge className="rounded-full border-0 bg-primary text-primary-foreground">PENDENTE</Badge>
          </div>

          <div className="mt-3">
            <UpcomingAppointmentsTable
              loading={upcoming.isLoading}
              rows={upcomingPaged}
              onChanged={onRefetch}
              variant="compact"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Página {upcomingPage} de {upcomingTotalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={upcomingPage <= 1 ? "outline" : "outline"}
                className="h-9 rounded-[12px] border-[1.5px]"
                disabled={upcomingPage <= 1}
                onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                className={
                  "h-9 rounded-[12px] border-[1.5px] " +
                  (upcomingPage >= upcomingTotalPages
                    ? "bg-transparent text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-[#1E40AF]")
                }
                variant={upcomingPage >= upcomingTotalPages ? "outline" : "default"}
                disabled={upcomingPage >= upcomingTotalPages}
                onClick={() => setUpcomingPage((p) => Math.min(upcomingTotalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </section>

        <section className="vetvax-elevate rounded-[12px] bg-card border-[1.5px] p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Lembretes</div>
              <div className="mt-1 text-xs text-muted-foreground">Vencidos primeiro • total {reminders.data?.length ?? 0}</div>
            </div>
            <Badge className="rounded-full border-0 bg-muted text-foreground">ATIVO</Badge>
          </div>

          <div className="mt-3 max-h-[560px] overflow-auto vetvax-scroll">
            <DueRemindersTable loading={reminders.isLoading} rows={remindersPaged} onChanged={onRefetch} />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Página {remindersPage} de {remindersTotalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 rounded-[12px] border-[1.5px]"
                disabled={remindersPage <= 1}
                onClick={() => setRemindersPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant={remindersPage >= remindersTotalPages ? "outline" : "default"}
                className={
                  "h-9 rounded-[12px] border-[1.5px] " +
                  (remindersPage >= remindersTotalPages
                    ? "bg-transparent text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-[#1E40AF]")
                }
                disabled={remindersPage >= remindersTotalPages}
                onClick={() => setRemindersPage((p) => Math.min(remindersTotalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}