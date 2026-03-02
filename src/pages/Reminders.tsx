import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Filter, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Branch, DueReminderRow } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RemindersTable from "@/components/reminders/RemindersTable";
import { dayjs } from "@/lib/datetime";

type DuePreset = "overdue" | "7d" | "30d" | "60d" | "all";

type Filters = {
  q: string;
  due: DuePreset;
  reminderType: "all" | "vacina" | "medicação" | "outro";
  pet: "all" | "with_pet" | "without_pet";
  branchId: string;
};

const LS_KEY = "vetvax.reminders.filters";

function defaults(): Filters {
  return {
    q: "",
    due: "30d",
    reminderType: "all",
    pet: "all",
    branchId: "all",
  };
}

function dueRange(due: DuePreset) {
  const today = dayjs().startOf("day");
  if (due === "overdue") return { from: null as string | null, to: today.subtract(1, "day").format("YYYY-MM-DD") };
  if (due === "7d") return { from: today.format("YYYY-MM-DD"), to: today.add(7, "day").format("YYYY-MM-DD") };
  if (due === "30d") return { from: today.format("YYYY-MM-DD"), to: today.add(30, "day").format("YYYY-MM-DD") };
  if (due === "60d") return { from: today.format("YYYY-MM-DD"), to: today.add(60, "day").format("YYYY-MM-DD") };
  return { from: null, to: null };
}

export default function Reminders() {
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaults();
      return { ...defaults(), ...(JSON.parse(raw) as Partial<Filters>) };
    } catch {
      return defaults();
    }
  });

  const persist = (next: Filters) => {
    setFilters(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const branches = useQuery({
    queryKey: ["branches", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, org_id, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const rows = useQuery({
    queryKey: ["reminders", "list", filters],
    queryFn: async () => {
      let q = supabase.from("vw_due_reminders").select("*").order("due_date", { ascending: true }).limit(500);

      // status is already filtered in the view (ATIVO + is_active). Keep defensive.
      q = q.eq("status", "ATIVO");

      const range = dueRange(filters.due);
      if (range.from) q = q.gte("due_date", range.from);
      if (range.to) q = q.lte("due_date", range.to);

      if (filters.reminderType !== "all") q = q.eq("reminder_type", filters.reminderType);

      if (filters.pet === "with_pet") q = q.not("pet_id", "is", null);
      if (filters.pet === "without_pet") q = q.is("pet_id", null);

      if (filters.branchId !== "all") q = q.eq("branch_id", filters.branchId);

      const term = filters.q.trim();
      if (term) {
        q = q.or(
          `tutor_name.ilike.%${term}%,tutor_phone1.ilike.%${term}%,tutor_phone2.ilike.%${term}%,pet_name.ilike.%${term}%`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DueReminderRow[];
    },
  });

  const refetchAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["reminders", "list"] }),
      qc.invalidateQueries({ queryKey: ["branches", "active"] }),
    ]);
  };

  const count = useMemo(() => rows.data?.length ?? 0, [rows.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            Lembretes
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Próximas aplicações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filtros avançados, ações em lote e export. Envio tem anti-spam (24h por lembrete).
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-[320px]">
            <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 rounded-2xl"
              placeholder="Buscar tutor / telefone / pet…"
              value={filters.q}
              onChange={(e) => persist({ ...filters, q: e.target.value })}
            />
          </div>

          <Button variant="secondary" className="rounded-2xl" onClick={refetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {count} ativos
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              TZ: America/Sao_Paulo
            </Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            <Select value={filters.due} onValueChange={(v) => persist({ ...filters, due: v as DuePreset })}>
              <SelectTrigger className="rounded-2xl w-full sm:w-[210px]">
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="overdue">Somente vencidos</SelectItem>
                <SelectItem value="7d">Próximos 7 dias</SelectItem>
                <SelectItem value="30d">Próximos 30 dias</SelectItem>
                <SelectItem value="60d">Próximos 60 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.reminderType}
              onValueChange={(v) => persist({ ...filters, reminderType: v as Filters["reminderType"] })}
            >
              <SelectTrigger className="rounded-2xl w-full sm:w-[190px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="vacina">Vacina</SelectItem>
                <SelectItem value="medicação">Medicação</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.pet} onValueChange={(v) => persist({ ...filters, pet: v as Filters["pet"] })}>
              <SelectTrigger className="rounded-2xl w-full sm:w-[190px]">
                <SelectValue placeholder="Pet" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Tutor ou pet</SelectItem>
                <SelectItem value="with_pet">Somente com pet</SelectItem>
                <SelectItem value="without_pet">Somente tutor</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.branchId}
              onValueChange={(v) => persist({ ...filters, branchId: v as Filters["branchId"] })}
            >
              <SelectTrigger className="rounded-2xl w-full sm:w-[210px]">
                <SelectValue placeholder="Filial" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Todas</SelectItem>
                {(branches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <RemindersTable loading={rows.isLoading} rows={rows.data ?? []} onChanged={refetchAll} />
        </div>
      </Card>
    </div>
  );
}
