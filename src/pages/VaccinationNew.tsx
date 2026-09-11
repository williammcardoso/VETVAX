import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { CatalogItem, Pet } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import TutorCombobox from "@/components/tutors/TutorCombobox";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import FormSection from "@/components/vetvax/FormSection";
import SummaryCard from "@/components/vetvax/SummaryCard";
import ActionButton from "@/components/vetvax/ActionButton";

const itemSchema = z.object({
  catalog_item_id: z.string().uuid("Selecione um item"),
  quantity: z.coerce.number().int().min(1, "Qtd. > 0"),
  pet_id: z.string().optional().nullable(),
  free_description: z.string().optional().nullable(),
});

const schema = z.object({
  tutor_id: z.string().uuid("Selecione um tutor"),
  applied_date: z.string().min(10, "Informe a data"),
  notes: z.string().optional().nullable(),
  separate_by_pet: z.boolean().default(false),
  items: z.array(itemSchema).min(1, "Adicione ao menos 1 item"),
  next_due_date: z.string().optional().nullable(),
  create_item_reminders: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function VaccinationNew() {
  const nav = useNavigate();
  const tutorParam = useQueryParam("tutor");
  const resolveReminderParam = useQueryParam("resolveReminder");

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
      applied_date: dayjs().format("YYYY-MM-DD"),
      notes: "",
      separate_by_pet: false,
      items: [{ catalog_item_id: "", quantity: 1, pet_id: null, free_description: null }],
      next_due_date: "",
      create_item_reminders: false,
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
      const catalogMap = new Map((catalog.data ?? []).map((c) => [c.id, c] as const));
      for (const it of values.items) {
        const ci = catalogMap.get(it.catalog_item_id);
        if (ci?.requires_description && !it.free_description?.trim()) {
          throw new Error(`O item “${ci.name}” exige descrição.`);
        }
      }

      const { data, error } = await supabase.rpc("register_vaccination", {
        payload: {
          tutor_id: values.tutor_id,
          applied_date: values.applied_date,
          notes: values.notes,
          next_due_date: values.next_due_date || null,
          create_item_reminders: values.create_item_reminders,
          reference_reminder_id: resolveReminderParam || null,
          items: values.items.map((it) => ({
            catalog_item_id: it.catalog_item_id,
            quantity: it.quantity,
            pet_id: values.separate_by_pet ? it.pet_id : null,
            free_description: it.free_description,
            metadata: {},
          })),
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Aplicação registrada" });
      nav("/dashboard");
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao registrar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    },
  });

  const separateByPet = form.watch("separate_by_pet");
  const selectedTutor = useQuery({
    queryKey: ["tutor", "summary", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tutors").select("name").eq("id", tutorId).maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
  });

  return (
    <div className="space-y-7">
      <PageHeader
        title="Registrar aplicação"
        description="Cadastre a vacina aplicada agora. O sistema cuida do lembrete da próxima dose."
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        }
      />

      <form className="vetvax-fade-in grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="space-y-5">
          <FormSection step="1" title="Tutor e data" description="Defina o tutor e a data em que a aplicação aconteceu.">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="vetvax-label">Tutor</Label>
                <TutorCombobox
                  value={form.watch("tutor_id")}
                  onChange={(id) => form.setValue("tutor_id", id, { shouldValidate: true })}
                  onCreateNew={() => setOpenNewTutor(true)}
                />
                {form.formState.errors.tutor_id && <p className="text-xs text-destructive">{form.formState.errors.tutor_id.message}</p>}
              </div>

              <div className="grid gap-2 sm:w-[240px]">
                <Label className="vetvax-label">Data da aplicação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-left font-medium", !form.watch("applied_date") && "text-vetvax-text-tertiary")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("applied_date") ? dayjs(form.watch("applied_date")).format("DD/MM/YYYY") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-control p-3" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("applied_date") ? new Date(form.watch("applied_date") + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        form.setValue("applied_date", dayjs(d).format("YYYY-MM-DD"), { shouldValidate: true });
                      }}
                      initialFocus
                      className="rounded-control"
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.applied_date && <p className="text-xs text-destructive">{form.formState.errors.applied_date.message}</p>}
              </div>

              <div className="flex items-center justify-between rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel to-vetvax-surface-alt px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-vetvax-text-main">Vincular itens aos pets</p>
                  <p className="vetvax-help-text">Ative quando precisar indicar exatamente qual pet recebeu cada item.</p>
                </div>
                <Switch checked={separateByPet} onCheckedChange={(v) => form.setValue("separate_by_pet", v)} />
              </div>
            </div>
          </FormSection>

          <FormSection
            step="2"
            title="Itens aplicados"
            description="Adicione as vacinas, medicações e itens aplicados."
            actions={
              <ActionButton
                type="button"
                emphasis="secondary"
                onClick={() => append({ catalog_item_id: "", quantity: 1, pet_id: null, free_description: null })}
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </ActionButton>
            }
          >
            <div className="space-y-3">
              {fields.map((f, idx) => {
                const catId = form.watch(`items.${idx}.catalog_item_id`);
                const cat = (catalog.data ?? []).find((c) => c.id === catId);
                const needsDesc = !!cat?.requires_description;

                return (
                  <div key={f.id} className="rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/80 p-4 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                      <div className="grid gap-2 sm:col-span-5">
                        <Label className="vetvax-label">Item</Label>
                        <Select value={catId || ""} onValueChange={(v) => form.setValue(`items.${idx}.catalog_item_id`, v, { shouldValidate: true })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-control">
                            {(catalog.data ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2 sm:col-span-2">
                        <Label className="vetvax-label">Qtd.</Label>
                        <Input type="number" min={1} {...form.register(`items.${idx}.quantity` as const)} />
                      </div>

                      <div className="grid gap-2 sm:col-span-4">
                        <Label className="vetvax-label">Pet (opcional)</Label>
                        <Select
                          value={(form.watch(`items.${idx}.pet_id`) ?? "") || ""}
                          onValueChange={(v) => form.setValue(`items.${idx}.pet_id`, v === "_none" ? null : v, { shouldValidate: true })}
                          disabled={!separateByPet || !tutorId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={separateByPet ? "Selecione..." : "Desligado"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-control">
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
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {needsDesc ? (
                      <div className="mt-3 grid gap-2">
                        <Label className="vetvax-label">Descrição (obrigatória)</Label>
                        <Textarea rows={2} placeholder="Ex: dose e observações do item..." {...form.register(`items.${idx}.free_description` as const)} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </FormSection>

          <FormSection step="3" title="Próxima aplicação" description="Opcional: já deixe agendado o lembrete da próxima dose.">
            <div className="grid gap-4">
              <div className="grid gap-2 sm:w-[240px]">
                <Label className="vetvax-label">Data prevista (opcional)</Label>
                <Input type="date" {...form.register("next_due_date")} />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "15 dias", days: 15 },
                    { label: "21 dias", days: 21 },
                    { label: "28 dias", days: 28 },
                    { label: "Anual (365 dias)", days: 365 },
                  ].map((opt) => (
                    <Button
                      key={opt.days}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-pill px-2.5 text-xs"
                      onClick={() => {
                        const base = form.watch("applied_date") || dayjs().format("YYYY-MM-DD");
                        form.setValue("next_due_date", dayjs(base).add(opt.days, "day").format("YYYY-MM-DD"), { shouldValidate: true });
                      }}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel to-vetvax-surface-alt px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-vetvax-text-main">Criar lembrete para cada item</p>
                  <p className="vetvax-help-text">Mais fiel: cria lembretes separados por item/pet quando existir.</p>
                </div>
                <Switch
                  checked={form.watch("create_item_reminders")}
                  onCheckedChange={(v) => form.setValue("create_item_reminders", v)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection step="4" title="Observações">
            <Textarea rows={5} className="min-h-[120px]" placeholder="Informações importantes para a equipe..." {...form.register("notes")} />
          </FormSection>
        </div>

        <SummaryCard
          sticky
          title="Resumo"
          footer={
            <>
              <ActionButton type="submit" emphasis="primary" className="h-11 w-full" disabled={save.isPending}>
                {save.isPending ? "Registrando..." : "Registrar aplicação"}
              </ActionButton>
              <ActionButton asChild type="button" emphasis="secondary" className="w-full">
                <Link to="/dashboard">Voltar</Link>
              </ActionButton>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-vetvax-border-soft pb-2">
              <span className="text-vetvax-text-tertiary">Tutor</span>
              <span className="max-w-[180px] truncate font-semibold text-vetvax-text-main">{selectedTutor.data ?? "Não selecionado"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-vetvax-border-soft pb-2">
              <span className="text-vetvax-text-tertiary">Data</span>
              <span className="font-semibold text-vetvax-text-main">
                {form.watch("applied_date") ? dayjs(form.watch("applied_date")).format("DD/MM/YYYY") : "--"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-vetvax-text-tertiary">Itens</span>
              <span className="font-semibold text-vetvax-text-main">{fields.length}</span>
            </div>
          </div>
        </SummaryCard>
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
