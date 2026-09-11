import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Tutor } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

function maskPhoneBR(value: string) {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  if (rest.length <= 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

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
  const { profile, user } = useAuth();

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
      city: initial?.city ?? "Itapira",
      uf: initial?.uf ?? "SP",
      notes: initial?.notes ?? "",
      tagsText: initial?.tags?.join(", ") ?? "",
      contact_consent: initial?.contact_consent ?? true,
    },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (!profile?.org_id) throw new Error("Sem organização no perfil (faça onboarding)");

      const payload = {
        org_id: profile.org_id,
        branch_id: profile.branch_id,
        created_by: user?.id ?? null,

        name: values.name,
        // Salva apenas números no banco
        phone1: values.phone1 ? (values.phone1 ?? "").replace(/\D/g, "") : null,
        phone2: values.phone2 ? (values.phone2 ?? "").replace(/\D/g, "") : null,
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
        const { org_id, created_by, ...updatePayload } = payload;
        const { data, error } = await supabase
          .from("tutors")
          .update(updatePayload)
          .eq("id", initial.id)
          .select("id")
          .single();
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
    onError: (e: unknown) => {
      toast({
        title: "Falha ao salvar tutor",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar tutor" : "Novo tutor"}</DialogTitle>
        </DialogHeader>

        <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: Maria Silva" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Telefone 1</Label>
              <Input
                className="h-10 rounded-[10px] border-[1.5px]"
                placeholder="(00) 00000-0000"
                inputMode="tel"
                value={maskPhoneBR(form.watch("phone1") ?? "")}
                onChange={(e) => form.setValue("phone1", maskPhoneBR(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Telefone 2</Label>
              <Input
                className="h-10 rounded-[10px] border-[1.5px]"
                placeholder="(00) 00000-0000"
                inputMode="tel"
                value={maskPhoneBR(form.watch("phone2") ?? "")}
                onChange={(e) => form.setValue("phone2", maskPhoneBR(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-6">
            <div className="grid gap-2 sm:col-span-3">
              <Label>Rua</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("street")} />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label>Nº</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("number")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Complemento</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("complement")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Bairro</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("neighborhood")} />
            </div>
            <div className="grid gap-2 sm:col-span-3">
              <Label>Cidade</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("city")} />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label>UF</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" maxLength={2} {...form.register("uf")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Marcadores internos</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: cliente antigo, vip" {...form.register("tagsText")} />
            <p className="text-xs text-muted-foreground">Opcional. Separe por vírgula para facilitar buscas futuras.</p>
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

          <div className="flex items-center justify-between rounded-[10px] border-[1.5px] border-border bg-muted/20 px-3 py-3">
            <div>
              <div className="text-sm font-medium">Consentimento de contato</div>
              <div className="text-xs text-muted-foreground">Marque apenas se o tutor autorizou mensagens.</div>
            </div>
            <Switch checked={form.watch("contact_consent")} onCheckedChange={(v) => form.setValue("contact_consent", v)} />
          </div>

          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea className="rounded-[10px] border-[1.5px]" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="rounded-[10px]" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-[10px]" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}