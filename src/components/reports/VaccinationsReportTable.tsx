import { useMemo, useState } from "react";
import { FileDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBr, formatTimeBr } from "@/lib/datetime";

export type VaccinationReportRow = {
  checkout_id: string;
  appointment_id: string;
  checkout_date: string;
  scheduled_date: string;
  scheduled_time: string;
  tutor_id: string;
  tutor_name: string;
  tutor_phone1: string | null;
  tutor_phone2: string | null;
  status: "APLICADO" | "CANCELADO";
  vaccines: string;
  created_by: string | null;
  responsible_name: string | null;
};

function toCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
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
  onReopen,
}: {
  rows: VaccinationReportRow[];
  loading: boolean;
  onExport: (rows: VaccinationReportRow[]) => void;
  onReopen: (row: VaccinationReportRow) => void;
}) {
  const [exporting, setExporting] = useState(false);

  const empty = !loading && rows.length === 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const flat = rows.map((r) => ({
        data_baixa: r.checkout_date,
        data_agendamento: r.scheduled_date,
        hora: r.scheduled_time,
        tutor: r.tutor_name,
        vacinas: r.vaccines,
        responsavel: r.responsible_name ?? "",
        status: r.status,
        appointment_id: r.appointment_id,
        checkout_id: r.checkout_id,
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
    <div className="overflow-hidden rounded-[10px] border-[1.5px] border-border">
      <div className="flex flex-col gap-2 border-b border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {rows.length} registros
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-10 rounded-[10px]"
            onClick={exportCsv}
            disabled={loading || exporting || rows.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[140px]">Data</TableHead>
            <TableHead className="w-[100px]">Hora</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="hidden lg:table-cell">Responsável</TableHead>
            <TableHead>Vacina</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[160px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <Skeleton className="h-9 w-full rounded-[10px]" />
                </TableCell>
              </TableRow>
            ))}

          {rendered.map((r) => (
            <TableRow key={r.checkout_id} className="hover:bg-muted/30">
              <TableCell className="align-top">
                <div className="text-xs font-semibold">{formatDateBr(r.checkout_date)}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">agend.: {formatDateBr(r.scheduled_date)}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="text-xs font-semibold text-primary">{formatTimeBr(r.scheduled_time)}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="text-sm font-medium leading-tight">{r.tutor_name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">#{r.appointment_id.slice(0, 8)}</div>
              </TableCell>
              <TableCell className="hidden lg:table-cell align-top">
                <div className="text-sm">{r.responsible_name ?? "—"}</div>
              </TableCell>
              <TableCell className="align-top">
                <div className="text-sm">{r.vaccines || "—"}</div>
              </TableCell>
              <TableCell className="align-top">
                {r.status === "APLICADO" ? (
                  <Badge className="rounded-full border-0 bg-emerald-600 text-white">APLICADO</Badge>
                ) : (
                  <Badge className="rounded-full border-0 bg-red-600 text-white">CANCELADO</Badge>
                )}
              </TableCell>
              <TableCell className="text-right align-top">
                <Button variant="secondary" className="h-10 rounded-[10px]" onClick={() => onReopen(r)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reabrir
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {empty && (
            <TableRow>
              <TableCell colSpan={7} className="py-10">
                <div className="mx-auto max-w-sm text-center">
                  <div className="text-sm font-medium">Nenhum registro</div>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para encontrar vacinações.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}