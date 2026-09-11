import { useMemo, useState } from "react";
import { FileDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBr } from "@/lib/datetime";

export type VaccinationReportRow = {
  record_id: string;
  applied_date: string;
  next_due_date: string | null;
  tutor_id: string;
  tutor_name: string;
  tutor_phone1: string | null;
  tutor_phone2: string | null;
  vaccines: string;
  created_by: string | null;
  responsible_name: string | null;
};

type CsvValue = string | number | boolean | null | undefined;

function toCsv(rows: Array<Record<string, CsvValue>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: CsvValue) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function VaccinationsReportTable({
  rows,
  loading,
  onExport,
  onDelete,
  totalCount,
}: {
  rows: VaccinationReportRow[];
  loading: boolean;
  onExport: (rows: VaccinationReportRow[]) => void;
  onDelete: (row: VaccinationReportRow) => void;
  totalCount?: number;
}) {
  const [exporting, setExporting] = useState(false);

  const empty = !loading && rows.length === 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const flat = rows.map((r) => ({
        data_aplicacao: r.applied_date,
        proxima_dose: r.next_due_date ?? "",
        tutor: r.tutor_name,
        vacinas: r.vaccines,
        responsavel: r.responsible_name ?? "",
        record_id: r.record_id,
      }));
      const csv = toCsv(flat);
      const filename = `vetvax_vacinacoes_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadText(filename, csv);
      onExport(rows);
    } finally {
      setExporting(false);
    }
  };

  const rendered = useMemo(() => rows, [rows]);

  return (
    <div className="overflow-hidden rounded-card-md border border-vetvax-border-soft bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 border-b border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel to-vetvax-surface-alt p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-pill">
            {rows.length}
            {typeof totalCount === "number" ? ` de ${totalCount}` : ""} registros
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={exportCsv}
            disabled={loading || exporting || rows.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Table className="[&_tr]:border-vetvax-border-soft">
        <TableHeader>
          <TableRow className="bg-vetvax-surface-alt">
            <TableHead className="w-[140px]">Data</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="hidden lg:table-cell">Responsável</TableHead>
            <TableHead>Vacina</TableHead>
            <TableHead className="w-[140px]">Próxima dose</TableHead>
            <TableHead className="w-[120px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-14 w-full rounded-control" />
                </TableCell>
              </TableRow>
            ))}

          {rendered.map((r) => (
            <TableRow key={r.record_id} className="h-[72px] hover:bg-[#f3faf8]">
              <TableCell className="align-top">
                <div className="text-xs font-semibold">{formatDateBr(r.applied_date)}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="text-sm font-bold leading-tight text-vetvax-text-main">{r.tutor_name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-vetvax-text-tertiary">registro {r.record_id.slice(0, 8)}</div>
              </TableCell>
              <TableCell className="hidden lg:table-cell align-top">
                <div className="text-sm text-vetvax-text-secondary">{r.responsible_name ?? "—"}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="line-clamp-2 text-sm text-vetvax-text-secondary">{r.vaccines || "—"}</div>
              </TableCell>
              <TableCell className="align-top">
                {r.next_due_date ? (
                  <Badge className="rounded-pill border-transparent bg-vetvax-warning-soft text-vetvax-warning">{formatDateBr(r.next_due_date)}</Badge>
                ) : (
                  <span className="text-xs text-vetvax-text-tertiary">—</span>
                )}
              </TableCell>
              <TableCell className="text-right align-top">
                <Button variant="outline" onClick={() => onDelete(r)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {empty && (
            <TableRow>
              <TableCell colSpan={6} className="py-10">
                <div className="mx-auto max-w-sm text-center">
                  <div className="text-sm font-medium">Nenhum registro</div>
                  <p className="mt-1 text-xs text-vetvax-text-tertiary">Ajuste os filtros para encontrar vacinações.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
