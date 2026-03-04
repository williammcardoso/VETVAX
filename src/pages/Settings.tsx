import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Settings as SettingsIcon } from "lucide-react";
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

function randomToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

  const savePublicAgendaToken = useMutation({
    mutationFn: async (token: string) => {
      if (!settings.data?.id) throw new Error("Configuração não encontrada (faça onboarding)");

      const prevBranding = (settings.data as any)?.branding ?? {};
      const nextBranding = { ...prevBranding, public_agenda_token: token };

      const { error } = await supabase
        .from("org_settings")
        .update({ branding: nextBranding })
        .eq("id", settings.data.id);
      if (error) throw error;
      return token;
    },
    onSuccess: async () => {
      toast({ title: "Token da agenda pública salvo" });
      await qc.invalidateQueries({ queryKey: ["org", "settings"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao salvar token", description: e?.message, variant: "destructive" });
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

  const publicAgendaToken = ((settings.data as any)?.branding?.public_agenda_token ?? "") as string;
  const publicAgendaUrl = publicAgendaToken
    ? `${window.location.origin}/agenda-publica?token=${encodeURIComponent(publicAgendaToken)}`
    : "";

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

      <Card className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-6">
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome da loja</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("store_name")} />
            {form.formState.errors.store_name && (
              <p className="text-xs text-destructive">{form.formState.errors.store_name.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Telefone da loja</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="(11) 99999-9999" {...form.register("store_phone")} />
            </div>
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" {...form.register("timezone")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Endereço (texto)</Label>
            <Textarea className="rounded-[10px] border-[1.5px]" rows={3} {...form.register("store_address")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className="h-10 rounded-[10px]" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              Agenda pública
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Link de visualização</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gere um token para compartilhar a agenda sem login. Quem tiver o link consegue ver os próximos horários.
            </p>
          </div>
          <Button
            variant="secondary"
            className="h-10 rounded-[10px]"
            onClick={() => {
              const t = randomToken(24);
              savePublicAgendaToken.mutate(t);
            }}
            disabled={savePublicAgendaToken.isPending}
          >
            Gerar token
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <Label>Token</Label>
            <div className="flex gap-2">
              <Input
                className="h-10 rounded-[10px] border-[1.5px] font-mono text-xs"
                value={publicAgendaToken}
                readOnly
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-[10px]"
                disabled={!publicAgendaToken}
                onClick={() => copy(publicAgendaToken)}
                title="Copiar token"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Link</Label>
            <div className="flex gap-2">
              <Input className="h-10 rounded-[10px] border-[1.5px]" value={publicAgendaUrl} readOnly />
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-[10px]"
                disabled={!publicAgendaUrl}
                onClick={() => copy(publicAgendaUrl)}
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}