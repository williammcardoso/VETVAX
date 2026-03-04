import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Filter, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateBr } from "@/lib/datetime";
import { supabase } from "@/lib/supabase";

type DayFilter = "all" | "saturday";

type Item = {
  scheduled_date: string;
  scheduled_time: string;
  tutor_name: string;
  pet_name: string | null;
  vaccine: string;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Agenda pública
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Próximos agendamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visualização somente-leitura (sem login).</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={filter} onValueChange={(v) => setFilter(v as DayFilter)}>
            <SelectTrigger className="h-10 w-full rounded-[10px] border-[1.5px] sm:w-[220px]">
              <Filter className="mr-2 h-4 w-4 opacity-70" />
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent className="rounded-[10px]">
              <SelectItem value="all">Todos os dias</SelectItem>
              <SelectItem value="saturday">Apenas sábados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" className="h-10 rounded-[10px]" onClick={() => items.refetch()} disabled={!token}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {!token ? (
          <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
            <div className="text-sm font-semibold">Token necessário</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Abra esta página com <span className="font-medium">?token=SEU_TOKEN</span>.
            </p>
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
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : items.isError ? (
          <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted">
                <TriangleAlert className="h-4 w-4" />
              </span>
              Não foi possível carregar
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{(items.error as any)?.message ?? "Tente novamente."}</p>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
            <div className="text-sm font-semibold">Nenhum agendamento futuro</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Verifique se existem agendamentos <span className="font-medium">PENDENTE</span> a partir de hoje.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map((g) => (
              <Card
                key={g.date}
                className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-tight">{g.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{g.items.length} horários</div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {g.items.length}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2">
                  {g.items.map((it, idx) => (
                    <div key={idx} className="rounded-[10px] border-[1.5px] border-border bg-background px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-primary">{it.scheduled_time}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{it.tutor_name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {it.pet_name ? `${it.pet_name} • ` : ""}{it.vaccine}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}