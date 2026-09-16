import { Plus, Trash2 } from "lucide-react";
import type { CatalogItem, Pet } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
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
};

const DAY_SHORTCUTS = [
  { label: "15 dias", days: 15 },
  { label: "21 dias", days: 21 },
  { label: "28 dias", days: 28 },
  { label: "Anual (365 dias)", days: 365 },
];

export function emptyFutureReminderRow(): FutureReminderRow {
  return { catalog_item_id: "", due_date: "", pet_id: null, notes: "" };
}

export default function FutureRemindersField({
  rows,
  onChange,
  baseDate,
  catalog,
  pets,
  showPetSelect,
}: {
  rows: FutureReminderRow[];
  onChange: (rows: FutureReminderRow[]) => void;
  baseDate: string;
  catalog: CatalogItem[];
  pets: Pet[];
  showPetSelect: boolean;
}) {
  const updateRow = (idx: number, patch: Partial<FutureReminderRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...rows, emptyFutureReminderRow()]);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/80 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
            <div className="grid gap-2 sm:col-span-5">
              <Label className="vetvax-label">Vacina</Label>
              <Select value={row.catalog_item_id} onValueChange={(v) => updateRow(idx, { catalog_item_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
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

            <div className="grid gap-2 sm:col-span-3">
              <Label className="vetvax-label">Data prevista</Label>
              <Input type="date" value={row.due_date} onChange={(e) => updateRow(idx, { due_date: e.target.value })} />
            </div>

            <div className="grid gap-2 sm:col-span-3">
              <Label className="vetvax-label">Pet (opcional)</Label>
              <Select
                value={row.pet_id ?? "_none"}
                onValueChange={(v) => updateRow(idx, { pet_id: v === "_none" ? null : v })}
                disabled={!showPetSelect}
              >
                <SelectTrigger>
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

            <div className="sm:col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAY_SHORTCUTS.map((opt) => (
              <Button
                key={opt.days}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-pill px-2.5 text-xs"
                onClick={() => {
                  const base = baseDate || dayjs().format("YYYY-MM-DD");
                  updateRow(idx, { due_date: dayjs(base).add(opt.days, "day").format("YYYY-MM-DD") });
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="mt-3 grid gap-2">
            <Label className="vetvax-label">Observação (opcional)</Label>
            <Input
              placeholder={NOTES_PLACEHOLDER}
              value={row.notes}
              onChange={(e) => updateRow(idx, { notes: e.target.value })}
            />
          </div>
        </div>
      ))}

      <ActionButton type="button" emphasis="secondary" onClick={addRow}>
        <Plus className="h-4 w-4" />
        {rows.length === 0 ? "Adicionar" : "Adicionar outro"}
      </ActionButton>
    </div>
  );
}
