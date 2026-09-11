import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import VaccinationsReportTable, { type VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";
import DeleteRecordDialog from "@/components/reports/DeleteRecordDialog";
import PageHeader from "@/components/layout/PageHeader";
import DataToolbar from "@/components/vetvax/DataToolbar";
import StatusBadge from "@/components/vetvax/StatusBadge";

type FiltersState = {
  from: string;
  to: string;
  tutor: string;
  vaccineQuery: string;
};

type RecordItem = {
  quantity: number | null;
  catalog_item: {
    name: string | null;
    category: string | null;
  } | null;
};

type RecordRow = {
  id: string;
  applied_date: string;
  next_due_date: string | null;
  tutor_id: string;
  tutor: {
    id: string;
    name: string;
    phone1: string | null;
    phone2: string | null;
  } | null;
  created_by: string | null;
  items: RecordItem[] | null;
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

function buildVaccinesLabel(items: RecordItem[] | null | undefined) {
  const vaccines = (items ?? [])
    .filter((it) => (it.catalog_item?.category ?? "") === "vaccine")
    .map((it) => String(it.catalog_item?.name ?? "").trim())
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
  const { data, error } = await supabase
    .from("vaccination_records")
    .select(
      "id, applied_date, next_due_date, tutor_id, tutor:tutors(id, name, phone1, phone2), created_by, items:vaccination_record_items(quantity, catalog_item:catalog_items(name, category))",
    )
    .eq("is_active", true)
    .gte("applied_date", filters.from)
    .lte("applied_date", filters.to)
    .order("applied_date", { ascending: false })
    .limit(500);
  if (error) throw error;

  const records = (data ?? []) as RecordRow[];

  const mappedBase: VaccinationReportRow[] = records.map((r) => ({
    record_id: r.id,
    applied_date: r.applied_date,
    next_due_date: r.next_due_date,
    tutor_id: r.tutor_id ?? "",
    tutor_name: r.tutor?.name ?? "—",
    tutor_phone1: r.tutor?.phone1 ?? null,
    tutor_phone2: r.tutor?.phone2 ?? null,
    vaccines: buildVaccinesLabel(r.items),
    created_by: r.created_by,
    responsible_name: null,
  }));

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 30 | 50>(10);

  const [filters, setFilters] = useState<FiltersState>(() => ({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
    tutor: "",
    vaccineQuery: "",
  }));

  const rows = useQuery({
    queryKey: ["reports", "vaccinations", filters],
    queryFn: () => fetchReport(filters),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<VaccinationReportRow | null>(null);

  const count = rows.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (rows.data ?? []).slice(start, start + pageSize);
  }, [rows.data, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-7">
      <PageHeader
        badge="Analytics"
        title="Relatório de vacinações"
        description="Consulte as aplicações registradas por período, tutor ou vacina."
      />

      <DataToolbar
        className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-r from-white to-vetvax-surface-panel/75 p-4 shadow-vetvax-card"
        leading={
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-vetvax-info-soft text-vetvax-info">
              <FileDown className="h-4 w-4" />
            </span>
            <StatusBadge>{count} registros</StatusBadge>
          </div>
        }
        filters={
          <div className="flex w-full flex-wrap items-center gap-2 xl:flex-nowrap">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
              className="h-10 w-full min-w-[156px] xl:w-[156px]"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
              className="h-10 w-full min-w-[156px] xl:w-[156px]"
            />
            <Input
              className="h-10 w-full min-w-[170px] xl:w-[190px]"
              placeholder="Tutor..."
              value={filters.tutor}
              onChange={(e) => setFilters((p) => ({ ...p, tutor: e.target.value }))}
            />
            <Input
              className="h-10 w-full min-w-[170px] xl:w-[190px]"
              placeholder="Vacina..."
              value={filters.vaccineQuery}
              onChange={(e) => setFilters((p) => ({ ...p, vaccineQuery: e.target.value }))}
            />
            <Button
              variant="outline"
              className="h-10 w-full xl:w-auto"
              onClick={async () => {
                await qc.invalidateQueries({ queryKey: ["reports", "vaccinations"] });
                toast({ title: "Atualizado" });
              }}
            >
              Atualizar
            </Button>
          </div>
        }
      />

      <section className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <VaccinationsReportTable
          loading={rows.isLoading}
          rows={pagedRows}
          totalCount={count}
          onExport={() => toast({ title: "CSV exportado" })}
          onDelete={(r) => {
            setDeleteRow(r);
            setDeleteOpen(true);
          }}
        />
        {!rows.isLoading && count > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-vetvax-border-soft pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-vetvax-text-tertiary">
              Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, count)} de {count}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <span className="text-xs font-semibold text-vetvax-text-secondary">Página {page} de {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <DeleteRecordDialog
        open={deleteOpen}
        row={deleteRow}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setDeleteRow(null);
        }}
        onChanged={async () => {
          await qc.invalidateQueries({ queryKey: ["reports", "vaccinations"] });
        }}
      />
    </div>
  );
}
