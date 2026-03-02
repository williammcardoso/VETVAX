import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Syringe } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { dayjs } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const schema = z.object({
  status_result: z.enum(["APLICADO", "CANCELADO"]),
  checkout_date: z.string().min(10, "Informe a data"),
  notes: z.string().optional(),
  next_due_date: z.string().optional(),
  next_due_pet_id: z.string().optional(),
  create_item_reminders: z.boolean().default(false),
});

type Values = z.infer<typeof schema>;

export default function CheckoutDialog({
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
      status_result: "APLICADO",
      checkout_date: dayjs().format("YYYY-MM-DD"),
      notes: "",
      next_due_date: "",
      next_due_pet_id: "",
      create_item_reminders: false,
    },
  });

  const checkout = useMutation({
    mutationFn: async (values: Values) => {
      if (!appointmentId) throw new Error("Agendamento inválido");
      const { data, error } = await supabase.rpc("checkout_appointment", {
        payload: {
          appointment_id: appointmentId,
          status_result: values.status_result,
          checkout_date: values.checkout_date,
          notes: values.notes,
          next_due_date: values.next_due_date || null,
          next_due_pet_id: values.next_due_pet_id || null,
          create_item_reminders: values.create_item_reminders,
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Baixa registrada" });
      onChanged();
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao dar baixa",
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
              <Syringe className="h-5 w-5" />
            </span>
            Dar baixa
          </DialogTitle>
        </DialogHeader>

        <form className="mt-2 space-y-4" onSubmit={form.handleSubmit((v) => checkout.mutate(v))}>
          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup
              value={form.watch("status_result")}
              onValueChange={(v) => form.setValue("status_result", v as Values["status_result"], { shouldValidate: true })}
              className="grid grid-cols-2 gap-2"
            >
              <Label className="flex cursor-pointer items-center gap-2 rounded-2xl border bg-background px-3 py-2">
                <RadioGroupItem value="APLICADO" />
                Aplicado
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-2xl border bg-background px-3 py-2">
                <RadioGroupItem value="CANCELADO" />
                Cancelado
              </Label>
            </RadioGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data da baixa</Label>
              <Input type="date" className="rounded-2xl" {...form.register("checkout_date")} />
            </div>
            <div className="space-y-2">
              <Label>Próxima aplicação (opcional)</Label>
              <Input type="date" className="rounded-2xl" {...form.register("next_due_date")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
            <div>
              <div className="text-sm font-medium">Criar lembrete para cada item</div>
              <div className="text-xs text-muted-foreground">
                Mais fiel: cria lembretes separados por item/pet (quando existir).
              </div>
            </div>
            <Switch
              checked={form.watch("create_item_reminders")}
              onCheckedChange={(v) => form.setValue("create_item_reminders", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea className="rounded-2xl" rows={3} {...form.register("notes")} />
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
            <Button type="submit" className="rounded-2xl" disabled={checkout.isPending}>
              {checkout.isPending ? "Salvando…" : "Confirmar baixa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
