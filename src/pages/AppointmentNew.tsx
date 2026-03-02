import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { CatalogItem, Pet } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import TutorCombobox from "@/components/tutors/TutorCombobox";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";

const itemSchema = z.object({
  catalog_item_id: z.string().uuid("Selecione um item"),
  quantity: z.coerce.number().int().min(1, "Qtd. > 0"),
  pet_id: z.string().optional().nullable(),
  free_description: z.string().optional().nullable(),
  price_cents: z.coerce.number().int().optional().nullable(),
  brand: z.string().optional().nullable(),
  lot: z.string().optional().nullable(),
  expires_on: z.string().optional().nullable(),
});

const schema = z.object({
  tutor_id: z.string().uuid("Selecione um tutor"),
  scheduled_date: z.string().min(10, "Informe a data"),
  scheduled_time: z.string().min(4, "Informe o horário"),
  channel: z.enum(["store", "phone", "whatsapp", "other"]),
  notes: z.string().optional().nullable(),
  separate_by_pet: z.boolean().default(false),
  items: z.array(itemSchema).min(1, "Adicione ao menos 1 item"),
});

type Values = z.infer<typeof schema>;

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function AppointmentNew() {
  const nav = useNavigate();
  const tutorParam = useQueryParam("tutor");

  const [openNewTutor, setOpenNewTutor] = useState(false);

  const catalog = useQuery({
    queryKey: ["catalog", "active"],
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

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tutor_id: tutorParam ?? "",
      scheduled_date: dayjs().format("YYYY-MM-DD"),
      scheduled_time: "09:00",
      channel: "store",
      notes: "",
      separate_by_pet: false,
      items: [{ catalog_item_id: "", quantity: 1, pet_id: null, free_description: null }],
    },
  });

  useEffect(() => {
    if (tutorParam) form.setValue("tutor_id", tutorParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorParam]);

  const tutorId = form.watch("tutor_id");

  const pets = useQuery({
    queryKey: ["pets", "byTutor", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, org_id, tutor_id, name, species, age_text, birth_date, breed, color, notes, is_active")
        .eq("tutor_id", tutorId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pet[];
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      // valida requires_description no front
      const catalogMap = new Map((catalog.data ?? []).map((c) => [c.id, c] as const));
      for (const it of values.items) {
        const ci = catalogMap.get(it.catalog_item_id);
        if (ci?.requires_description && !it.free_description?.trim()) {
          throw new Error(`O item “${ci.name}” exige descrição.`);
        }
      }

      const { data, error } = await supabase.rpc("create_appointment_with_items", {
        payload: {
          tutor_id: values.tutor_id,
          scheduled_date: values.scheduled_date,
          scheduled_time: values.scheduled_time,
          channel: values.channel,
          notes: values.notes,
          items: values.items.map((it) => ({
            catalog_item_id: it.catalog_item_id,
            quantity: it.quantity,
            pet_id: values.separate_by_pet ? it.pet_id : null,
            free_description: it.free_description,
            price_cents: it.price_cents,
            brand: it.brand,
            lot: it.lot,
            expires_on: it.expires_on,
            metadata: {},
          })),
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Agendamento criado" });
      nav("/dashboard");
    },
    onError: (e: any) => {
      toast({ title: "Falha ao criar", description: e?.message, variant: "destructive" });
    },
  });

  const separateByPet = form.watch("separate_by_pet");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Novo agendamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie um pedido unificado no tutor ou separe itens por pet.</p>
        </div>
        <Button asChild variant="secondary" className="rounded-2xl">
          <Link to="/dashboard">Voltar</Link>
        </Button>
      </div>

      <form className="grid gap-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Card className="rounded-3xl p-4 sm:p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Tutor</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <TutorCombobox
                    value={form.watch("tutor_id")}
                    onChange={(id) => form.setValue("tutor_id", id, { shouldValidate: true })}
                    onCreateNew={() => setOpenNewTutor(true)}
                  />
                  {form.formState.errors.tutor_id && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.tutor_id.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" className="rounded-2xl" {...form.register("scheduled_date")} />
              </div>
              <div className="grid gap-2">
                <Label>Hora</Label>
                <Input type="time" className="rounded-2xl" {...form.register("scheduled_time")} />
              </div>
              <div className="grid gap-2">
                <Label>Canal</Label>
                <Select
                  value={form.watch("channel")}
                  onValueChange={(v) => form.setValue("channel", v as Values["channel"]) }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="store">Loja</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
              <div>
                <div className="text-sm font-medium">Separar por pets</div>
                <div className="text-xs text-muted-foreground">Se ligado, cada item pode ser vinculado a um pet.</div>
              </div>
              <Switch checked={separateByPet} onCheckedChange={(v) => form.setValue("separate_by_pet", v)} />
            </div>

            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea className="rounded-2xl" rows={3} {...form.register("notes")} />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Itens</div>
              <div className="mt-1 text-xs text-muted-foreground">Quantidade, pet (opcional), descrição quando necessário.</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => append({ catalog_item_id: "", quantity: 1, pet_id: null, free_description: null })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar item
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {fields.map((f, idx) => {
              const catId = form.watch(`items.${idx}.catalog_item_id`);
              const cat = (catalog.data ?? []).find((c) => c.id === catId);
              const needsDesc = !!cat?.requires_description;

              return (
                <div key={f.id} className="rounded-3xl border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                    <div className="grid gap-2 sm:col-span-5">
                      <Label>Item</Label>
                      <Select
                        value={catId || ""}
                        onValueChange={(v) => form.setValue(`items.${idx}.catalog_item_id`, v, { shouldValidate: true })}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {(catalog.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.items?.[idx]?.catalog_item_id && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.items?.[idx]?.catalog_item_id?.message as any}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 sm:col-span-2">
                      <Label>Qtd.</Label>
                      <Input
                        type="number"
                        min={1}
                        className="rounded-2xl"
                        {...form.register(`items.${idx}.quantity` as const)}
                      />
                    </div>

                    <div className="grid gap-2 sm:col-span-4">
                      <Label>Pet (opcional)</Label>
                      <Select
                        value={(form.watch(`items.${idx}.pet_id`) ?? "") || ""}
                        onValueChange={(v) =>
                          form.setValue(`items.${idx}.pet_id`, v === "_none" ? null : v, { shouldValidate: true })
                        }
                        disabled={!separateByPet || !tutorId}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder={separateByPet ? "Selecione…" : "Desligado"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="_none">Sem pet</SelectItem>
                          {(pets.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-2xl"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {needsDesc && (
                    <div className="mt-3 grid gap-2">
                      <Label>Descrição (obrigatória)</Label>
                      <Textarea
                        className="rounded-2xl"
                        rows={2}
                        placeholder="Ex: medicação X, dose Y, observações…"
                        {...form.register(`items.${idx}.free_description` as const)}
                      />
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Marca (opcional)</Label>
                      <Input className="rounded-2xl" {...form.register(`items.${idx}.brand` as const)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Lote (opcional)</Label>
                      <Input className="rounded-2xl" {...form.register(`items.${idx}.lot` as const)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Validade (opcional)</Label>
                      <Input type="date" className="rounded-2xl" {...form.register(`items.${idx}.expires_on` as const)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {form.formState.errors.items && typeof form.formState.errors.items.message === "string" && (
            <p className="mt-2 text-xs text-destructive">{form.formState.errors.items.message}</p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className="rounded-2xl" disabled={save.isPending}>
              {save.isPending ? "Criando…" : "Criar agendamento"}
            </Button>
          </div>
        </Card>
      </form>

      <TutorUpsertDialog
        open={openNewTutor}
        onOpenChange={setOpenNewTutor}
        initial={null}
        onSaved={(id) => {
          setOpenNewTutor(false);
          form.setValue("tutor_id", id, { shouldValidate: true });
        }}
      />
    </div>
  );
}
