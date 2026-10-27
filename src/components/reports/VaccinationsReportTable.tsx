import { Link } from "react-router-dom";
import { Bell, ClipboardList, FileDown, MapPin, Phone, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayjs, formatDateBr } from "@/lib/datetime";
import { formatBrPhoneForDisplay } from "@/lib/phone";
import { displayReminderNotes } from "@/lib/reminderNotes";
import { getItemTone } from "@/lib/itemTone";
import PetBadge from "@/components/vetvax/PetBadge";
import StatusBadge from "@/components/vetvax/StatusBadge";
import EmptyState from "@/components/vetvax/EmptyState";

export type ReportItem = {
  name: string;
  category: string;
  quantity: number;
  pet_name: string | null;
  brand: string | null;
  lot: string | null;
  expires_on: string | null;
  price_cents: number | null;
  description: string | null;
};

export type ReportReminder = {
  id: string;
  due_date: string;
  item_name: string | null;
  quantity: number | null;
  status: string;
  notes: string | null;
  pet_name: string | null;
};

export type VaccinationReportRow = {
  record_id: string;
  applied_date: string;
  registered_at: string;
  next_due_date: string | null;
  tutor_id: string;
  tutor_name: string;
  tutor_phone1: string | null;
  tutor_phone2: string | null;
  tutor_address: string | null;
  tutor_maps_url: string | null;
  vaccines: string;
  items: ReportItem[];
  notes: string | null;
  reminders: ReportReminder[];
  resolved_reminder: { due_date: string; item_name: string | null } | null;
  created_by: string | null;
  responsible_name: string | null;
};

const CATEGORY_LABEL: Record<string, string> = { vaccine: "Vacina", medication: "Medicação", other: "Outro" };

const STATUS_BADGE: Record<string, { label: string; tone: "warning" | "success" | "default" }> = {
  ATIVO: { label: "Ativo", tone: "warning" },
  FEITO: { label: "Resolvido", tone: "success" },
  ARQUIVADO: { label: "Arquivado", tone: "default" },
};

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Bell; children: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-vetvax-text-tertiary">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[8px] bg-vetvax-surface-alt px-2 py-1 text-xs text-vetvax-text-secondary">
      <span className="font-semibold text-vetvax-text-tertiary">{label}:</span>
      <span className="font-medium text-vetvax-text-main">{value}</span>
    </span>
  );
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
  const empty = !loading && rows.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StatusBadge>
          {rows.length}
          {typeof totalCount === "number" ? ` de ${totalCount}` : ""} registros
        </StatusBadge>
        <Button onClick={() => onExport(rows)} disabled={loading || rows.length === 0}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar CSV (todos os filtrados)
        </Button>
      </div>

      {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[180px] rounded-[16px]" />) : null}

      {rows.map((r) => {
        const phones = [r.tutor_phone1, r.tutor_phone2].filter(Boolean).map((p) => formatBrPhoneForDisplay(p));
        const totalDoses = r.items.reduce((acc, it) => acc + it.quantity, 0);
        const registered = dayjs(r.registered_at).format("DD/MM/YYYY [às] HH:mm");
        const notes = displayReminderNotes(r.notes);

        return (
          <article key={r.record_id} className="overflow-hidden rounded-[16px] border border-vetvax-border-medium bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-vetvax-border-soft bg-vetvax-surface-panel/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-[12px] bg-vetvax-primary px-3 py-2 text-center text-white">
                  <p className="text-lg font-extrabold leading-none">{dayjs(r.applied_date).format("DD")}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase leading-none">{dayjs(r.applied_date).format("MMM/YY")}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-vetvax-text-tertiary">Aplicação de {formatDateBr(r.applied_date)}</p>
                  <Link to={`/tutors/${r.tutor_id}`} className="flex items-center gap-1.5 text-base font-extrabold text-vetvax-text-main hover:text-vetvax-primary hover:underline">
                    <User className="h-4 w-4 shrink-0 text-vetvax-text-tertiary" />
                    {r.tutor_name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-vetvax-text-secondary">
                    {phones.length > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {phones.join(" • ")}
                      </span>
                    ) : null}
                    {r.tutor_address ? (
                      <a
                        href={r.tutor_maps_url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-vetvax-primary hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        {r.tutor_address}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                <p className="text-[11px] text-vetvax-text-tertiary">
                  Registrado por <span className="font-semibold text-vetvax-text-secondary">{r.responsible_name ?? "—"}</span>
                </p>
                <p className="text-[11px] text-vetvax-text-tertiary">em {registered}</p>
                <Button variant="outline" size="sm" className="mt-1" onClick={() => onDelete(r)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            </header>

            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <section>
                <SectionTitle icon={ClipboardList}>
                  {`O que foi aplicado — ${r.items.length} ${r.items.length === 1 ? "item" : "itens"}, ${totalDoses} ${totalDoses === 1 ? "dose" : "doses"}`}
                </SectionTitle>
                <ul className="space-y-2.5">
                  {r.items.map((it, i) => (
                    <li key={i} className="rounded-[12px] border border-vetvax-border-soft bg-white p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {it.pet_name ? <PetBadge name={it.pet_name} /> : <span className="text-xs italic text-vetvax-text-tertiary">sem pet vinculado</span>}
                        <span className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-bold leading-none ${getItemTone(it.name)}`}>
                          {it.quantity}x {it.name}
                        </span>
                        {it.category !== "vaccine" ? <StatusBadge>{CATEGORY_LABEL[it.category] ?? it.category}</StatusBadge> : null}
                      </div>
                      {it.brand || it.lot || it.expires_on || it.price_cents != null ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {it.brand ? <Detail label="Marca" value={it.brand} /> : null}
                          {it.lot ? <Detail label="Lote" value={it.lot} /> : null}
                          {it.expires_on ? <Detail label="Validade" value={formatDateBr(it.expires_on)} /> : null}
                          {it.price_cents != null ? <Detail label="Valor" value={money(it.price_cents)} /> : null}
                        </div>
                      ) : null}
                      {it.description ? <p className="mt-1.5 text-xs italic text-vetvax-text-secondary">{it.description}</p> : null}
                    </li>
                  ))}
                </ul>
                {notes ? (
                  <div className="mt-3 rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-alt p-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-vetvax-text-tertiary">Observações da aplicação</p>
                    <p className="mt-0.5 text-sm text-vetvax-text-main">{notes}</p>
                  </div>
                ) : null}
                {r.resolved_reminder ? (
                  <p className="mt-3 text-xs text-vetvax-text-tertiary">
                    ✔ Baixa do lembrete de <span className="font-semibold">{formatDateBr(r.resolved_reminder.due_date)}</span>
                    {r.resolved_reminder.item_name ? ` (${r.resolved_reminder.item_name})` : ""}
                  </p>
                ) : null}
              </section>

              <section>
                <SectionTitle icon={Bell}>Próximos retornos agendados</SectionTitle>
                {r.reminders.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-vetvax-border-medium p-3 text-sm text-vetvax-text-tertiary">
                    Nenhum retorno agendado para esta aplicação.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {r.reminders.map((rem) => {
                      const st = STATUS_BADGE[rem.status] ?? STATUS_BADGE.ATIVO;
                      const remNotes = displayReminderNotes(rem.notes);
                      return (
                        <li key={rem.id} className="rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel/50 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-extrabold text-vetvax-text-main">{formatDateBr(rem.due_date)}</p>
                            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-vetvax-text-secondary">
                            {rem.pet_name ? <PetBadge name={rem.pet_name} /> : null}
                            <span>
                              {rem.quantity ?? 1}x {rem.item_name ?? "—"}
                            </span>
                          </div>
                          {remNotes ? <p className="mt-1 text-xs italic text-vetvax-text-tertiary">{remNotes}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </article>
        );
      })}

      {empty ? <EmptyState icon={ClipboardList} title="Nenhum registro" description="Ajuste o período ou os filtros para encontrar aplicações." /> : null}
    </div>
  );
}
