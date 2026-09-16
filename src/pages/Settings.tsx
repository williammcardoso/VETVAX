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

type ReminderKind = "upcoming" | "overdue";

const REMINDER_TEMPLATES: Record<ReminderKind, { name: string; label: string; fallback: string; helper: string }> = {
  upcoming: {
    name: "Lembrete - padrão",
    label: "A vencer",
    fallback:
      "🐾 Olá, {{tutor_name}}! Aqui é da {{store_name}}.\nPassando para lembrar que a vacina de {{pet_name}} está prevista para {{due_date}}. Quer já deixar agendado? Responda aqui com o melhor dia! 📅",
    helper: "Enviada para lembretes que ainda não venceram — tom tranquilo, sem pressa.",
  },
  overdue: {
    name: "Lembrete - vencida",
    label: "Vencida",
    fallback:
      "⚠️ Olá, {{tutor_name}}! Aqui é da {{store_name}}.\nA vacina de {{pet_name}} está *atrasada* desde {{due_date}}. Vacina em atraso deixa o pet mais exposto a doenças sérias, e alguns protocolos precisam reiniciar a série se o atraso for grande. 🐾💉\nPra resolver rápido, responda aqui com o melhor dia *esta semana* que já deixamos reservado pra você.",
    helper: "Enviada para lembretes já vencidos — mais direta, com urgência e um pedido de resposta claro.",
  },
};

const WHATS_VARIABLES = [
  { key: "tutor_name", label: "Nome do tutor" },
  { key: "store_name", label: "Nome da clínica" },
  { key: "due_date", label: "Data do lembrete" },
  { key: "pet_name", label: "Nome do pet" },
] as const;

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
  const [whatsBody, setWhatsBody] = useState(REMINDER_TEMPLATES.upcoming.fallback);

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

  const whatsTemplate = useQuery({
    queryKey: ["org", "whats-template", activeKind],
    enabled: !!settings.data?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, org_id, name, channel, body, is_active, created_at, updated_at")
        .eq("channel", "whatsapp")
        .eq("name", REMINDER_TEMPLATES[activeKind].name)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as MessageTemplate | null;
    },
  });

  useEffect(() => {
    if (whatsTemplate.data?.body) {
      setWhatsBody(whatsTemplate.data.body);
      return;
    }
    setWhatsBody(REMINDER_TEMPLATES[activeKind].fallback);
  }, [whatsTemplate.data?.body, activeKind]);

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

  const saveWhatsTemplate = useMutation({
    mutationFn: async () => {
      if (!settings.data?.org_id) throw new Error("Configuração da organização não encontrada.");
      const body = whatsBody.trim() || REMINDER_TEMPLATES[activeKind].fallback;
      if (whatsTemplate.data?.id) {
        const { error } = await supabase
          .from("message_templates")
          .update({ body, is_active: true })
          .eq("id", whatsTemplate.data.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("message_templates").insert({
        org_id: settings.data.org_id,
        name: REMINDER_TEMPLATES[activeKind].name,
        channel: "whatsapp",
        body,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Mensagem do WhatsApp salva" });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["org", "whats-template", activeKind] }),
        qc.invalidateQueries({ queryKey: ["org", "whats-template"] }),
      ]);
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao salvar mensagem", description: getErrorMessage(e), variant: "destructive" });
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
              O sistema usa uma mensagem diferente conforme o lembrete já venceu ou não — escolha abaixo qual editar.
            </p>

            <div className="mt-4 inline-flex rounded-control border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-1">
              {(Object.keys(REMINDER_TEMPLATES) as ReminderKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveKind(kind)}
                  className={`rounded-[8px] px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    activeKind === kind
                      ? "bg-white text-vetvax-text-main shadow-sm"
                      : "text-vetvax-text-tertiary hover:text-vetvax-text-main"
                  }`}
                >
                  {REMINDER_TEMPLATES[kind].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-vetvax-text-tertiary">{REMINDER_TEMPLATES[activeKind].helper}</p>

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
                  Dica: monte a mensagem com as variáveis acima para preencher automaticamente os dados do lembrete.
                </p>
              </div>

              <div className="grid gap-2">
                <Label className="vetvax-label">Editor da mensagem</Label>
                <Textarea
                  ref={textareaRef}
                  rows={8}
                  value={whatsBody}
                  onChange={(e) => setWhatsBody(e.target.value)}
                  placeholder="Digite a mensagem padrão do WhatsApp..."
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" className="min-w-[220px]" disabled={saveWhatsTemplate.isPending} onClick={() => saveWhatsTemplate.mutate()}>
                  {saveWhatsTemplate.isPending ? "Salvando mensagem..." : `Salvar mensagem "${REMINDER_TEMPLATES[activeKind].label}"`}
                </Button>
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