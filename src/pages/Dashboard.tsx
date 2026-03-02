import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock, Filter, MessageCircle, Sparkles } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Dashboard • agenda e lembretes
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Hoje, o que precisa acontecer?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agendamentos pendentes aparecem aqui até a baixa. Lembretes nascem na baixa e ficam visíveis até feito/arquivado.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 rounded-2xl"
              placeholder="Buscar tutor / telefone…"
              value={filters.q}
              onChange={(e) => persist({ ...filters, q: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={filters.preset}
              onValueChange={(v) => persist({ ...filters, preset: v as DatePreset })}
            >
              <SelectTrigger className="w-[160px] rounded-2xl">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
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
              <SelectTrigger className="w-[150px] rounded-2xl">
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="store">Loja</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="secondary" className="rounded-2xl" onClick={onRefetch}>
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Pendentes hoje</div>
            <Badge className="rounded-full" variant="secondary">
              <Clock className="mr-1 h-3 w-3" />
              Hoje
            </Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold">{kpis.data?.pending_today ?? "–"}</div>
        </Card>
        <Card className="rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Pendentes (7d)</div>
            <Badge className="rounded-full" variant="secondary">
              <CalendarClock className="mr-1 h-3 w-3" />
              7 dias
            </Badge>
          </div>
          <div className="mt-2 text-2xl font-semibold">{kpis.data?.pending_7d ?? "–"}</div>
        </Card>
        <Card className="rounded-3xl p-4">
          <div className="text-xs text-muted-foreground">Aplicados (mês)</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.data?.applied_month ?? "–"}</div>
        </Card>
        <Card className="rounded-3xl p-4">
          <div className="text-xs text-muted-foreground">Cancelados (mês)</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.data?.cancelled_month ?? "–"}</div>
        </Card>
        <Card className="rounded-3xl p-4">
          <div className="text-xs text-muted-foreground">Lembretes vencidos</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.data?.overdue_reminders ?? "–"}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Próximos agendamentos</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {range.from.format("DD/MM")} → {range.to.format("DD/MM")}
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full">
              PENDENTE
            </Badge>
          </div>

          <div className="mt-4">
            <UpcomingAppointmentsTable
              loading={upcoming.isLoading}
              rows={upcoming.data ?? []}
              onChanged={onRefetch}
            />
          </div>
        </Card>

        <Card className="rounded-3xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Lembretes de próximas aplicações</div>
              <div className="mt-1 text-xs text-muted-foreground">Ativos (até 200 mais próximos)</div>
            </div>
            <Badge variant="secondary" className="rounded-full">
              ATIVO
            </Badge>
          </div>

          <div className="mt-4">
            <DueRemindersTable loading={reminders.isLoading} rows={reminders.data ?? []} onChanged={onRefetch} />
          </div>
        </Card>
      </div>
    </div>
  );
}
