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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  price_cents: z.coerce.number().int().optional().nullable(),
  brand: z.string().optional().nullable(),
  lot: z.string().optional().nullable(),
  expires_on: z.string().optional().nullable(),
});

const schema = z.object({
  tutor_id: z.string().uuid("Selecione um tutor"),
  scheduled_date: z.string().min(10, "Informe a data"),
  scheduled_time: z.string().min(4, "Informe o horário"),
  notes: z.string().optional().nullable(),
  separate_by_pet: z.boolean().default(false),
  items: z.array(itemSchema).min(1, "Adicione ao menos 1 item"),
});

type Values = z.infer<typeof schema>;
type BusyTimeRow = { scheduled_time: string };

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

function buildTimeSlots() {
  const slots: string[] = [];
  for (let h = 8; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m > 0) continue;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export default function AppointmentNew() {
  const nav = useNavigate();
  const tutorParam = useQueryParam("tutor");
  const dateParam = useQueryParam("date");
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
      scheduled_date: dateParam ?? dayjs().format("YYYY-MM-DD"),
      scheduled_time: "09:00",
      notes: "",
      separate_by_pet: false,
      items: [{ catalog_item_id: "", quantity: 1, pet_id: null, free_description: null }],
    },
  });

  useEffect(() => {
    if (tutorParam) form.setValue("tutor_id", tutorParam);
    if (dateParam) form.setValue("scheduled_date", dateParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorParam, dateParam]);

  const tutorId = form.watch("tutor_id");
  const scheduledDate = form.watch("scheduled_date");

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

  const busyTimes = useQuery({
    queryKey: ["appointments", "busyTimes", scheduledDate],
    enabled: !!scheduledDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_time")
        .eq("scheduled_date", scheduledDate)
        .eq("status", "PENDENTE")
        .eq("is_active", true);
      if (error) throw error;
      return new Set(((data ?? []) as BusyTimeRow[]).map((r) => String(r.scheduled_time).slice(0, 5)));
    },
  });

  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const selectedTimeBusy = (busyTimes.data?.has(form.watch("scheduled_time")) ?? false) && !!form.watch("scheduled_time");

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

      const { data, error } = await supabase.rpc("create_appointment_with_items", {
        payload: {
          tutor_id: values.tutor_id,
          scheduled_date: values.scheduled_date,
          scheduled_time: values.scheduled_time,
          channel: "store",
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
    onSuccess: async () => {
      if (resolveReminderParam) {
        await supabase.from("reminders").update({ status: "FEITO" }).eq("id", resolveReminderParam);
      }
      toast({ title: "Agendamento criado" });
      nav("/dashboard");
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao criar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
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
    <div className="space-y-6">
      <PageHeader
        title="Novo agendamento"
        description="Selecione tutor, horário e itens do atendimento."
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        }
      />

      <form className="grid gap-6 lg:grid-cols-[2fr_320px]" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="space-y-5">
          <FormSection
            step="1"
            title="Tutor e horário"
            description="Defina o tutor, a data e o horário do atendimento."
          >
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="vetvax-label">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("w-full justify-start text-left font-medium", !scheduledDate && "text-vetvax-text-tertiary")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? dayjs(scheduledDate).format("DD/MM/YYYY") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto rounded-control p-3" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate ? new Date(scheduledDate + "T00:00:00") : undefined}
                        onSelect={(d) => {
                          if (!d) return;
                          form.setValue("scheduled_date", dayjs(d).format("YYYY-MM-DD"), { shouldValidate: true });
                        }}
                        initialFocus
                        className="rounded-control"
                      />
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.scheduled_date && <p className="text-xs text-destructive">{form.formState.errors.scheduled_date.message}</p>}
                </div>

                <div className="grid gap-2">
                  <Label className="vetvax-label">Hora</Label>
                  <div className="space-y-2">
                    <Select value={form.watch("scheduled_time")} onValueChange={(v) => form.setValue("scheduled_time", v, { shouldValidate: true })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar horário" />
                      </SelectTrigger>
                      <SelectContent className="rounded-control">
                        {timeSlots.map((t) => {
                          const busy = busyTimes.data?.has(t) ?? false;
                          return (
                            <SelectItem key={t} value={t} disabled={busy}>
                              <div className="flex w-full items-center justify-between gap-3">
                                <span>{t}</span>
                                {busy ? <span className="text-xs text-vetvax-text-tertiary">ocupado</span> : null}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedTimeBusy ? (
                      <Badge className="w-fit border-transparent bg-vetvax-warning-soft text-vetvax-warning">Horário ocupado</Badge>
                    ) : null}
                  </div>
                  {form.formState.errors.scheduled_time && <p className="text-xs text-destructive">{form.formState.errors.scheduled_time.message}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-card-md border border-vetvax-border-soft bg-vetvax-surface-alt px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-vetvax-text-main">Vincular itens aos pets</p>
                  <p className="vetvax-help-text">Ative quando precisar indicar exatamente qual pet receberá cada item.</p>
                </div>
                <Switch checked={separateByPet} onCheckedChange={(v) => form.setValue("separate_by_pet", v)} />
              </div>
            </div>
          </FormSection>

          <FormSection
            step="2"
            title="Itens do atendimento"
            description="Adicione vacinas, medicações e itens aplicados no atendimento."
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
                  <div key={f.id} className="rounded-card-md border border-vetvax-border-soft bg-vetvax-surface-alt p-4">
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

          <FormSection step="3" title="Observações">
            <Textarea rows={5} className="min-h-[120px]" placeholder="Informações importantes para a equipe..." {...form.register("notes")} />
          </FormSection>
        </div>

        <SummaryCard
          sticky
          title="Resumo"
          footer={
            <>
              <ActionButton type="submit" emphasis="primary" className="h-11 w-full" disabled={save.isPending}>
                {save.isPending ? "Criando..." : "Criar agendamento"}
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
              <span className="text-vetvax-text-tertiary">Data e hora</span>
              <span className="font-semibold text-vetvax-text-main">
                {form.watch("scheduled_date") ? dayjs(form.watch("scheduled_date")).format("DD/MM/YYYY") : "--"} {form.watch("scheduled_time") || ""}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-vetvax-border-soft pb-2">
              <span className="text-vetvax-text-tertiary">Itens</span>
              <span className="font-semibold text-vetvax-text-main">{fields.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-vetvax-text-tertiary">Valor</span>
              <span className="font-semibold text-vetvax-text-main">Em breve</span>
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