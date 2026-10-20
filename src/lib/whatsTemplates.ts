import type { MessageTemplate } from "@/types/vetvax";

export type ReminderKind = "upcoming" | "overdue";

export const REMINDER_KINDS: Record<ReminderKind, { prefix: string; label: string; fallback: string; helper: string }> = {
  upcoming: {
    prefix: "Lembrete - padrão",
    label: "A vencer",
    fallback:
      "🐾 Olá, {{tutor_name}}! Aqui é da {{store_name}}.\nPassando para lembrar que a vacina de {{pet_name}} está prevista para {{due_date}}. Quer já deixar agendado? Responda aqui com o melhor dia! 📅",
    helper: "Enviada para lembretes que ainda não venceram.",
  },
  overdue: {
    prefix: "Lembrete - vencida",
    label: "Vencida",
    fallback:
      "⚠️ Olá, {{tutor_name}}! Aqui é da {{store_name}}.\nA vacina de {{pet_name}} está *atrasada* desde {{due_date}}. Pra resolver rápido, responda aqui com o melhor dia *esta semana* que já deixamos reservado pra você.",
    helper: "Enviada para lembretes já vencidos.",
  },
};

export const WHATS_VARIABLES = [
  { key: "saudacao", label: "Bom dia / Boa tarde / Boa noite (automático)" },
  { key: "primeiro_nome", label: "Primeiro nome do tutor" },
  { key: "tutor_name", label: "Nome completo do tutor" },
  { key: "pet_name", label: "Nome do pet" },
  { key: "de_pet", label: "\"de Luna\" / \"do seu animalzinho\" (sem pet)" },
  { key: "vacina", label: "Vacina do lembrete" },
  { key: "situacao", label: "Situação: está em atraso / vence no dia..." },
  { key: "due_date", label: "Data do lembrete" },
  { key: "store_name", label: "Nome da clínica" },
] as const;

const OPTION_MARK = " (opção ";

export function optionNameOf(kind: ReminderKind, n: number) {
  const prefix = REMINDER_KINDS[kind].prefix;
  return n <= 1 ? prefix : `${prefix}${OPTION_MARK}${n})`;
}

/** Option number of a template for the kind (1 = the original template), or null if it belongs to another kind. */
export function optionNumberOf(name: string, kind: ReminderKind): number | null {
  const prefix = REMINDER_KINDS[kind].prefix;
  if (name === prefix) return 1;
  if (name.startsWith(prefix + OPTION_MARK) && name.endsWith(")")) {
    const n = Number(name.slice(prefix.length + OPTION_MARK.length, -1));
    return Number.isInteger(n) && n > 1 ? n : null;
  }
  return null;
}

export function optionsForKind(templates: MessageTemplate[] | undefined | null, kind: ReminderKind) {
  return (templates ?? [])
    .map((template) => ({ template, number: optionNumberOf(template.name, kind) }))
    .filter((o): o is { template: MessageTemplate; number: number } => o.number !== null)
    .sort((a, b) => a.number - b.number);
}

/** The option currently in use for the kind (is_active). If several are active, the lowest number wins. */
export function pickActiveTemplate(templates: MessageTemplate[] | undefined | null, kind: ReminderKind) {
  return optionsForKind(templates, kind).find((o) => o.template.is_active)?.template ?? null;
}

export const OPTION_PRESETS: Array<{ id: string; label: string; description: string; bodies: Record<ReminderKind, string> }> = [
  {
    id: "pessoal",
    label: "Pessoal com destaque",
    description: "Tom de conversa, com negrito, itálico, citação e fonte diferente.",
    bodies: {
      upcoming:
        "{{saudacao}}, *{{primeiro_nome}}*! 😊\nAqui é o William, da *{{store_name}}* 🐾\n\n💉 A vacina {{de_pet}} {{situacao}}.\n\n> _Vacina em dia é pet protegido!_ 🐶🐱❤️\n\n📅 *Qual dia e horário ficam bons pra gente agendar?*\n```Responda aqui mesmo que eu já deixo reservado!``` 📲",
      overdue:
        "{{saudacao}}, *{{primeiro_nome}}*! 😊\nAqui é o William, da *{{store_name}}* 🐾\n\n⚠️ A vacina {{de_pet}} {{situacao}}.\n\n> _Quanto antes regularizar, melhor para a proteção do seu pet._ 💉❤️\n\n📅 *Qual dia e horário ficam bons pra gente agendar?*\n```Responda aqui mesmo que eu já deixo reservado!``` 📲",
    },
  },
  {
    id: "curta",
    label: "Curta e direta",
    description: "Uma mensagem curta, de pessoa para pessoa, com pergunta no final.",
    bodies: {
      upcoming:
        "{{saudacao}}, {{primeiro_nome}}! 😊 Aqui é o William da {{store_name}}.\nA vacina {{de_pet}} {{situacao}}. *Qual dia e horário ficam bons pra agendar?* 💉",
      overdue:
        "{{saudacao}}, {{primeiro_nome}}! 😊 Aqui é o William da {{store_name}}.\n⚠️ A vacina {{de_pet}} {{situacao}}. *Qual dia e horário ficam bons pra regularizar?* 💉",
    },
  },
  {
    id: "branco",
    label: "Em branco",
    description: "Começa do zero, com as variáveis disponíveis.",
    bodies: { upcoming: "", overdue: "" },
  },
];
