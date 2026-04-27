import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Pet } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  species: z.enum(["dog", "cat", "other"]),
  age_text: z.string().optional(),
  birth_date: z.string().optional(),
  breed: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function PetUpsertDialog({
  open,
  onOpenChange,
  tutorId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tutorId: string;
  initial: Pet | null;
  onSaved: () => void;
}) {
  const { profile } = useAuth();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      species: initial?.species ?? "dog",
      age_text: initial?.age_text ?? "",
      birth_date: initial?.birth_date ?? "",
      breed: initial?.breed ?? "",
      color: initial?.color ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (!profile?.org_id) throw new Error("Sem organização no perfil (faça onboarding)");

      const payload = {
        org_id: profile.org_id,
        tutor_id: tutorId,
        name: values.name,
        species: values.species,
        age_text: values.age_text || null,
        birth_date: values.birth_date || null,
        breed: values.breed || null,
        color: values.color || null,
        notes: values.notes || null,
      };

      if (initial?.id) {
        const { org_id, ...updatePayload } = payload;
        const { error } = await supabase.from("pets").update(updatePayload).eq("id", initial.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("pets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: initial?.id ? "Pet atualizado" : "Pet criado" });
      onSaved();
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao salvar pet", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] border-[1.5px] border-border shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar pet" : "Novo pet"}</DialogTitle>
        </DialogHeader>

        <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("name")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Espécie</Label>
              <Select value={form.watch("species")} onValueChange={(v) => form.setValue("species", v as Values["species"]) }>
                <SelectTrigger className="h-10 rounded-[10px] border-[1.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[10px]">
                  <SelectItem value="dog">Cão</SelectItem>
                  <SelectItem value="cat">Gato</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Idade (texto)</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: 2 anos" {...form.register("age_text")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input type="date" className="h-10 rounded-[10px] border-[1.5px]" {...form.register("birth_date")} />
            </div>
            <div className="grid gap-2">
              <Label>Raça</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("breed")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Cor</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("color")} />
          </div>

          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea className="rounded-[10px] border-[1.5px]" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="h-10 rounded-[10px]" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-[10px]" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}