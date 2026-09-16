import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { CatalogItem, Pet } from "@/types/vetvax";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import TutorCombobox from "@/components/tutors/TutorCombobox";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import PageHeader from "@/components/layout/PageHeader";
import FormSection from "@/components/vetvax/FormSection";
import SummaryCard from "@/components/vetvax/SummaryCard";
import ActionButton from "@/components/vetvax/ActionButton";
import FutureRemindersField, { emptyFutureReminderRow, type FutureReminderRow } from "@/components/vetvax/FutureRemindersField";
import { dayjs } from "@/lib/datetime";

const schema = z.object({
  tutor_id: z.string().uuid("Selecione um tutor"),
  notes: z.string().optional().nullable(),
  separate_by_pet: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function ScheduleReturn() {
  const nav = useNavigate();
  const tutorParam = useQueryParam("tutor");

  const [openNewTutor, setOpenNewTutor] = useState(false);
  const [reminders, setReminders] = useState<FutureReminderRow[]>([emptyFutureReminderRow()]);

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
      notes: "",
      separate_by_pet: false,
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

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const validRows = reminders.filter((r) => r.catalog_item_id && r.due_date);
      if (validRows.length === 0) {
        throw new Error("Adicione ao menos um retorno com vacina e data.");
      }

      const { error } = await supabase.rpc("schedule_reminders", {
        payload: {
          tutor_id: values.tutor_id,
          reminders: validRows.map((r) => ({
            catalog_item_id: r.catalog_item_id,
            due_date: r.due_date,
            pet_id: values.separate_by_pet ? r.pet_id : null,
            notes: values.notes,
          })),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Retorno agendado" });
      nav("/reminders");
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao agendar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
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
        title="Agendar retorno"
        description="Marque a próxima visita sem registrar uma aplicação — vira um lembrete, sem duplicar dados quando a vacina realmente for aplicada."
        actions={
          <Button asChild variant="outline">
            <Link to="/reminders">Voltar</Link>
          </Button>
        }
      />

      <form className="vetvax-fade-in grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="space-y-5">
          <FormSection step="1" title="Tutor" description="Quem vai retornar.">
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

              <div className="flex items-center justify-between rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel to-vetvax-surface-alt px-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-vetvax-text-main">Vincular retornos aos pets</p>
                  <p className="vetvax-help-text">Ative quando precisar indicar exatamente qual pet vai retornar.</p>
                </div>
                <Switch checked={separateByPet} onCheckedChange={(v) => form.setValue("separate_by_pet", v)} />
              </div>
            </div>
          </FormSection>

          <FormSection
            step="2"
            title="Retornos"
            description="Cada retorno vira um lembrete — pode agendar quantos precisar, com vacinas diferentes."
          >
            <FutureRemindersField
              rows={reminders}
              onChange={setReminders}
              baseDate={dayjs().format("YYYY-MM-DD")}
              catalog={catalog.data ?? []}
              pets={pets.data ?? []}
              showPetSelect={separateByPet}
            />
          </FormSection>

          <FormSection step="3" title="Observações">
            <Textarea rows={4} className="min-h-[100px]" placeholder="Ex: cliente confirmou por telefone..." {...form.register("notes")} />
          </FormSection>
        </div>

        <SummaryCard
          sticky
          title="Resumo"
          footer={
            <>
              <ActionButton type="submit" emphasis="primary" className="h-11 w-full" disabled={save.isPending}>
                {save.isPending ? "Agendando..." : "Agendar retorno"}
              </ActionButton>
              <ActionButton asChild type="button" emphasis="secondary" className="w-full">
                <Link to="/reminders">Voltar</Link>
              </ActionButton>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-vetvax-border-soft pb-2">
              <span className="text-vetvax-text-tertiary">Tutor</span>
              <span className="max-w-[180px] truncate font-semibold text-vetvax-text-main">{selectedTutor.data ?? "Não selecionado"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-vetvax-text-tertiary">Retornos</span>
              <span className="font-semibold text-vetvax-text-main">
                {reminders.filter((r) => r.catalog_item_id && r.due_date).length}
              </span>
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
