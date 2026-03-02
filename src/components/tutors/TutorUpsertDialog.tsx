import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Tutor } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { normalizeBrPhone } from "@/lib/phone";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  uf: z.string().optional(),
  notes: z.string().optional(),
  tagsText: z.string().optional(),
  contact_consent: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

export default function TutorUpsertDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Tutor | null;
  onSaved: (id: string) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      phone1: initial?.phone1 ?? "",
      phone2: initial?.phone2 ?? "",
      street: initial?.street ?? "",
      number: initial?.number ?? "",
      complement: initial?.complement ?? "",
      neighborhood: initial?.neighborhood ?? "",
      city: initial?.city ?? "",
      uf: initial?.uf ?? "",
      notes: initial?.notes ?? "",
      tagsText: initial?.tags?.join(", ") ?? "",
      contact_consent: initial?.contact_consent ?? false,
    },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        name: values.name,
        phone1: values.phone1 ? normalizeBrPhone(values.phone1) : null,
        phone2: values.phone2 ? normalizeBrPhone(values.phone2) : null,
        street: values.street || null,
        number: values.number || null,
        complement: values.complement || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        uf: values.uf || null,
        notes: values.notes || null,
        tags: (values.tagsText ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        contact_consent: values.contact_consent,
      };

      if (initial?.id) {
        const { data, error } = await supabase.from("tutors").update(payload).eq("id", initial.id).select("id").single();
        if (error) throw error;
        return data.id as string;
      }

      const { data, error } = await supabase.from("tutors").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast({ title: initial?.id ? "Tutor atualizado" : "Tutor criado" });
      onSaved(id);
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao salvar tutor",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar tutor" : "Novo tutor"}</DialogTitle>
        </DialogHeader>

        <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input className="rounded-2xl" placeholder="Ex: Maria Silva" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Telefone 1</Label>
              <Input className="rounded-2xl" placeholder="+55 11 99999-9999" {...form.register("phone1")} />
            </div>
            <div className="grid gap-2">
              <Label>Telefone 2</Label>
              <Input className="rounded-2xl" placeholder="Opcional" {...form.register("phone2")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-6">
            <div className="grid gap-2 sm:col-span-3">
              <Label>Rua</Label>
              <Input className="rounded-2xl" {...form.register("street")} />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label>Nº</Label>
              <Input className="rounded-2xl" {...form.register("number")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Complemento</Label>
              <Input className="rounded-2xl" {...form.register("complement")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Bairro</Label>
              <Input className="rounded-2xl" {...form.register("neighborhood")} />
            </div>
            <div className="grid gap-2 sm:col-span-3">
              <Label>Cidade</Label>
              <Input className="rounded-2xl" {...form.register("city")} />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label>UF</Label>
              <Input className="rounded-2xl" maxLength={2} {...form.register("uf")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input className="rounded-2xl" placeholder="cliente antigo, vip" {...form.register("tagsText")} />
            <div className="flex flex-wrap gap-1">
              {(form.watch("tagsText") ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 6)
                .map((t) => (
                  <Badge key={t} variant="secondary" className="rounded-full">
                    {t}
                  </Badge>
                ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
            <div>
              <div className="text-sm font-medium">Consentimento de contato</div>
              <div className="text-xs text-muted-foreground">Marque apenas se o tutor autorizou mensagens.</div>
            </div>
            <Switch checked={form.watch("contact_consent")} onCheckedChange={(v) => form.setValue("contact_consent", v)} />
          </div>

          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea className="rounded-2xl" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-2xl" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
