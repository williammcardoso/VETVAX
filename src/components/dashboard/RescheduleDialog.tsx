import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  scheduled_date: z.string().min(10, "Informe a data"),
  scheduled_time: z.string().min(4, "Informe o horário"),
});

type Values = z.infer<typeof schema>;

export default function RescheduleDialog({
  open,
  appointmentId,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  appointmentId: string | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduled_date: dayjs().add(1, "day").format("YYYY-MM-DD"),
      scheduled_time: "09:00",
    },
  });

  const duplicate = useMutation({
    mutationFn: async (values: Values) => {
      if (!appointmentId) throw new Error("Agendamento inválido");

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .select("id, tutor_id, branch_id, channel, notes")
        .eq("id", appointmentId)
        .maybeSingle();
      if (apptErr) throw apptErr;
      if (!appt) throw new Error("Agendamento não encontrado");

      const { data: items, error: itemsErr } = await supabase
        .from("appointment_items")
        .select(
          "catalog_item_id, pet_id, quantity, free_description, price_cents, brand, lot, expires_on, metadata",
        )
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: true });
      if (itemsErr) throw itemsErr;

      const { data, error } = await supabase.rpc("create_appointment_with_items", {
        payload: {
          tutor_id: appt.tutor_id,
          branch_id: appt.branch_id,
          scheduled_date: values.scheduled_date,
          scheduled_time: values.scheduled_time,
          channel: appt.channel,
          notes: appt.notes,
          items: (items ?? []).map((it) => ({
            catalog_item_id: it.catalog_item_id,
            pet_id: it.pet_id,
            quantity: it.quantity,
            free_description: it.free_description,
            price_cents: it.price_cents,
            brand: it.brand,
            lot: it.lot,
            expires_on: it.expires_on,
            metadata: it.metadata,
          })),
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Reagendado", description: "Criamos um novo agendamento duplicado." });
      onChanged();
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao reagendar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-muted">
              <RotateCcw className="h-5 w-5" />
            </span>
            Reagendar (duplicar)
          </DialogTitle>
        </DialogHeader>

        <form className="mt-2 space-y-4" onSubmit={form.handleSubmit((v) => duplicate.mutate(v))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nova data</Label>
              <Input type="date" className="rounded-2xl" {...form.register("scheduled_date")} />
            </div>
            <div className="space-y-2">
              <Label>Novo horário</Label>
              <Input type="time" className="rounded-2xl" {...form.register("scheduled_time")} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="rounded-2xl" disabled={duplicate.isPending}>
              {duplicate.isPending ? "Duplicando…" : "Criar novo agendamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
