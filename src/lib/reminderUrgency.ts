import { daysDiffFromToday } from "@/lib/datetime";

export type ReminderUrgency = "overdue" | "soon" | "later";

export const URGENCY_SOON_DAYS = 7;

export function getReminderUrgency(dueDateISO: string): ReminderUrgency {
  const days = daysDiffFromToday(dueDateISO);
  if (days < 0) return "overdue";
  if (days <= URGENCY_SOON_DAYS) return "soon";
  return "later";
}

export const URGENCY_STRIPE_CLASS: Record<ReminderUrgency, string> = {
  overdue: "bg-vetvax-danger",
  soon: "bg-vetvax-warning",
  later: "bg-vetvax-success",
};

export const URGENCY_BADGE_TONE: Record<ReminderUrgency, "danger" | "warning" | "success"> = {
  overdue: "danger",
  soon: "warning",
  later: "success",
};
