import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { CatalogItem, Pet } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActionButton from "@/components/vetvax/ActionButton";

const NOTES_PLACEHOLDER = "Ex: segunda dose, vacina anual, reforço...";

export type FutureReminderRow = {
  catalog_item_id: string;
  due_date: string;
  pet_id: string | null;
  notes: string;
  quantity: number;
};

const DAY_SHORTCUTS = [
  { label: "15 dias", days: 15 },
  { label: "21 dias", days: 21 },
  { label: "28 dias", days: 28 },
  { label: "1 ano", days: 365 },
];

const NOTES_SHORTCUTS = ["1ª dose", "2ª dose", "3ª dose", "4ª dose", "Dose anual"];

export function emptyFutureReminderRow(): FutureReminderRow {
  return { catalog_item_id: "", due_date: "", pet_id: null, notes: "", quantity: 1 };
}

const inputClass = "h-11 border-vetvax-border-medium bg-white text-[15px] shadow-sm";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-vetvax-primary bg-vetvax-primary text-white"
          : "border-vetvax-border-medium bg-white text-vetvax-text-secondary hover:border-vetvax-primary-border hover:bg-vetvax-primary-soft hover:text-vetvax-primary",
      )}
    >
      {children}
    </button>
  );
}

export default function FutureRemindersField({
  rows,
  onChange,
  baseDate,
  catalog,
  pets,
  showPetSelect,
  firstRowDefaults,
}: {
  rows: FutureReminderRow[];
  onChange: (rows: FutureReminderRow[]) => void;
  baseDate: string;
  catalog: CatalogItem[];
  pets: Pet[];
  showPetSelect: boolean;
  /** Applied when the very first row is added (e.g. duplicate the just-applied vaccine + quantity). */
  firstRowDefaults?: Partial<FutureReminderRow>;
}) {
  // With more than one return, cards can be collapsed to a one-line summary.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const updateRow = (idx: number, patch: Partial<FutureReminderRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
    setCollapsed((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  };

  const addRow = () => {
    const base = emptyFutureReminderRow();
    const next = rows.length === 0 && firstRowDefaults ? { ...base, ...firstRowDefaults } : base;
    onChange([...rows, next]);
    // keep the new card open and fold the previous ones
    setCollapsed(new Set(rows.map((_, i) => i)));
  };

  const toggle = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const shortcutBase = baseDate || dayjs().format("YYYY-MM-DD");

  return (
    <div className="space-y-5">
      {rows.map((row, idx) => {
        const vaccineName = catalog.find((c) => c.id === row.catalog_item_id)?.name;
        const dueLabel = row.due_date ? dayjs(row.due_date).format("DD/MM/YYYY") : null;
        const summary = [
          vaccineName ?? "Vacina não escolhida",
          `${row.quantity} ${row.quantity === 1 ? "dose" : "doses"}`,
          dueLabel ?? "sem data",
        ].join("  •  ");

        const isCollapsed = rows.length > 1 && collapsed.has(idx);
        const incomplete = !row.catalog_item_id || !row.due_date;

        return (
          <div
            key={idx}
            className="overflow-hidden rounded-[14px] border border-vetvax-border-medium bg-white shadow-sm"
          >
            <div
              className={cn(
                "flex items-center gap-3 bg-vetvax-primary-soft px-4 py-3",
                isCollapsed ? "" : "border-b border-vetvax-primary-border",
                rows.length > 1 ? "cursor-pointer" : "",
              )}
              onClick={rows.length > 1 ? () => toggle(idx) : undefined}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vetvax-primary text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-vetvax-text-main">Retorno {idx + 1}</p>
                <p className="truncate text-xs font-medium text-vetvax-text-secondary">{summary}</p>
              </div>
              {incomplete && isCollapsed ? (
                <span className="shrink-0 rounded-pill bg-vetvax-warning-soft px-2 py-0.5 text-[11px] font-bold text-vetvax-warning">faltam dados</span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-vetvax-danger hover:bg-vetvax-danger-soft hover:text-vetvax-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRow(idx);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remover
              </Button>
              {rows.length > 1 ? (
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-vetvax-text-secondary transition-transform", isCollapsed ? "" : "rotate-180")} />
              ) : null}
            </div>

            <div className={cn("space-y-4 p-4 sm:p-5", isCollapsed ? "hidden" : "")}>
              {/* Wide screens: vacina + qtd + pet on one line, data + observação on the next. Small screens stack. */}
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_96px] lg:grid-cols-[minmax(0,1.6fr)_96px_minmax(0,1fr)]">
                <div className="grid content-start gap-1.5 md:col-span-2 lg:col-span-1">
                  <Label className="text-sm font-semibold text-vetvax-text-main">Vacina</Label>
                  <Select value={row.catalog_item_id} onValueChange={(v) => updateRow(idx, { catalog_item_id: v })}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Selecione a vacina..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-control">
                      {catalog.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid content-start gap-1.5">
                  <Label className="text-sm font-semibold text-vetvax-text-main">Qtd.</Label>
                  <Input
                    type="number"
                    min={1}
                    className={cn(inputClass, "text-center font-semibold")}
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>

                <div className="grid content-start gap-1.5">
                  <Label className="text-sm font-semibold text-vetvax-text-main">Pet (opcional)</Label>
                  <Select
                    value={row.pet_id ?? "_none"}
                    onValueChange={(v) => updateRow(idx, { pet_id: v === "_none" ? null : v })}
                    disabled={!showPetSelect}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder={showPetSelect ? "Selecione..." : "Desligado"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-control">
                      <SelectItem value="_none">Sem pet</SelectItem>
                      {pets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 border-t border-vetvax-border-soft pt-4 md:grid-cols-[200px_minmax(0,1fr)]">
                <div className="grid content-start gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold text-vetvax-text-main">Data prevista</Label>
                    <Input
                      type="date"
                      className={inputClass}
                      value={row.due_date}
                      onChange={(e) => updateRow(idx, { due_date: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_SHORTCUTS.map((opt) => {
                      const target = dayjs(shortcutBase).add(opt.days, "day").format("YYYY-MM-DD");
                      return (
                        <Chip key={opt.days} active={row.due_date === target} onClick={() => updateRow(idx, { due_date: target })}>
                          {opt.label}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                <div className="grid content-start gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold text-vetvax-text-main">Observação</Label>
                    <Input
                      className={inputClass}
                      placeholder={NOTES_PLACEHOLDER}
                      value={row.notes}
                      onChange={(e) => updateRow(idx, { notes: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {NOTES_SHORTCUTS.map((label) => (
                      <Chip key={label} active={row.notes === label} onClick={() => updateRow(idx, { notes: label })}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <ActionButton type="button" emphasis="secondary" onClick={addRow}>
        <Plus className="h-4 w-4" />
        {rows.length === 0 ? "Adicionar retorno" : "Adicionar outro retorno"}
      </ActionButton>
    </div>
  );
}
