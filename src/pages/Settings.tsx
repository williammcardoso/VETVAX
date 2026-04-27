import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, Settings as SettingsIcon } from "lucide-react";
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
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/vetvax/StatusBadge";

const schema = z.object({
  store_name: z.string().min(2, "Informe o nome"),
  store_phone: z.string().optional(),
  store_address: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

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
        })
        .eq("id", settings.data.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Configurações salvas" });
      await qc.invalidateQueries({ queryKey: ["org", "settings"] });
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao salvar", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const publicAgendaUrl = `${window.location.origin}/agenda-publica`;

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Configuração"
        title="Configurações"
        description="Defina os dados públicos da clínica e preferências do sistema."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-[96px]">
          <Card className="rounded-card-md border border-vetvax-border-soft bg-white p-3 shadow-vetvax-card">
            {[
              { id: "organizacao", label: "Organização" },
              { id: "agenda", label: "Agenda pública" },
              { id: "futuras", label: "Preferências futuras" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="mb-1 flex h-10 w-full items-center rounded-control px-3 text-left text-sm font-semibold text-vetvax-text-secondary hover:bg-vetvax-surface-alt hover:text-vetvax-text-main"
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {item.label}
              </button>
            ))}
          </Card>
        </aside>

        <div className="space-y-5">
          <Card id="organizacao" className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
            <h2 className="vetvax-section-title">Organização</h2>
            <p className="mt-1 text-sm text-vetvax-text-tertiary">Dados institucionais exibidos nos fluxos da agenda.</p>

            <form className="mt-4 grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
              <div className="grid gap-2">
                <Label className="vetvax-label">Nome da loja</Label>
                <Input {...form.register("store_name")} />
                {form.formState.errors.store_name ? <p className="text-xs text-destructive">{form.formState.errors.store_name.message}</p> : null}
              </div>

              <div className="grid gap-2 sm:max-w-md">
                <Label className="vetvax-label">Telefone da clínica</Label>
                <Input placeholder="(11) 99999-9999" {...form.register("store_phone")} />
              </div>

              <div className="grid gap-2">
                <Label className="vetvax-label">Endereço</Label>
                <Textarea rows={3} {...form.register("store_address")} />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Card>

          <Card id="agenda" className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-vetvax-primary" />
              <h2 className="vetvax-section-title">Agenda pública</h2>
            </div>
            <p className="mt-1 text-sm text-vetvax-text-tertiary">Link público para compartilhamento de horários com clientes.</p>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label className="vetvax-label">Link</Label>
                <div className="flex gap-2">
                  <Input value={publicAgendaUrl} readOnly />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(publicAgendaUrl)} title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-card-md border border-vetvax-primary-border bg-[#f0fdfa] p-3">
                <p className="text-xs font-bold text-vetvax-primary">Pré-visualização</p>
                <p className="mt-1 text-sm text-vetvax-text-main">VetVAX - Agenda vacinal pública</p>
                <p className="text-xs text-vetvax-text-tertiary">{publicAgendaUrl}</p>
              </div>
            </div>
          </Card>

          <Card id="futuras" className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-vetvax-primary" />
              <h2 className="vetvax-section-title">Preferências futuras</h2>
            </div>
            <p className="mt-2 text-sm text-vetvax-text-tertiary">
              Espaço reservado para regras de lembrete automático, horários de atendimento e personalização da mensagem.
            </p>
            <div className="mt-3">
              <StatusBadge>Em breve</StatusBadge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}