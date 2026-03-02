import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock, Filter, MessageCircle, ShieldAlert, Syringe, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardKpis, DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UpcomingAppointmentsTable from "@/components/dashboard/UpcomingAppointmentsTable";
import DueRemindersTable from "@/components/dashboard/DueRemindersTable";
import { dayjs } from "@/lib/datetime";
import KpiCard from "@/components/dashboard/KpiCard";

type DatePreset = "today" | "tomorrow" | "7d" | "month";

type Filters = {
  preset: DatePreset;
  channel: "all" | "store" | "phone" | "whatsapp" | "other";
  q: string;
};

const LS_KEY = "vetvax.dashboard.filters";

function defaultFilters(): Filters {
  return { preset: "7d", channel: "all", q: "" };
}

function presetToRange(preset: DatePreset) {
  const start = dayjs().startOf("day");
  if (preset === "today") return { from: start, to: start };
  if (preset === "tomorrow") {
    const d = start.add(1, "day");
    return { from: d, to: d };
  }
  if (preset === "month") {
    return { from: start, to: start.endOf("month") };
  }
  return { from: start, to: start.add(6, "day") };
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

  const range = useMemo(() => presetToRange(filters.preset), [filters.preset]);

  const kpis = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKpis });

  const upcoming = useQuery({
    queryKey: [
      "dashboard",
      "upcoming",
      range.from.format("YYYY-MM-DD"),
      range.to.format("YYYY-MM-DD"),
      filters.channel,
      filters.q,
    ],
    queryFn: async () => {
      let q = supabase
        .from("vw_upcoming_appointments")
        .select("*")
        .gte("scheduled_date", range.from.format("YYYY-MM-DD"))
        .lte("scheduled_date", range.to.format("YYYY-MM-DD"))
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
    queryKey: ["dashboard", "reminders", filters.q],
    queryFn: async () => {
      let q = supabase
        .from("vw_due_reminders")
        .select("*")
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Syringe className="h-3.5 w-3.5 text-primary" />
            VetVAX • agenda e lembretes
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-[80ch]">
            Agendamentos pendentes ficam visíveis até a baixa. Lembretes nascem na baixa e ficam no radar até feito/arquivado.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-[340px]">
            <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 rounded-md border-border bg-card focus-visible:ring-primary/25"
              placeholder="Buscar tutor / telefone…"
              value={filters.q}
              onChange={(e) => persist({ ...filters, q: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filters.preset} onValueChange={(v) => persist({ ...filters, preset: v as DatePreset })}>
              <SelectTrigger className="w-[170px] rounded-md bg-card">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="tomorrow">Amanhã</SelectItem>
                <SelectItem value="7d">Próximos 7 dias</SelectItem>
                <SelectItem value="month">Até o fim do mês</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.channel}
              onValueChange={(v) => persist({ ...filters, channel: v as Filters["channel"] })}
            >
              <SelectTrigger className="w-[160px] rounded-md bg-card">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={Clock} badge="Hoje" label="Pendentes hoje" value={kpis.data?.pending_today ?? "–"} tone="blue" />
        <KpiCard icon={CalendarClock} badge="7 dias" label="Pendentes (7d)" value={kpis.data?.pending_7d ?? "–"} tone="blue" />
        <KpiCard icon={Syringe} badge="Mês" label="Aplicados (mês)" value={kpis.data?.applied_month ?? "–"} tone="green" />
        <KpiCard icon={XCircle} badge="Mês" label="Cancelados (mês)" value={kpis.data?.cancelled_month ?? "–"} tone="amber" />
        <KpiCard icon={ShieldAlert} badge="Hoje" label="Lembretes vencidos" value={kpis.data?.overdue_reminders ?? "–"} tone="red" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold tracking-tight">Próximos agendamentos</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {range.from.format("DD/MM")} → {range.to.format("DD/MM")}
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full bg-blue-600/10 text-blue-700">
              PENDENTE
            </Badge>
          </div>

          <div className="mt-5">
            <UpcomingAppointmentsTable loading={upcoming.isLoading} rows={upcoming.data ?? []} onChanged={onRefetch} />
          </div>
        </Card>

        <Card className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold tracking-tight">Lembretes de próximas aplicações</div>
              <div className="mt-1 text-xs text-muted-foreground">Ativos (até 200 mais próximos)</div>
            </div>
            <Badge variant="secondary" className="rounded-full bg-blue-600/10 text-blue-700">
              ATIVO
            </Badge>
          </div>

          <div className="mt-5">
            <DueRemindersTable loading={reminders.isLoading} rows={reminders.data ?? []} onChanged={onRefetch} />
          </div>
        </Card>
      </div>
    </div>
  );
}