import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { MessageTemplate, OrgSettings } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/vetvax/StatusBadge";
import {
  OPTION_PRESETS,
  REMINDER_KINDS,
  WHATS_VARIABLES,
  optionNameOf,
  optionsForKind,
  type ReminderKind,
} from "@/lib/whatsTemplates";

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeKind, setActiveKind] = useState<ReminderKind>("upcoming");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [whatsBody, setWhatsBody] = useState(REMINDER_KINDS.upcoming.fallback);
  const [showPresets, setShowPresets] = useState(false);

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

  const whatsTemplates = useQuery({
    queryKey: ["org", "whats-template", "all"],
    enabled: !!settings.data?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, org_id, name, channel, body, is_active, created_at, updated_at")
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
  });

  const options = optionsForKind(whatsTemplates.data, activeKind);
  const activeOption = options.find((o) => o.template.is_active) ?? null;
  const currentNumber = selectedNumber ?? activeOption?.number ?? options[0]?.number ?? 1;
  const currentOption = options.find((o) => o.number === currentNumber) ?? null;

  useEffect(() => {
    setWhatsBody(currentOption?.template.body ?? REMINDER_KINDS[activeKind].fallback);
  }, [currentOption?.template.id, currentOption?.template.body, activeKind, currentNumber]);

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

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`;
    const el = textareaRef.current;
    if (!el) {
      setWhatsBody((prev) => `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${token}`);
      return;
    }
    const start = el.selectionStart ?? whatsBody.length;
    const end = el.selectionEnd ?? whatsBody.length;
    const next = `${whatsBody.slice(0, start)}${token}${whatsBody.slice(end)}`;
    setWhatsBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const refreshTemplates = async () => {
    await qc.invalidateQueries({ queryKey: ["org", "whats-template"] });
  };

  const saveWhatsTemplate = useMutation({
    mutationFn: async () => {
      if (!settings.data?.org_id) throw new Error("Configuração da organização não encontrada.");
      const body = whatsBody.trim() || REMINDER_KINDS[activeKind].fallback;
      if (currentOption) {
        const { error } = await supabase.from("message_templates").update({ body }).eq("id", currentOption.template.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("message_templates").insert({
        org_id: settings.data.org_id,
        name: optionNameOf(activeKind, currentNumber),
        channel: "whatsapp",
        body,
        is_active: options.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: `Opção ${currentNumber} salva` });
      await refreshTemplates();
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao salvar mensagem", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  const useOption = useMutation({
    mutationFn: async () => {
      if (!currentOption) throw new Error("Salve a opção antes de usá-la.");
      const others = options.filter((o) => o.template.id !== currentOption.template.id && o.template.is_active);
      for (const o of others) {
        const { error } = await supabase.from("message_templates").update({ is_active: false }).eq("id", o.template.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("message_templates").update({ is_active: true }).eq("id", currentOption.template.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: `Opção ${currentNumber} agora é a mensagem "${REMINDER_KINDS[activeKind].label}"` });
      await refreshTemplates();
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao trocar a opção em uso", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  const createOption = useMutation({
    mutationFn: async (presetId: string) => {
      if (!settings.data?.org_id) throw new Error("Configuração da organização não encontrada.");
      const preset = OPTION_PRESETS.find((p) => p.id === presetId);
      if (!preset) throw new Error("Modelo inválido.");
      const nextNumber = Math.max(1, ...options.map((o) => o.number)) + 1;
      const { error } = await supabase.from("message_templates").insert({
        org_id: settings.data.org_id,
        name: optionNameOf(activeKind, nextNumber),
        channel: "whatsapp",
        body: preset.bodies[activeKind] || REMINDER_KINDS[activeKind].fallback,
        is_active: false,
      });
      if (error) throw error;
      return nextNumber;
    },
    onSuccess: async (nextNumber) => {
      setShowPresets(false);
      setSelectedNumber(nextNumber);
      toast({ title: `Opção ${nextNumber} criada`, description: "Edite se quiser e clique em Usar esta opção." });
      await refreshTemplates();
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao criar opção", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Configuração"
        title="Configurações"
        description="Defina os dados públicos da clínica e preferências do sistema."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-[96px]">
          <Card className="vetvax-card-polish rounded-[14px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/70 p-3 shadow-vetvax-card">
            {[
              { id: "organizacao", label: "Organização" },
              { id: "mensagens", label: "Mensagens WhatsApp" },
              { id: "futuras", label: "Preferências futuras" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="mb-1 flex h-10 w-full items-center rounded-[10px] px-3 text-left text-sm font-semibold text-vetvax-text-secondary transition-[background-color,color] duration-vetvax hover:bg-vetvax-surface-alt hover:text-vetvax-text-main"
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {item.label}
              </button>
            ))}
          </Card>
        </aside>

        <div className="space-y-5">
          <Card id="organizacao" className="vetvax-card-polish rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
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
                <Button type="submit" className="min-w-[160px]" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Card>

          <Card id="mensagens" className="vetvax-card-polish rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-vetvax-primary" />
              <h2 className="vetvax-section-title">Mensagem WhatsApp</h2>
            </div>
            <p className="mt-1 text-sm text-vetvax-text-tertiary">
              O sistema usa uma mensagem para lembretes a vencer e outra para vencidos. Cada uma pode ter várias opções: escolha qual delas fica em uso.
            </p>

            <div className="mt-4 inline-flex rounded-control border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-1">
              {(Object.keys(REMINDER_KINDS) as ReminderKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setActiveKind(kind);
                    setSelectedNumber(null);
                    setShowPresets(false);
                  }}
                  className={`rounded-[8px] px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    activeKind === kind
                      ? "bg-white text-vetvax-text-main shadow-sm"
                      : "text-vetvax-text-tertiary hover:text-vetvax-text-main"
                  }`}
                >
                  {REMINDER_KINDS[kind].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-vetvax-text-tertiary">{REMINDER_KINDS[activeKind].helper}</p>

            <div className="mt-4 grid gap-2">
              <Label className="vetvax-label">Opções de mensagem — escolha qual editar e qual usar</Label>
              <div className="flex flex-wrap items-center gap-2">
                {(options.length > 0 ? options.map((o) => o.number) : [1]).map((n) => {
                  const inUse = options.find((o) => o.number === n)?.template.is_active;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedNumber(n)}
                      className={`inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        currentNumber === n
                          ? "border-vetvax-primary bg-vetvax-primary-soft text-vetvax-primary"
                          : "border-vetvax-border-medium bg-white text-vetvax-text-secondary hover:bg-vetvax-surface-panel"
                      }`}
                    >
                      Opção {n}
                      {inUse ? <span className="rounded-pill bg-vetvax-success px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">em uso</span> : null}
                    </button>
                  );
                })}
                <Button type="button" variant="outline" className="h-9 rounded-pill px-3.5 text-sm" onClick={() => setShowPresets((v) => !v)}>
                  + Nova opção
                </Button>
              </div>

              {showPresets ? (
                <div className="grid gap-2 rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-3 sm:grid-cols-3">
                  {OPTION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={createOption.isPending}
                      onClick={() => createOption.mutate(preset.id)}
                      className="rounded-[12px] border border-vetvax-border-medium bg-white p-3 text-left transition-colors hover:border-vetvax-primary-border hover:bg-vetvax-primary-soft"
                    >
                      <p className="text-sm font-bold text-vetvax-text-main">{preset.label}</p>
                      <p className="mt-1 text-xs text-vetvax-text-tertiary">{preset.description}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-2">
                <Label className="vetvax-label">Variáveis (clique para inserir)</Label>
                <div className="flex flex-wrap gap-2">
                  {WHATS_VARIABLES.map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      className="h-8 rounded-pill px-3 text-xs"
                      title={variable.label}
                      onClick={() => insertVariable(variable.key)}
                    >
                      {`{{${variable.key}}}`}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-vetvax-text-tertiary">
                  Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~, ```fonte diferente``` e &gt; citação no início da linha.
                </p>
              </div>

              <div className="grid gap-2">
                <Label className="vetvax-label">
                  Editor — Opção {currentNumber} ({REMINDER_KINDS[activeKind].label})
                </Label>
                <Textarea
                  ref={textareaRef}
                  rows={10}
                  value={whatsBody}
                  onChange={(e) => setWhatsBody(e.target.value)}
                  placeholder="Digite a mensagem do WhatsApp..."
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={saveWhatsTemplate.isPending} onClick={() => saveWhatsTemplate.mutate()}>
                  {saveWhatsTemplate.isPending ? "Salvando..." : `Salvar texto da Opção ${currentNumber}`}
                </Button>
                {currentOption?.template.is_active ? (
                  <Button type="button" disabled>
                    Opção {currentNumber} em uso
                  </Button>
                ) : (
                  <Button type="button" disabled={!currentOption || useOption.isPending} onClick={() => useOption.mutate()}>
                    {useOption.isPending ? "Trocando..." : `Usar a Opção ${currentNumber}`}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card id="futuras" className="vetvax-card-polish rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
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