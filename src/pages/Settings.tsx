import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { OrgSettings } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  store_name: z.string().min(2, "Informe o nome"),
  store_phone: z.string().optional(),
  store_address: z.string().optional(),
  timezone: z.string().default("America/Sao_Paulo"),
});

type Values = z.infer<typeof schema>;

export default function Settings() {
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["org", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_settings")
        .select("id, org_id, store_name, store_phone, store_address, timezone, branding")
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as OrgSettings | null;
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      store_name: settings.data?.store_name ?? "VetVAX",
      store_phone: settings.data?.store_phone ?? "",
      store_address: settings.data?.store_address ?? "",
      timezone: settings.data?.timezone ?? "America/Sao_Paulo",
    },
  });

  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (!settings.data?.id) throw new Error("Configuração não encontrada (faça onboarding)");
      const { error } = await supabase
        .from("org_settings")
        .update({
          store_name: values.store_name,
          store_phone: values.store_phone || null,
          store_address: values.store_address || null,
          timezone: values.timezone,
        })
        .eq("id", settings.data.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Configurações salvas" });
      await qc.invalidateQueries({ queryKey: ["org", "settings"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao salvar", description: e?.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <SettingsIcon className="h-3.5 w-3.5" />
          Configurações
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Organização</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nome, telefone e timezone padrão do VetVAX (multi-tenant).</p>
      </div>

      <Card className="rounded-3xl p-4 sm:p-6">
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome da loja</Label>
            <Input className="rounded-2xl" {...form.register("store_name")} />
            {form.formState.errors.store_name && (
              <p className="text-xs text-destructive">{form.formState.errors.store_name.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Telefone da loja</Label>
              <Input className="rounded-2xl" placeholder="+5511999999999" {...form.register("store_phone")} />
            </div>
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <Input className="rounded-2xl" {...form.register("timezone")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Endereço (texto)</Label>
            <Textarea className="rounded-2xl" rows={3} {...form.register("store_address")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className="rounded-2xl" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
