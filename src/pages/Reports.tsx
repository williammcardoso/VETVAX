import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ClipboardList, Syringe, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { matchesSearch, matchesSearchAny } from "@/lib/search";
import { buildGoogleMapsUrl, formatTutorAddressLine } from "@/lib/address";
import { displayReminderNotes } from "@/lib/reminderNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import VaccinationsReportTable, { type VaccinationReportRow } from "@/components/reports/VaccinationsReportTable";
import DeleteRecordDialog from "@/components/reports/DeleteRecordDialog";
import PageHeader from "@/components/layout/PageHeader";
import DataToolbar from "@/components/vetvax/DataToolbar";
import MetricTile from "@/components/vetvax/MetricTile";
import PaginationBar from "@/components/vetvax/PaginationBar";

const FETCH_LIMIT = 500;

type FiltersState = {
  from: string;
  to: string;
  tutor: string;
  pet: string;
  vaccineQuery: string;
};

type RecordItem = {
  quantity: number | null;
  free_description: string | null;
  price_cents: number | null;
  brand: string | null;
  lot: string | null;
  expires_on: string | null;
  pet: { name: string | null } | null;
  catalog_item: { name: string | null; category: string | null } | null;
};

type RecordReminder = {
  id: string;
  due_date: string;
  item_name: string | null;
  quantity: number | null;
  status: string;
  notes: string | null;
  is_active: boolean;
  pet: { name: string | null } | null;
};

type RecordRow = {
  id: string;
  applied_date: string;
  next_due_date: string | null;
  notes: string | null;
  created_at: string;
  tutor_id: string;
  created_by: string | null;
  tutor: {
    id: string;
    name: string;
    phone1: string | null;
    phone2: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    uf: string | null;
  } | null;
  items: RecordItem[] | null;
  next_reminders: RecordReminder[] | null;
  resolved: { due_date: string; item_name: string | null } | { due_date: string; item_name: string | null }[] | null;
};

const SELECT =
  "id, applied_date, next_due_date, notes, created_at, tutor_id, created_by, " +
  "tutor:tutors(id, name, phone1, phone2, street, number, neighborhood, city, uf), " +
  "items:vaccination_record_items(quantity, free_description, price_cents, brand, lot, expires_on, pet:pets(name), catalog_item:catalog_items(name, category)), " +
  "next_reminders:reminders!reference_record_id(id, due_date, item_name, quantity, status, notes, is_active, pet:pets(name)), " +
  "resolved:reminders!reference_reminder_id(due_date, item_name)";

const CATEGORY_LABEL: Record<string, string> = { vaccine: "Vacina", medication: "Medicação", other: "Outro" };

function exportReportCsv(rows: VaccinationReportRow[]) {
  if (rows.length === 0) {
    toast({ title: "Nada para exportar", description: "Ajuste os filtros para ter registros.", variant: "destructive" });
    return;
  }

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const br = (d: string | null) => (d ? dayjs(d).format("DD/MM/YYYY") : "");
  const headers = [
    "Data da aplicação",
    "Tutor",
    "Telefone",
    "Endereço",
    "Pet",
    "Item",
    "Categoria",
    "Quantidade",
    "Marca",
    "Lote",
    "Validade",
    "Valor (R$)",
    "Descrição do item",
    "Observações da aplicação",
    "Próximos retornos",
    "Responsável",
    "Registrado em",
  ];
  const lines = [headers.map(escape).join(";")];

  for (const r of rows) {
    const returns = r.reminders
      .filter((rem) => rem.status !== "ARQUIVADO")
      .map((rem) => `${br(rem.due_date)} - ${rem.quantity ?? 1}x ${rem.item_name ?? ""}${rem.pet_name ? ` (${rem.pet_name})` : ""}`)
      .join(" | ");
    const common = {
      tutor: r.tutor_name,
      phone: [r.tutor_phone1, r.tutor_phone2].filter(Boolean).join(" / "),
      address: r.tutor_address ?? "",
      notes: displayReminderNotes(r.notes) ?? "",
      returns,
      responsible: r.responsible_name ?? "",
      registered: dayjs(r.registered_at).format("DD/MM/YYYY HH:mm"),
    };
    const items = r.items.length > 0 ? r.items : [null];

    for (const it of items) {
      lines.push(
        [
          br(r.applied_date),
          common.tutor,
          common.phone,
          common.address,
          it?.pet_name ?? "",
          it?.name ?? "",
          it ? (CATEGORY_LABEL[it.category] ?? it.category) : "",
          it ? String(it.quantity) : "",
          it?.brand ?? "",
          it?.lot ?? "",
          br(it?.expires_on ?? null),
          it?.price_cents != null ? (it.price_cents / 100).toFixed(2).replace(".", ",") : "",
          it?.description ?? "",
          common.notes,
          common.returns,
          common.responsible,
          common.registered,
        ]
          .map((value) => escape(String(value ?? "")))
          .join(";"),
      );
    }
  }

  // BOM so Excel pt-br opens the accented text correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vetvax-relatorio-${dayjs().format("YYYY-MM-DD")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast({ title: "CSV exportado", description: `${rows.length} aplicação(ões), uma linha por item.` });
}

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

async function fetchReport(range: { from: string; to: string }) {
  const { data, error } = await supabase
    .from("vaccination_records")
    .select(SELECT)
    .eq("is_active", true)
    .gte("applied_date", range.from)
    .lte("applied_date", range.to)
    .order("applied_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (error) throw error;

  const records = (data ?? []) as unknown as RecordRow[];

  const nameMap = await lookupProfileNames(records.map((r) => r.created_by).filter(Boolean) as string[]);

  const mapped: VaccinationReportRow[] = records.map((r) => {
    const items = (r.items ?? []).map((it) => ({
      name: String(it.catalog_item?.name ?? "").trim() || "Item removido",
      category: it.catalog_item?.category ?? "other",
      quantity: it.quantity ?? 1,
      pet_name: it.pet?.name ?? null,
      brand: it.brand?.trim() || null,
      lot: it.lot?.trim() || null,
      expires_on: it.expires_on,
      price_cents: it.price_cents,
      description: it.free_description?.trim() || null,
    }));
    const resolved = Array.isArray(r.resolved) ? (r.resolved[0] ?? null) : r.resolved;
    const addressSource = r.tutor;

    return {
      record_id: r.id,
      applied_date: r.applied_date,
      registered_at: r.created_at,
      next_due_date: r.next_due_date,
      tutor_id: r.tutor_id ?? "",
      tutor_name: r.tutor?.name ?? "—",
      tutor_phone1: r.tutor?.phone1 ?? null,
      tutor_phone2: r.tutor?.phone2 ?? null,
      tutor_address: formatTutorAddressLine(addressSource) || null,
      tutor_maps_url: buildGoogleMapsUrl(addressSource),
      vaccines: uniqueLabels(items.map((it) => it.name)),
      items,
      notes: r.notes,
      reminders: (r.next_reminders ?? [])
        .filter((rem) => rem.is_active)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((rem) => ({
          id: rem.id,
          due_date: rem.due_date,
          item_name: rem.item_name,
          quantity: rem.quantity,
          status: rem.status,
          notes: rem.notes,
          pet_name: rem.pet?.name ?? null,
        })),
      resolved_reminder: resolved ? { due_date: resolved.due_date, item_name: resolved.item_name } : null,
      created_by: r.created_by,
      responsible_name: r.created_by ? (nameMap[r.created_by] ?? null) : null,
    };
  });

  return mapped;
}

function applyFilters(rows: VaccinationReportRow[], filters: FiltersState) {
  const tutorTerm = filters.tutor.trim();
  const petTerm = filters.pet.trim();
  const vaccineTerm = filters.vaccineQuery.trim();

  return rows.filter((row) => {
    if (tutorTerm && !matchesSearchAny([row.tutor_name, row.tutor_phone1, row.tutor_phone2], tutorTerm)) return false;
    if (petTerm && !row.items.some((it) => it.pet_name && matchesSearch(it.pet_name, petTerm))) return false;
    if (vaccineTerm && !row.items.some((it) => matchesSearch(it.name, vaccineTerm))) return false;
    return true;
  });
}

function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-vetvax-text-tertiary">{label}</Label>
      {children}
    </div>
  );
}

export default function Reports() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(25);

  const [filters, setFilters] = useState<FiltersState>(() => ({
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
    tutor: "",
    pet: "",
    vaccineQuery: "",
  }));

  const report = useQuery({
    queryKey: ["reports", "vaccinations", filters.from, filters.to],
    queryFn: () => fetchReport({ from: filters.from, to: filters.to }),
  });
  const filtered = useMemo(() => applyFilters(report.data ?? [], filters), [report.data, filters]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<VaccinationReportRow | null>(null);

  const count = filtered.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const summary = useMemo(() => {
    const data = filtered;
    return {
      doses: data.reduce((acc, r) => acc + r.items.reduce((s, it) => s + it.quantity, 0), 0),
      tutors: new Set(data.map((r) => r.tutor_id)).size,
      returns: data.reduce((acc, r) => acc + r.reminders.filter((rem) => rem.status === "ATIVO").length, 0),
    };
  }, [filtered]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hitLimit = report.isSuccess && (report.data?.length ?? 0) >= FETCH_LIMIT;

  return (
    <div className="space-y-7">
      <PageHeader
        badge="Relatórios"
        title="Relatório de vacinações"
        description="Tudo o que foi aplicado: itens, lote, validade, valor, observações, contato do tutor e os retornos agendados."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Aplicações" value={count} icon={ClipboardList} />
        <MetricTile label="Doses aplicadas" value={summary.doses} icon={Syringe} tone="info" />
        <MetricTile label="Tutores atendidos" value={summary.tutors} icon={Users} tone="success" />
        <MetricTile label="Retornos pendentes" value={summary.returns} icon={Bell} tone="warning" />
      </div>

      <DataToolbar
        className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-r from-white to-vetvax-surface-panel/75 p-4 shadow-vetvax-card"
        filters={
          <div className="flex w-full flex-wrap items-end gap-3">
            <FilterField label="De (data da aplicação)" className="w-full sm:w-[160px]">
              <Input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className="h-10" />
            </FilterField>
            <FilterField label="Até" className="w-full sm:w-[160px]">
              <Input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className="h-10" />
            </FilterField>
            <FilterField label="Tutor ou telefone" className="w-full sm:w-[190px]">
              <Input
                className="h-10"
                placeholder="Ex.: Maria"
                value={filters.tutor}
                onChange={(e) => setFilters((p) => ({ ...p, tutor: e.target.value }))}
              />
            </FilterField>
            <FilterField label="Pet" className="w-full sm:w-[160px]">
              <Input className="h-10" placeholder="Ex.: Luna" value={filters.pet} onChange={(e) => setFilters((p) => ({ ...p, pet: e.target.value }))} />
            </FilterField>
            <FilterField label="Vacina / item" className="w-full sm:w-[190px]">
              <Input
                className="h-10"
                placeholder="Ex.: V10"
                value={filters.vaccineQuery}
                onChange={(e) => setFilters((p) => ({ ...p, vaccineQuery: e.target.value }))}
              />
            </FilterField>
            <FilterField label="Exibir" className="w-[110px]">
              <Select value={String(pageSize)} onValueChange={(v) => v && setPageSize(Number(v) as 10 | 25 | 50 | 100)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <Button
              variant="outline"
              className="h-10"
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

      {hitLimit ? (
        <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Mostrando as {FETCH_LIMIT} aplicações mais recentes do período. Reduza o período para ver as mais antigas.
        </p>
      ) : null}

      <section className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <VaccinationsReportTable
          loading={report.isLoading}
          rows={pagedRows}
          totalCount={count}
          onExport={() => exportReportCsv(filtered)}
          onDelete={(r) => {
            setDeleteRow(r);
            setDeleteOpen(true);
          }}
        />
        {!report.isLoading && count > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-vetvax-border-soft pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-vetvax-text-tertiary">
              Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, count)} de {count}
            </p>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
