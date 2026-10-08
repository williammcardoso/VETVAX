import { CalendarDays, Plus, StickyNote, Syringe, Trash2 } from "lucide-react";
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

function BlockTitle({ icon: Icon, children }: { icon: typeof Syringe; children: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-vetvax-border-soft pb-2">
      <span className="grid h-6 w-6 place-items-center rounded-[8px] bg-vetvax-primary-soft text-vetvax-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-xs font-bold uppercase tracking-wider text-vetvax-text-secondary">{children}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-vetvax-primary bg-vetvax-primary text-white shadow-sm"
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
  const updateRow = (idx: number, patch: Partial<FutureReminderRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    const base = emptyFutureReminderRow();
    const next = rows.length === 0 && firstRowDefaults ? { ...base, ...firstRowDefaults } : base;
    onChange([...rows, next]);
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

        return (
          <div
            key={idx}
            className="overflow-hidden rounded-[16px] border-2 border-vetvax-border-medium bg-white shadow-md"
          >
            <div className="flex items-center gap-3 border-b-2 border-vetvax-primary-border bg-vetvax-primary-soft px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vetvax-primary text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-vetvax-text-main">Retorno {idx + 1}</p>
                <p className="truncate text-xs font-medium text-vetvax-text-secondary">{summary}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-vetvax-danger hover:bg-vetvax-danger-soft hover:text-vetvax-danger"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remover
              </Button>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              <section>
                <BlockTitle icon={Syringe}>Vacina e quantidade</BlockTitle>
                <div className="grid gap-4">
                  <div className="grid gap-1.5">
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

                  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-sm font-semibold text-vetvax-text-main">Qtd.</Label>
                    <Input
                      type="number"
                      min={1}
                      className={cn(inputClass, "text-center font-semibold")}
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>

                  <div className="grid gap-1.5">
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
                </div>
              </section>

              <section>
                <BlockTitle icon={CalendarDays}>Quando voltar</BlockTitle>
                <div className="grid gap-4">
                  <div className="grid max-w-[240px] gap-1.5">
                    <Label className="text-sm font-semibold text-vetvax-text-main">Data prevista</Label>
                    <Input
                      type="date"
                      className={inputClass}
                      value={row.due_date}
                      onChange={(e) => updateRow(idx, { due_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-vetvax-text-tertiary">Ou escolha um prazo a partir da data da aplicação:</p>
                    <div className="flex flex-wrap gap-2">
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
                </div>
              </section>

              <section>
                <BlockTitle icon={StickyNote}>Observação</BlockTitle>
                <div className="grid gap-3">
                  <Input
                    className={inputClass}
                    placeholder={NOTES_PLACEHOLDER}
                    value={row.notes}
                    onChange={(e) => updateRow(idx, { notes: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    {NOTES_SHORTCUTS.map((label) => (
                      <Chip key={label} active={row.notes === label} onClick={() => updateRow(idx, { notes: label })}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </section>
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
