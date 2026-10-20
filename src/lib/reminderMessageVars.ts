import { dayjs, formatDateBr } from "@/lib/datetime";

type ReminderLike = {
  tutor_name: string;
  pet_name: string | null;
  due_date: string;
  item_name: string | null;
  reminder_type: string;
};

/** "Bom dia" / "Boa tarde" / "Boa noite" according to the current hour in São Paulo. */
export function greetingForNow(now = dayjs()) {
  const hour = now.tz("America/Sao_Paulo").hour();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "MARIA BENEDITA" -> "Maria". */
export function firstNameOf(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Text that follows "a vacina do Boris ..." — works for both overdue and upcoming reminders. */
export function dueSituation(dueDate: string, now = dayjs()) {
  const days = dayjs(dueDate).startOf("day").diff(now.startOf("day"), "day");
  const formatted = formatDateBr(dueDate);
  if (days < 0) return `está *em atraso* (venceu em ${formatted})`;
  if (days === 0) return "vence *hoje*";
  if (days === 1) return `vence *amanhã* (${formatted})`;
  return `vence no dia *${formatted}*`;
}

export function buildReminderVars(row: ReminderLike, storeName: string) {
  return {
    tutor_name: row.tutor_name,
    primeiro_nome: firstNameOf(row.tutor_name),
    store_name: storeName,
    due_date: formatDateBr(row.due_date),
    pet_name: row.pet_name?.trim() ? row.pet_name : "seu animalzinho",
    de_pet: row.pet_name?.trim() ? `de ${row.pet_name.trim()}` : "do seu animalzinho",
    vacina: row.item_name?.trim() || row.reminder_type,
    saudacao: greetingForNow(),
    situacao: dueSituation(row.due_date),
  };
}
