import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Filter, RefreshCw, Search } from "lucide-react";
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

type StatusFilter = "all" | "ATIVO" | "FEITO" | "ARQUIVADO";

type Filters = {
  q: string;
  due: DuePreset;
  status: StatusFilter;
  reminderType: "all" | "vacina" | "medicação" | "outro";
  pet: "all" | "with_pet" | "without_pet";
  branchId: string;
};

const LS_KEY = "vetvax.reminders.filters";

function defaults(): Filters {
  return {
    q: "",
    due: "30d",
    status: "ATIVO",
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
      // IMPORTANT: the view vw_due_reminders is fixed to ATIVO only, so it can't power the full list.
      // Here we query from reminders + tutors/pets to support: ativos, vencidos, arquivados, resolvidos.
      let q = supabase
        .from("reminders")
        .select(
          "id, org_id, branch_id, tutor_id, pet_id, due_date, reference_appointment_id, last_applied_at, reminder_type, message_template_id, status, last_sent_at, send_count, notes, created_at, is_active, tutor:tutors(name, phone1, phone2), pet:pets(name)",
        )
        .eq("is_active", true)
        .order("due_date", { ascending: true })
        .limit(800);

      if (filters.status !== "all") q = q.eq("status", filters.status);

      const range = dueRange(filters.due);
      if (range.from) q = q.gte("due_date", range.from);
      if (range.to) q = q.lte("due_date", range.to);

      if (filters.reminderType !== "all") q = q.eq("reminder_type", filters.reminderType);

      if (filters.pet === "with_pet") q = q.not("pet_id", "is", null);
      if (filters.pet === "without_pet") q = q.is("pet_id", null);

      if (filters.branchId !== "all") q = q.eq("branch_id", filters.branchId);

      const term = filters.q.trim();
      if (term) {
        // OR over joined columns is limited in postgrest; use ilike on notes and rely on client-side match for tutor/pet.
        q = q.ilike("notes", `%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data ?? []).map((r: any) => ({
        id: r.id,
        org_id: r.org_id,
        branch_id: r.branch_id,
        tutor_id: r.tutor_id,
        pet_id: r.pet_id,
        due_date: r.due_date,
        reference_appointment_id: r.reference_appointment_id,
        last_applied_at: r.last_applied_at,
        reminder_type: r.reminder_type,
        message_template_id: r.message_template_id,
        status: r.status,
        last_sent_at: r.last_sent_at,
        send_count: r.send_count ?? 0,
        notes: r.notes,
        tutor_name: r.tutor?.name ?? "",
        tutor_phone1: r.tutor?.phone1 ?? null,
        tutor_phone2: r.tutor?.phone2 ?? null,
        pet_name: r.pet?.name ?? null,
      })) as DueReminderRow[];

      if (!term) return mapped;

      const t = term.toLowerCase();
      return mapped.filter((row) => {
        const hay = [row.tutor_name, row.pet_name, row.tutor_phone1, row.tutor_phone2, row.notes, row.reminder_type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(t);
      });
    },
  });

  const refetchAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["reminders", "list"] }),
      qc.invalidateQueries({ queryKey: ["branches", "active"] }),
    ]);
  };

  const count = useMemo(() => rows.data?.length ?? 0, [rows.data]);

  const countLabel =
    filters.status === "all"
      ? `${count} no total`
      : filters.status === "ATIVO"
        ? `${count} ativos`
        : filters.status === "FEITO"
          ? `${count} resolvidos`
          : `${count} arquivados`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            Lembretes
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Próximas aplicações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe vencidos, ativos, resolvidos e arquivados.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-[10px] border-[1.5px] pl-9"
              placeholder="Buscar tutor / telefone / pet…"
              value={filters.q}
              onChange={(e) => persist({ ...filters, q: e.target.value })}
            />
          </div>

          <Button variant="secondary" className="h-10 rounded-[10px]" onClick={refetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {countLabel}
            </Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            <Select value={filters.status} onValueChange={(v) => persist({ ...filters, status: v as StatusFilter })}>
              <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativos</SelectItem>
                <SelectItem value="FEITO">Resolvidos</SelectItem>
                <SelectItem value="ARQUIVADO">Arquivados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.due} onValueChange={(v) => persist({ ...filters, due: v as DuePreset })}>
              <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[210px]">
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
                <SelectItem value="overdue">Somente vencidos</SelectItem>
                <SelectItem value="7d">Próximos 7 dias</SelectItem>
                <SelectItem value="30d">Próximos 30 dias</SelectItem>
                <SelectItem value="60d">Próximos 60 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.reminderType} onValueChange={(v) => persist({ ...filters, reminderType: v as Filters["reminderType"] })}>
              <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[190px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="vacina">Vacina</SelectItem>
                <SelectItem value="medicação">Medicação</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.pet} onValueChange={(v) => persist({ ...filters, pet: v as Filters["pet"] })}>
              <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[190px]">
                <SelectValue placeholder="Pet" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
                <SelectItem value="all">Tutor ou pet</SelectItem>
                <SelectItem value="with_pet">Somente com pet</SelectItem>
                <SelectItem value="without_pet">Somente tutor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.branchId} onValueChange={(v) => persist({ ...filters, branchId: v as Filters["branchId"] })}>
              <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[210px]">
                <SelectValue placeholder="Filial" />
              </SelectTrigger>
              <SelectContent className="rounded-[10px]">
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