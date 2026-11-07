import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Pin, RefreshCw, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DueReminderRow } from "@/types/vetvax";
import { dayjs, formatTimeBr } from "@/lib/datetime";
import { formatBrPhoneForDisplay } from "@/lib/phone";
import { canPinMiniAgenda, openMiniAgenda } from "@/lib/pinMiniAgenda";
import { useWhatsReminderSend } from "@/components/reminders/useWhatsReminderSend";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

const REFRESH_MS = 60_000;
const DAYS_AHEAD = 14;
const MAX_ROWS = 60;

function dayTitle(date: string, today: string) {
  const diff = dayjs(date).startOf("day").diff(dayjs(today).startOf("day"), "day");
  const label = dayjs(date).format("ddd, DD/MM");
  if (diff === 0) return `Hoje — ${label}`;
  if (diff === 1) return `Amanhã — ${label}`;
  return label;
}

function Row({ row, onWhats }: { row: DueReminderRow; onWhats: (row: DueReminderRow) => void }) {
  const phone = [row.tutor_phone1, row.tutor_phone2].filter(Boolean).map((p) => formatBrPhoneForDisplay(p))[0];
  const time = (row as { due_time?: string | null }).due_time;
  const what = [row.pet_name, `${row.quantity ?? 1}x ${row.item_name ?? row.reminder_type}`].filter(Boolean).join(" • ");

  return (
    <li className="flex items-start gap-2 rounded-[10px] bg-white/70 px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      <div className="min-w-0 flex-1">
        <a
          href={`/vaccinations/new?tutor=${row.tutor_id}&resolveReminder=${row.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Registrar aplicação (abre o sistema)"
          className="block truncate text-[13px] font-bold text-slate-900 hover:underline"
        >
          {time ? <span className="mr-1.5 rounded-[6px] bg-amber-300/80 px-1.5 py-0.5 text-[11px] font-extrabold">{formatTimeBr(time)}</span> : null}
          {row.tutor_name}
        </a>
        <p className="truncate text-[12px] text-slate-700">{what}</p>
        {phone ? <p className="text-[11px] text-slate-500">{phone}</p> : null}
        {row.notes && !row.notes.toLowerCase().includes("sistema antigo") ? (
          <p className="truncate text-[11px] italic text-slate-500">{row.notes}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onWhats(row)}
        title="Chamar no WhatsApp"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-emerald-600 shadow-sm hover:bg-emerald-50"
      >
        <WhatsAppIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function MiniAgenda() {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => dayjs());

  const reminders = useQuery({
    queryKey: ["mini", "agenda"],
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_due_reminders").select("*").order("due_date", { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []) as DueReminderRow[];
    },
  });

  const { openWhats, whatsDialog } = useWhatsReminderSend(async () => {
    await qc.invalidateQueries({ queryKey: ["mini", "agenda"] });
  });

  // The window stays open for days: keep "today" correct across midnight.
  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (reminders.dataUpdatedAt) setNow(dayjs());
  }, [reminders.dataUpdatedAt]);

  const today = now.format("YYYY-MM-DD");

  const { overdue, groups, hiddenCount } = useMemo(() => {
    const all = reminders.data ?? [];
    const limit = now.add(DAYS_AHEAD, "day").format("YYYY-MM-DD");
    const byTime = (a: DueReminderRow, b: DueReminderRow) =>
      ((a as { due_time?: string | null }).due_time ?? "99:99").localeCompare((b as { due_time?: string | null }).due_time ?? "99:99") ||
      a.tutor_name.localeCompare(b.tutor_name);

    const upcoming = all.filter((r) => r.due_date >= today && r.due_date <= limit).sort((a, b) => a.due_date.localeCompare(b.due_date) || byTime(a, b));
    const shown = upcoming.slice(0, MAX_ROWS);
    const map = new Map<string, DueReminderRow[]>();
    for (const r of shown) map.set(r.due_date, [...(map.get(r.due_date) ?? []), r]);

    return {
      overdue: all.filter((r) => r.due_date < today).length,
      groups: Array.from(map.entries()),
      hiddenCount: upcoming.length - shown.length,
    };
  }, [reminders.data, today, now]);

  const insideFrame = window.self !== window.top;
  const hasToday = groups.some(([date]) => date === today);

  return (
    <div className="flex h-screen flex-col bg-[#fff6b8] text-slate-900">
      {whatsDialog}

      <header className="flex items-center gap-2 border-b border-amber-300/70 bg-[#ffec82] px-3 py-2.5">
        <CalendarCheck className="h-4 w-4 shrink-0 text-amber-800" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold leading-tight">Agenda VetVAX</p>
          <p className="truncate text-[11px] capitalize leading-tight text-amber-900/80">
            {now.format("dddd, DD [de] MMMM")} • atualizado {now.format("HH:mm")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reminders.refetch()}
          title="Atualizar agora"
          className="grid h-7 w-7 place-items-center rounded-full text-amber-900 hover:bg-amber-300/60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${reminders.isFetching ? "animate-spin" : ""}`} />
        </button>
        {!insideFrame ? (
          <button
            type="button"
            onClick={() => void openMiniAgenda()}
            title={canPinMiniAgenda() ? "Fixar sobre as outras janelas" : "Abrir em janela pequena"}
            className="grid h-7 w-7 place-items-center rounded-full text-amber-900 hover:bg-amber-300/60"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>

      {overdue > 0 ? (
        <a
          href="/reminders?due=overdue"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 border-b border-amber-300/70 bg-red-100 px-3 py-1.5 text-[12px] font-bold text-red-800 hover:bg-red-200"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {overdue} {overdue === 1 ? "lembrete atrasado" : "lembretes atrasados"} — ver no sistema
        </a>
      ) : null}

      <main className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {reminders.isError ? (
          <p className="rounded-[10px] bg-red-100 px-3 py-2 text-[12px] font-semibold text-red-800">
            Não consegui carregar. Se a sessão expirou, abra o sistema e entre de novo.
          </p>
        ) : null}

        {reminders.isLoading ? <p className="text-center text-[12px] text-amber-900/70">Carregando…</p> : null}

        {!reminders.isLoading && !hasToday ? (
          <section>
            <h2 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-900/80">{dayTitle(today, today)}</h2>
            <p className="rounded-[10px] bg-white/60 px-3 py-2 text-[12px] text-slate-600">Nada agendado para hoje.</p>
          </section>
        ) : null}

        {groups.map(([date, rows]) => (
          <section key={date}>
            <h2 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-900/80 first-letter:uppercase">
              {dayTitle(date, today)} <span className="font-semibold">({rows.length})</span>
            </h2>
            <ul className="space-y-1.5">
              {rows.map((row) => (
                <Row key={row.id} row={row} onWhats={openWhats} />
              ))}
            </ul>
          </section>
        ))}

        {hiddenCount > 0 ? <p className="text-center text-[11px] text-amber-900/70">+ {hiddenCount} nos próximos dias — veja no sistema</p> : null}
        {!reminders.isLoading && groups.length === 0 && !reminders.isError ? (
          <p className="text-center text-[12px] text-amber-900/70">Nada nos próximos {DAYS_AHEAD} dias.</p>
        ) : null}
      </main>
    </div>
  );
}
