import { useQuery } from "@tanstack/react-query";
import type { DueReminderRow, MessageTemplate, OrgSettings } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { renderTemplate } from "@/lib/template";
import { dayjs, formatDateBr } from "@/lib/datetime";

async function fetchOrgSettings() {
  const { data, error } = await supabase
    .from("org_settings")
    .select("id, org_id, store_name, store_phone, store_address, timezone, branding")
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as OrgSettings | null;
}

const REMINDER_TEMPLATE_NAME = "Lembrete - padrão";
const OVERDUE_REMINDER_TEMPLATE_NAME = "Lembrete - vencida";

async function fetchWhatsTemplates() {
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, org_id, name, channel, body, is_active, created_at, updated_at")
    .eq("channel", "whatsapp")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as MessageTemplate[];
}

export function useWhatsMessage() {
  const org = useQuery({ queryKey: ["org", "settings"], queryFn: fetchOrgSettings });
  const templates = useQuery({ queryKey: ["org", "whats-template"], queryFn: fetchWhatsTemplates });

  const pickPhone = (p1: string | null | undefined, p2: string | null | undefined) => {
    return (p1 && p1.trim() ? p1 : null) ?? (p2 && p2.trim() ? p2 : null);
  };

  const buildReminderMessage = async (row: DueReminderRow) => {
    const storeName = org.data?.store_name ?? "VetVAX";
    const isOverdue = row.due_date < dayjs().format("YYYY-MM-DD");
    const preferredName = isOverdue ? OVERDUE_REMINDER_TEMPLATE_NAME : REMINDER_TEMPLATE_NAME;
    const reminderTemplate =
      templates.data?.find((t) => t.name === preferredName) ??
      templates.data?.find((t) => t.name === REMINDER_TEMPLATE_NAME) ??
      templates.data?.find((t) => t.name.toLowerCase().includes("lembrete")) ??
      templates.data?.[0] ??
      null;
    const fallbackBody = isOverdue
      ? "⚠️ Olá {{tutor_name}}! Aqui é da {{store_name}}. A vacina de {{pet_name}} está atrasada desde {{due_date}}. Responda aqui com o melhor dia para regularizar."
      : "Olá {{tutor_name}}! Aqui é da {{store_name}}. Passando para lembrar da próxima aplicação em {{due_date}}.";
    const body = reminderTemplate?.body ?? fallbackBody;

    return renderTemplate(body, {
      tutor_name: row.tutor_name,
      store_name: storeName,
      due_date: formatDateBr(row.due_date),
      pet_name: row.pet_name,
    });
  };

  return { pickPhone, buildReminderMessage, loading: org.isLoading || templates.isLoading };
}
