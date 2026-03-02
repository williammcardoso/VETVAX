import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { dayjs } from "@/lib/datetime";

type Status = "all" | "PENDENTE" | "APLICADO" | "CANCELADO";

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

export default function Reports() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [status, setStatus] = useState<Status>("all");

  const filename = useMemo(() => {
    const s = status === "all" ? "todos" : status.toLowerCase();
    return `vetvax_agendamentos_${from}_a_${to}_${s}.csv`;
  }, [from, to, status]);

  const exportCsv = async () => {
    try {
      let q = supabase
        .from("appointments")
        .select("id, scheduled_date, scheduled_time, channel, status, notes, tutor:tutors(name, phone1, phone2)")
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (status !== "all") q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;

      const flat = (data ?? []).map((r: any) => ({
        id: r.id,
        data: r.scheduled_date,
        hora: r.scheduled_time,
        canal: r.channel,
        status: r.status,
        tutor_nome: r.tutor?.name ?? "",
        tutor_phone1: r.tutor?.phone1 ?? "",
        tutor_phone2: r.tutor?.phone2 ?? "",
        observacao: r.notes ?? "",
      }));

      const csv = toCsv(flat);
      if (!csv) {
        toast({ title: "Sem dados", description: "Nenhum agendamento no filtro." });
        return;
      }

      downloadText(filename, csv);
      toast({ title: "Export gerado", description: filename });
    } catch (e: any) {
      toast({ title: "Falha no export", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <FileDown className="h-3.5 w-3.5" />
          Relatórios
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Exports (CSV)</h1>
        <p className="mt-1 text-sm text-muted-foreground">MVP: exportar agendamentos por período e status (client-side).</p>
      </div>

      <Card className="rounded-3xl p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="grid gap-2">
            <Label>De</Label>
            <Input type="date" className="rounded-2xl" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Até</Label>
            <Input type="date" className="rounded-2xl" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="APLICADO">Aplicado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button className="rounded-2xl" onClick={exportCsv}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
