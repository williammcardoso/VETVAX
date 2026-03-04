import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Filter, Stethoscope, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateBr } from "@/lib/datetime";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type DayFilter = "all" | "saturday";

type Item = {
  appointment_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "PENDENTE" | "APLICADO" | "CANCELADO";
  tutor_name: string;
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
  const wd = d.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  return wd;
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
      badge: "bg-blue-600 text-white border-blue-600",
      rail: "bg-blue-600",
    };
  }
  if (status === "APLICADO") {
    return {
      label: "Aplicado",
      badge: "bg-emerald-600 text-white border-emerald-600",
      rail: "bg-emerald-600",
    };
  }
  return {
    label: "Cancelado",
    badge: "bg-rose-600 text-white border-rose-600",
    rail: "bg-rose-600",
  };
}

function categoryLabel(category: string) {
  if (category === "vaccine") return { label: "Vacina", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" };
  if (category === "medication") return { label: "Medicação", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (category === "other") return { label: "Outro", cls: "bg-slate-50 text-slate-800 border-slate-200" };
  return { label: category || "—", cls: "bg-slate-50 text-slate-800 border-slate-200" };
}

async function fetchPublicAgenda({ token, filter }: { token: string; filter: DayFilter }) {
  const { data, error } = await supabase.functions.invoke("public-agenda", {
    body: { token, filter },
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
  const [token, setToken] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get("token") ?? "";
    } catch {
      return "";
    }
  });

  const [filter, setFilter] = useState<DayFilter>("all");

  const items = useQuery({
    queryKey: ["public-agenda", token, filter],
    enabled: !!token,
    queryFn: () => fetchPublicAgenda({ token, filter }),
  });

  const groups = useMemo(() => groupByDate(items.data ?? []), [items.data]);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="overflow-hidden rounded-[16px] border-[1.5px] border-border bg-card shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-slate-700">
              <CalendarDays className="h-3.5 w-3.5" />
              Agenda pública
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Próximos agendamentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Lista completa dos horários a partir de hoje (somente leitura).</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={filter} onValueChange={(v) => setFilter(v as DayFilter)}>
              <SelectTrigger className="h-10 w-full rounded-[10px] border-[1.5px] bg-background sm:w-[240px]">
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
                <SelectItem value="all">Todos os dias</SelectItem>
                <SelectItem value="saturday">Apenas sábados</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-10 rounded-[10px]" onClick={() => items.refetch()} disabled={!token}>
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {!token ? (
          <Card className="rounded-[16px] border-[1.5px] border-border bg-card p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-secondary">
                <Stethoscope className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <div className="text-sm font-semibold">Token necessário</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abra esta página com <span className="font-medium">?token=SEU_TOKEN</span>.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="h-10 w-full rounded-[10px] border-[1.5px] border-border bg-background px-3 text-sm"
                placeholder="Cole o token aqui…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button className="h-10 rounded-[10px]" onClick={() => items.refetch()}>
                Carregar
              </Button>
            </div>
          </Card>
        ) : items.isLoading ? (
          <div className="rounded-[16px] border-[1.5px] border-border bg-card p-5 text-sm text-muted-foreground shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            Carregando…
          </div>
        ) : items.isError ? (
          <Card className="rounded-[16px] border-[1.5px] border-border bg-card p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-secondary">
                <TriangleAlert className="h-5 w-5 text-slate-700" />
              </span>
              Não foi possível carregar
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{(items.error as any)?.message ?? "Tente novamente."}</p>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="rounded-[16px] border-[1.5px] border-border bg-card p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="text-sm font-semibold">Nenhum agendamento a partir de hoje</div>
            <p className="mt-1 text-sm text-muted-foreground">Crie agendamentos futuros para aparecerem aqui.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map((g) => (
              <Card
                key={g.date}
                className="overflow-hidden rounded-[16px] border-[1.5px] border-border bg-card shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-3 sm:px-5">
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-foreground">{g.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{g.items.length} itens</div>
                  </div>
                  <Badge className="rounded-full border border-border bg-background text-foreground">{g.items.length}</Badge>
                </div>

                <div className="divide-y divide-border">
                  {g.items.map((it) => {
                    const s = statusUi(it.status);
                    const c = categoryLabel(it.category);
                    return (
                      <div key={`${it.appointment_id}:${it.item_name}:${it.pet_name ?? "-"}`} className="relative flex gap-3 px-4 py-3 sm:px-5">
                        <div className={cn("absolute left-0 top-0 h-full w-1", s.rail)} />

                        <div className="w-[84px] shrink-0">
                          <div className="text-[13px] font-semibold text-primary">{it.scheduled_time}</div>
                          <div className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: "transparent" }}>
                            <span className={cn("rounded-full border px-2 py-0.5", s.badge)}>{s.label}</span>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">{it.tutor_name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge className={cn("rounded-full border bg-background text-[11px] font-medium", c.cls)}>{c.label}</Badge>
                            <div className="min-w-0 truncate text-xs text-muted-foreground">
                              {it.pet_name ? <span className="font-medium text-slate-700">{it.pet_name}</span> : null}
                              {it.pet_name ? <span className="mx-1">•</span> : null}
                              <span>
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
  );
}