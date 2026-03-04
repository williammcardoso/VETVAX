import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Filter, Syringe, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import VaccinationsReportTable, { type VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";
import ReopenCheckoutDialog from "@/components/reports/ReopenCheckoutDialog";

type Status = "all" | "APLICADO" | "CANCELADO";

type FiltersState = {
  from: string;
  to: string;
  status: Status;
  tutor: string;
  vaccineQuery: string;
};

function buildVaccinesLabel(appliedItemsSnapshot: any) {
  const items = Array.isArray(appliedItemsSnapshot) ? appliedItemsSnapshot : [];
  const vaccines = items
    .filter((it) => (it?.category ?? "") === "vaccine")
    .map((it) => String(it?.catalog_name ?? it?.name ?? "").trim())
    .filter(Boolean);

  // de-dup preserving order
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const v of vaccines) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(v);
  }

  return uniq.join(" • ");
}

async function fetchReport(filters: FiltersState) {
  // We use appointment_checkouts as the source of truth for "vaccinations".
  // No schema changes; only reads + a controlled reopen action.
  let q = supabase
    .from("appointment_checkouts")
    .select(
      "id, appointment_id, status_result, checkout_date, applied_items_snapshot, appointment:appointments(id, scheduled_date, scheduled_time, tutor_id, tutor:tutors(id, name, phone1, phone2))",
    )
    .gte("checkout_date", filters.from)
    .lte("checkout_date", filters.to)
    .order("checkout_date", { ascending: false })
    .limit(500);

  if (filters.status !== "all") q = q.eq("status_result", filters.status);

  const { data, error } = await q;
  if (error) throw error;

  const mapped: VaccinationReportRow[] = (data ?? []).map((r: any) => {
    const appt = r.appointment;
    const tutor = appt?.tutor;

    return {
      checkout_id: r.id,
      appointment_id: r.appointment_id,
      checkout_date: r.checkout_date,
      scheduled_date: appt?.scheduled_date ?? r.checkout_date,
      scheduled_time: appt?.scheduled_time ?? "00:00:00",
      tutor_id: appt?.tutor_id ?? "",
      tutor_name: tutor?.name ?? "—",
      tutor_phone1: tutor?.phone1 ?? null,
      tutor_phone2: tutor?.phone2 ?? null,
      status: r.status_result,
      vaccines: buildVaccinesLabel(r.applied_items_snapshot),
    };
  });

  const tutorTerm = filters.tutor.trim().toLowerCase();
  const vaccineTerm = filters.vaccineQuery.trim().toLowerCase();

  return mapped.filter((row) => {
    if (tutorTerm) {
      const hay = [row.tutor_name, row.tutor_phone1, row.tutor_phone2].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(tutorTerm)) return false;
    }
    if (vaccineTerm) {
      if (!row.vaccines.toLowerCase().includes(vaccineTerm)) return false;
    }
    return true;
  });
}

export default function Reports() {
  const qc = useQueryClient();

  const [filters, setFilters] = useState<FiltersState>(() => ({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
    status: "APLICADO",
    tutor: "",
    vaccineQuery: "",
  }));

  const rows = useQuery({
    queryKey: ["reports", "vaccinations", filters],
    queryFn: () => fetchReport(filters),
  });

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenRow, setReopenRow] = useState<VaccinationReportRow | null>(null);

  const count = rows.data?.length ?? 0;

  const title = useMemo(() => {
    const s = filters.status === "all" ? "todos" : filters.status.toLowerCase();
    return `Relatório de vacinações (${s})`;
  }, [filters.status]);

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <FileDown className="h-3.5 w-3.5" />
          Relatórios
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Baseado nas baixas (checkouts). Use filtros, exporte CSV e reabra registros quando necessário.
        </p>
      </div>

      <Card className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {count} registros
            </Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <div className="grid gap-2">
              <Label>Período</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  className="h-10 rounded-[10px] border-[1.5px]"
                  value={filters.from}
                  onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                />
                <Input
                  type="date"
                  className="h-10 rounded-[10px] border-[1.5px]"
                  value={filters.to}
                  onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v as Status }))}>
                <SelectTrigger className="h-10 rounded-[10px] border-[1.5px] w-full sm:w-[200px]">
                  <Filter className="mr-2 h-4 w-4 opacity-70" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-[10px]">
                  <SelectItem value="APLICADO">Aplicado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tutor</Label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-[10px] border-[1.5px] pl-9 w-full sm:w-[240px]"
                  placeholder="Nome ou telefone…"
                  value={filters.tutor}
                  onChange={(e) => setFilters((p) => ({ ...p, tutor: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo vacina</Label>
              <div className="relative">
                <Syringe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-[10px] border-[1.5px] pl-9 w-full sm:w-[240px]"
                  placeholder="Ex: V8, antirrábica…"
                  value={filters.vaccineQuery}
                  onChange={(e) => setFilters((p) => ({ ...p, vaccineQuery: e.target.value }))}
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className="h-10 rounded-[10px]"
              onClick={async () => {
                await qc.invalidateQueries({ queryKey: ["reports", "vaccinations"] });
                toast({ title: "Atualizado" });
              }}
            >
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <VaccinationsReportTable
            loading={rows.isLoading}
            rows={rows.data ?? []}
            onExport={() => toast({ title: "CSV exportado" })}
            onReopen={(r) => {
              setReopenRow(r);
              setReopenOpen(true);
            }}
          />
        </div>
      </Card>

      <ReopenCheckoutDialog
        open={reopenOpen}
        row={reopenRow}
        onOpenChange={(v) => {
          setReopenOpen(v);
          if (!v) setReopenRow(null);
        }}
        onChanged={async () => {
          await qc.invalidateQueries({ queryKey: ["reports", "vaccinations"] });
        }}
      />
    </div>
  );
}
