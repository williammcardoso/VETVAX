import { useQuery } from "@tanstack/react-query";
import type { DueReminderRow, OrgSettings, UpcomingAppointmentRow } from "@/types/vetvax";
import { supabase } from "@/lib/supabase";
import { renderTemplate } from "@/lib/template";
import { formatDateBr, formatTimeBr } from "@/lib/datetime";

async function fetchOrgSettings() {
  const { data, error } = await supabase
    .from("org_settings")
    .select("id, org_id, store_name, store_phone, store_address, timezone, branding")
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as OrgSettings | null;
}

async function fetchDefaultTemplate() {
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, name, body")
    .eq("channel", "whatsapp")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as { id: string; name: string; body: string } | null;
}

export function useWhatsMessage() {
  const org = useQuery({ queryKey: ["org", "settings"], queryFn: fetchOrgSettings });
  const template = useQuery({ queryKey: ["org", "whats-template"], queryFn: fetchDefaultTemplate });

  const pickPhone = (p1: string | null | undefined, p2: string | null | undefined) => {
    return (p1 && p1.trim() ? p1 : null) ?? (p2 && p2.trim() ? p2 : null);
  };

  const buildReminderMessage = async (row: DueReminderRow) => {
    const storeName = org.data?.store_name ?? "VetVAX";
    const body =
      template.data?.body ??
      "Olá {{tutor_name}}! Aqui é da {{store_name}}. Passando para lembrar da próxima aplicação em {{due_date}}.";

    return renderTemplate(body, {
      tutor_name: row.tutor_name,
      store_name: storeName,
      due_date: formatDateBr(row.due_date),
      pet_name: row.pet_name,
    });
  };

  const buildAppointmentMessage = async (row: UpcomingAppointmentRow) => {
    const storeName = org.data?.store_name ?? "VetVAX";
    const items = row.items?.map((it) => `${it.quantity}× ${it.item}`).join(", ") ?? "";

    return [
      `Olá ${row.tutor_name}! Aqui é da ${storeName}.`,
      `Confirmando seu agendamento para ${formatDateBr(row.scheduled_date)} às ${formatTimeBr(row.scheduled_time)}.`,
      items ? `Itens: ${items}.` : null,
      "Se precisar reagendar, é só responder por aqui.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  return { pickPhone, buildReminderMessage, buildAppointmentMessage, loading: org.isLoading || template.isLoading };
}
