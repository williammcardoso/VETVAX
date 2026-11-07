import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/pt-br";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

dayjs.locale("pt-br");
dayjs.tz.setDefault("America/Sao_Paulo");

export { dayjs };

export function formatDateBr(dateISO: string) {
  return dayjs(dateISO).format("DD/MM/YYYY");
}

export function formatTimeBr(time: string) {
  // time comes as HH:mm:ss
  const [hh, mm] = time.split(":");
  return `${hh}:${mm}`;
}

/** "14:30:00" -> "14h30"; "09:00" -> "9h". */
export function formatTimeShort(time: string) {
  const [hh, mm] = time.split(":");
  const hour = String(Number(hh));
  return mm && mm !== "00" ? `${hour}h${mm}` : `${hour}h`;
}

export function daysDiffFromToday(dateISO: string) {
  const start = dayjs().startOf("day");
  const end = dayjs(dateISO).startOf("day");
  return end.diff(start, "day");
}
