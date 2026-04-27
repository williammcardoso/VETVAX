import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import VaccinationsReportTable, { type VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";
import ReopenCheckoutDialog from "@/components/reports/ReopenCheckoutDialog";
import PageHeader from "@/components/layout/PageHeader";
import DataToolbar from "@/components/vetvax/DataToolbar";
import StatusBadge from "@/components/vetvax/StatusBadge";

type Status = "all" | "PENDENTE" | "APLICADO" | "CANCELADO";

type FiltersState = {
  from: string;
  to: string;
  status: Status;
  tutor: string;
  vaccineQuery: string;
};

type SnapshotItem = {
  category?: string | null;
  catalog_name?: string | null;
  name?: string | null;
};

type AppointmentItem = {
  quantity?: number | null;
  item?: {
    name?: string | null;
    category?: string | null;
  } | null;
};

type AppointmentReportRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "PENDENTE" | "APLICADO" | "CANCELADO";
  tutor_id: string;
  tutor?: {
    id: string;
    name: string;
    phone1: string | null;
    phone2: string | null;
  } | null;
  items?: AppointmentItem[] | null;
};

type CheckoutReportRow = {
  id: string;
  appointment_id: string;
  status_result: "APLICADO" | "CANCELADO";
  checkout_date: string;
  applied_items_snapshot: unknown;
  created_by: string | null;
};

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const label of labels) {
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(label);
  }
  return uniq.join(" • ");
}

function buildVaccinesLabel(appliedItemsSnapshot: unknown) {
  const items = Array.isArray(appliedItemsSnapshot) ? (appliedItemsSnapshot as SnapshotItem[]) : [];
  const vaccines = items
    .filter((it) => (it?.category ?? "") === "vaccine")
    .map((it) => String(it?.catalog_name ?? it?.name ?? "").trim())
    .filter(Boolean);

  return uniqueLabels(vaccines);
}

function buildAppointmentItemsLabel(items: AppointmentItem[] | null | undefined) {
  const vaccines = (items ?? [])
    .filter((it) => (it.item?.category ?? "") === "vaccine")
    .map((it) => String(it.item?.name ?? "").trim())
    .filter(Boolean);
  return uniqueLabels(vaccines);
}

async function lookupProfileNames(ids: string[]) {
  const uniq = Array.from(new Set(ids)).filter(Boolean);
  if (uniq.length === 0) return {} as Record<string, string>;

  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) return {} as Record<string, string>;

  const res = await fetch("https://nocwkogecmwwpodoqaos.supabase.co/functions/v1/profile-lookup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ ids: uniq.slice(0, 50) }),
  });

  if (!res.ok) return {} as Record<string, string>;
  const json = (await res.json()) as { ok: boolean; map?: Record<string, string> };
  return json.map ?? ({} as Record<string, string>);
}

async function fetchReport(filters: FiltersState) {
  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, scheduled_date, scheduled_time, status, tutor_id, tutor:tutors(id, name, phone1, phone2), items:appointment_items(quantity, item:catalog_items(name, category))",
    )
    .gte("scheduled_date", filters.from)
    .lte("scheduled_date", filters.to)
    .order("scheduled_date", { ascending: false })
    .order("scheduled_time", { ascending: false })
    .limit(500);

  if (filters.status !== "all") appointmentsQuery = appointmentsQuery.eq("status", filters.status);

  const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;
  if (appointmentsError) throw appointmentsError;

  const appointments = (appointmentsData ?? []) as AppointmentReportRow[];
  const appointmentIds = appointments.map((a) => a.id);

  const checkoutsByAppointment = new Map<string, CheckoutReportRow>();
  if (appointmentIds.length > 0) {
    const { data: checkoutsData, error: checkoutsError } = await supabase
      .from("appointment_checkouts")
      .select("id, appointment_id, status_result, checkout_date, applied_items_snapshot, created_by")
      .in("appointment_id", appointmentIds);
    if (checkoutsError) throw checkoutsError;
    for (const checkout of (checkoutsData ?? []) as CheckoutReportRow[]) {
      checkoutsByAppointment.set(checkout.appointment_id, checkout);
    }
  }

  const mappedBase: VaccinationReportRow[] = appointments.map((appt) => {
    const checkout = checkoutsByAppointment.get(appt.id);
    return {
      checkout_id: checkout?.id ?? null,
      appointment_id: appt.id,
      checkout_date: checkout?.checkout_date ?? null,
      scheduled_date: appt.scheduled_date,
      scheduled_time: appt.scheduled_time ?? "00:00:00",
      tutor_id: appt.tutor_id ?? "",
      tutor_name: appt.tutor?.name ?? "—",
      tutor_phone1: appt.tutor?.phone1 ?? null,
      tutor_phone2: appt.tutor?.phone2 ?? null,
      status: checkout?.status_result ?? appt.status,
      vaccines: checkout ? buildVaccinesLabel(checkout.applied_items_snapshot) : buildAppointmentItemsLabel(appt.items),
      created_by: checkout?.created_by ?? null,
      responsible_name: null,
    };
  });

  const createdByIds = mappedBase.map((r) => r.created_by).filter(Boolean) as string[];
  const nameMap = await lookupProfileNames(createdByIds);

  const mapped = mappedBase.map((r) => ({
    ...r,
    responsible_name: r.created_by ? (nameMap[r.created_by] ?? null) : null,
  }));

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
    status: "all",
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
    const s =
      filters.status === "all"
        ? "todos"
        : filters.status === "PENDENTE"
          ? "pendentes"
          : filters.status === "APLICADO"
            ? "aplicados"
            : "cancelados";
    return `Relatório de agendamentos (${s})`;
  }, [filters.status]);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Analytics"
        title={title}
        description="Consulte agendamentos em aberto, aplicações registradas e cancelamentos."
      />

      <DataToolbar
        leading={<StatusBadge>{count} registros</StatusBadge>}
        filters={
          <>
            <div className="grid gap-1">
              <Label className="vetvax-label">Período inicial</Label>
              <Input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="vetvax-label">Período final</Label>
              <Input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="vetvax-label">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v as Status }))}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="APLICADO">Aplicado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="vetvax-label">Tutor</Label>
              <Input
                className="w-[220px]"
                placeholder="Nome ou telefone..."
                value={filters.tutor}
                onChange={(e) => setFilters((p) => ({ ...p, tutor: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="vetvax-label">Vacina</Label>
              <Input
                className="w-[220px]"
                placeholder="Ex: V8"
                value={filters.vaccineQuery}
                onChange={(e) => setFilters((p) => ({ ...p, vaccineQuery: e.target.value }))}
              />
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={async () => {
                await qc.invalidateQueries({ queryKey: ["reports", "vaccinations"] });
                toast({ title: "Atualizado" });
              }}
            >
              Atualizar
            </Button>
          </>
        }
      />

      <section className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <VaccinationsReportTable
          loading={rows.isLoading}
          rows={rows.data ?? []}
          onExport={() => toast({ title: "CSV exportado" })}
          onReopen={(r) => {
            setReopenRow(r);
            setReopenOpen(true);
          }}
        />
      </section>

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