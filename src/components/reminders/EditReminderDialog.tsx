import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CatalogItem, DueReminderRow, Pet } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { displayReminderNotes } from "@/lib/reminderNotes";
import { dayjs } from "@/lib/datetime";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const KEEP_CURRENT = "_current";
const NO_PET = "_none";

function categoryToType(category: string) {
  return category === "vaccine" ? "vacina" : category === "medication" ? "medicação" : "outro";
}

export default function EditReminderDialog({
  row,
  onOpenChange,
  onSaved,
}: {
  row: DueReminderRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const [dueDate, setDueDate] = useState("");
  const [catalogId, setCatalogId] = useState(KEEP_CURRENT);
  const [petId, setPetId] = useState(NO_PET);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const initialNotes = useMemo(() => displayReminderNotes(row?.notes) ?? "", [row]);

  useEffect(() => {
    if (!row) return;
    setDueDate(row.due_date);
    setCatalogId(KEEP_CURRENT);
    setPetId(row.pet_id ?? NO_PET);
    setQuantity(row.quantity ?? 1);
    setNotes(initialNotes);
  }, [row, initialNotes]);

  const catalog = useQuery({
    queryKey: ["catalog", "active"],
    enabled: !!row,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, org_id, name, category, requires_description, allows_origin, default_origin, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const pets = useQuery({
    queryKey: ["pets", "byTutor", row?.tutor_id],
    enabled: !!row?.tutor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, org_id, tutor_id, name, species, age_text, birth_date, breed, color, notes, is_active")
        .eq("tutor_id", row!.tutor_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pet[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      if (!dueDate) throw new Error("Informe a data do lembrete.");
      const patch: Record<string, unknown> = {
        due_date: dueDate,
        pet_id: petId === NO_PET ? null : petId,
        quantity: Math.max(1, quantity || 1),
      };
      if (catalogId !== KEEP_CURRENT) {
        const item = (catalog.data ?? []).find((c) => c.id === catalogId);
        if (item) {
          patch.item_name = item.name;
          patch.reminder_type = categoryToType(item.category);
        }
      }
      if (notes !== initialNotes) patch.notes = notes.trim() || null;
      const { error } = await supabase.from("reminders").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Lembrete atualizado" });
      await onSaved();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Não foi possível salvar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[14px]">
        <DialogHeader>
          <DialogTitle>Editar lembrete{row ? ` — ${row.tutor_name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 grid gap-4">
          <div className="grid gap-2">
            <Label className="vetvax-label">Vacina</Label>
            <Select value={catalogId} onValueChange={setCatalogId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value={KEEP_CURRENT}>{row?.item_name ?? row?.reminder_type ?? "Atual"} (atual)</SelectItem>
                {(catalog.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="vetvax-label">Data prevista</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              {dueDate ? <p className="text-[11px] text-vetvax-text-tertiary">{dayjs(dueDate).format("DD/MM/YYYY")}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label className="vetvax-label">Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="vetvax-label">Pet (opcional)</Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value={NO_PET}>Sem pet</SelectItem>
                {(pets.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="vetvax-label">Observação</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: segunda dose, vacina anual..." />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
