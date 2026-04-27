import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, CheckCircle2, Clock, Filter, Layers3, MapPin, PawPrint, Stethoscope, TriangleAlert, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dayjs, formatDateBr } from "@/lib/datetime";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type DayFilter = "all" | "saturday";
type StatusFilter = "all" | "PENDENTE" | "APLICADO" | "CANCELADO";

type Item = {
  appointment_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "PENDENTE" | "APLICADO" | "CANCELADO";
  tutor_name: string;
  tutor_address: string | null;
  pet_name: string | null;
  category: string;
  item_name: string;
  quantity: number;
};

type Group = {
  date: string;
  label: string;
  items: Item[];
};

function weekdayLabel(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

function groupByDate(items: Item[]): Group[] {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    if (!map.has(it.scheduled_date)) map.set(it.scheduled_date, []);
    map.get(it.scheduled_date)!.push(it);
  }

  const dates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  return dates.map((date) => ({
    date,
    label: `${weekdayLabel(date)} — ${formatDateBr(date)}`,
    items: (map.get(date) ?? []).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)),
  }));
}

function statusUi(status: Item["status"]) {
  if (status === "PENDENTE") {
    return {
      label: "Pendente",
      icon: Clock,
      badge: "border-blue-200 bg-blue-100 text-blue-800",
      rail: "from-blue-500 to-cyan-500",
      card: "border-slate-200 bg-white",
      time: "bg-blue-600 text-white",
    };
  }
  if (status === "APLICADO") {
    return {
      label: "Aplicado",
      icon: CheckCircle2,
      badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
      rail: "from-emerald-500 to-teal-500",
      card: "border-slate-200 bg-white",
      time: "bg-emerald-600 text-white",
    };
  }
  return {
    label: "Cancelado",
    icon: XCircle,
    badge: "border-rose-200 bg-rose-100 text-rose-800",
    rail: "from-rose-500 to-red-500",
    card: "border-slate-200 bg-white",
    time: "bg-rose-600 text-white",
  };
}

function categoryLabel(category: string) {
  if (category === "vaccine") return { label: "Vacina", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" };
  if (category === "medication") return { label: "Medicação", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (category === "other") return { label: "Outro", cls: "bg-slate-50 text-slate-800 border-slate-200" };
  return { label: category || "—", cls: "bg-slate-50 text-slate-800 border-slate-200" };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

async function fetchPublicAgenda({
  filter,
  status,
  from,
  to,
}: {
  filter: DayFilter;
  status: StatusFilter;
  from: string;
  to: string;
}) {
  const { data, error } = await supabase.functions.invoke("public-agenda", {
    body: {
      filter,
      status,
      from: from || undefined,
      to: to || undefined,
    },
  });

  if (error) {
    throw new Error(error.message || "Não foi possível carregar a agenda pública.");
  }

  const json = data as { ok?: boolean; items?: Item[]; error?: string };
  if (!json?.ok) {
    throw new Error(json?.error || "Falha ao carregar a agenda pública.");
  }

  return (json.items ?? []) as Item[];
}

export default function AgendaPublica() {
  const [filter, setFilter] = useState<DayFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("PENDENTE");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const items = useQuery({
    queryKey: ["public-agenda", filter, status, from, to],
    queryFn: () => fetchPublicAgenda({ filter, status, from, to }),
  });

  const groups = useMemo(() => groupByDate(items.data ?? []), [items.data]);
  const rows = useMemo(() => items.data ?? [], [items.data]);
  const today = dayjs().format("YYYY-MM-DD");
  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((it) => it.status === "PENDENTE").length,
      applied: rows.filter((it) => it.status === "APLICADO").length,
      overdue: rows.filter((it) => it.status === "PENDENTE" && it.scheduled_date < today).length,
    }),
    [rows, today],
  );

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "PENDENTE", label: "Pendentes" },
    { value: "APLICADO", label: "Aplicados" },
    { value: "CANCELADO", label: "Cancelados" },
    { value: "all", label: "Todos" },
  ];

  const headerMetrics = [
    {
      key: "pending",
      label: "Pendentes",
      value: stats.pending,
      icon: Clock,
      accent: "text-sky-700",
      bar: "bg-sky-500",
    },
    {
      key: "overdue",
      label: "Atrasados",
      value: stats.overdue,
      icon: Activity,
      accent: "text-rose-700",
      bar: "bg-rose-500",
    },
    {
      key: "applied",
      label: "Aplicados",
      value: stats.applied,
      icon: CheckCircle2,
      accent: "text-emerald-700",
      bar: "bg-emerald-500",
    },
    {
      key: "total",
      label: "Total",
      value: stats.total,
      icon: Layers3,
      accent: "text-slate-700",
      bar: "bg-slate-400",
    },
  ] as const;

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-vetvax-bg via-vetvax-surface-alt/40 to-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:max-w-6xl lg:px-8 lg:py-7">
        {/* Hero compacto: não domina a viewport — produto premium editorial */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.07)]">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-teal-50/80 to-transparent" />
          <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4 lg:pl-5 lg:pr-5">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0f766e] text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(15,118,110,0.25)] sm:h-11 sm:w-11">
                V
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">
                  <CalendarDays className="h-3 w-3" />
                  Agenda pública
                </div>
                <h1 className="mt-2 text-lg font-extrabold leading-snug tracking-[-0.02em] text-slate-900 sm:text-xl lg:text-[22px]">
                  Linha do tempo de vacinação
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                  Resumo dos registros visíveis com os filtros atuais. Role para ver os atendimentos por data.
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:min-w-0 lg:max-w-[min(100%,420px)] lg:flex-1 lg:grid-cols-4">
              {headerMetrics.map((metric) => {
                const MetricIcon = metric.icon;
                return (
                  <div
                    key={metric.key}
                    className="flex min-w-0 flex-col rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 sm:px-3 sm:py-2.5"
                  >
                    <div className={`h-0.5 w-6 rounded-full ${metric.bar}`} />
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{metric.label}</span>
                      <MetricIcon className={cn("h-3.5 w-3.5 shrink-0 opacity-80", metric.accent)} />
                    </div>
                    <p className={cn("mt-0.5 text-lg font-black tabular-nums leading-none sm:text-xl", metric.accent)}>{metric.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={status === option.value ? "default" : "outline"}
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "h-11 rounded-xl px-4 text-sm font-semibold transition-all",
                    status === option.value
                      ? "border-slate-900 bg-slate-900 !text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] hover:bg-slate-800"
                      : "border-slate-300 bg-white !text-slate-800 hover:border-slate-400 hover:bg-slate-50",
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              <Input
                type="date"
                className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 lg:w-[150px]"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Data inicial"
              />
              <Input
                type="date"
                className="h-10 rounded-xl border-slate-300 bg-white text-slate-900 lg:w-[150px]"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Data final"
              />
              <Select value={filter} onValueChange={(v) => setFilter(v as DayFilter)}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white text-slate-900 lg:w-[180px]">
                  <Filter className="mr-2 h-4 w-4 opacity-70" />
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos os dias</SelectItem>
                  <SelectItem value="saturday">Apenas sábados</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => items.refetch()}
                disabled={items.isFetching}
              >
                Atualizar
              </Button>
              {(from || to) && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Limpar datas
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="mt-5">
          {items.isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-[24px] border border-slate-200 bg-white/80 shadow-[0_12px_36px_rgba(15,23,42,0.06)]" />
              ))}
            </div>
          ) : items.isError ? (
            <Card className="rounded-[24px] border-[1.5px] border-border bg-card p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-secondary">
                  <TriangleAlert className="h-5 w-5 text-slate-700" />
                </span>
                Não foi possível carregar
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{getErrorMessage(items.error)}</p>
            </Card>
          ) : groups.length === 0 ? (
            <Card className="rounded-[24px] border-[1.5px] border-border bg-card p-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-blue-50 text-blue-700">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold">Nenhum agendamento encontrado</div>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste o período ou crie novos agendamentos para aparecerem aqui.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {groups.map((g) => (
                <Card key={g.date} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                    <div>
                      <div className="text-base font-semibold tracking-tight text-slate-950">{g.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{g.items.length} registro(s)</div>
                    </div>
                    <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{g.items.length}</Badge>
                  </div>

                  <div className="grid gap-3 p-3 sm:p-4">
                    {g.items.map((it) => {
                      const s = statusUi(it.status);
                      const c = categoryLabel(it.category);
                      const StatusIcon = s.icon;
                      return (
                        <div
                          key={`${it.appointment_id}:${it.item_name}:${it.pet_name ?? "-"}`}
                          className={cn(
                            "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)]",
                            s.card,
                          )}
                        >
                          <div className={cn("absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b", s.rail)} />

                          <div className="flex gap-4">
                            <div className="shrink-0">
                              <div className={cn("grid h-14 w-14 place-items-center rounded-2xl text-base font-bold shadow-lg", s.time)}>
                                {it.scheduled_time}
                              </div>
                              <div className="mt-2 flex justify-center">
                                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", s.badge)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {s.label}
                                </span>
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-base font-bold text-slate-950">{it.tutor_name}</div>
                                {it.pet_name ? (
                                  <Badge className="rounded-full border border-blue-100 bg-white text-blue-700">
                                    <PawPrint className="mr-1 h-3 w-3" />
                                    {it.pet_name}
                                  </Badge>
                                ) : null}
                              </div>
                              {it.tutor_address ? (
                                <div className="mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500">
                                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                                  <span className="line-clamp-2">{it.tutor_address}</span>
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge className={cn("rounded-full border bg-white text-[11px] font-medium", c.cls)}>
                                  <Stethoscope className="mr-1 h-3 w-3" />
                                  {c.label}
                                </Badge>
                                <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700">
                                  {it.quantity}× {it.item_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
