import { Bell, Menu, Plus } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import GlobalCommandPalette from "@/components/command/GlobalCommandPalette";
import { supabase } from "@/lib/supabase";
import type { DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";

async function fetchTopbarReminders() {
  const { data, error } = await supabase.from("vw_due_reminders").select("*").limit(20);
  if (error) throw error;
  return (data ?? []) as DueReminderRow[];
}

async function fetchTopbarAppointments() {
  const { data, error } = await supabase
    .from("vw_upcoming_appointments")
    .select("*")
    .gte("scheduled_date", dayjs().format("YYYY-MM-DD"))
    .limit(20);
  if (error) throw error;
  return (data ?? []) as UpcomingAppointmentRow[];
}

export default function Topbar({
  pageName,
  onOpenMenu,
}: {
  pageName: string;
  onOpenMenu: () => void;
}) {
  const nav = useNavigate();
  const { profile } = useAuth();
  const initials = (profile?.display_name?.[0] ?? "U").toUpperCase();
  const reminders = useQuery({ queryKey: ["topbar", "reminders"], queryFn: fetchTopbarReminders });
  const appointments = useQuery({ queryKey: ["topbar", "appointments"], queryFn: fetchTopbarAppointments });
  const notifCount = useMemo(() => (reminders.data?.length ?? 0) + (appointments.data?.length ?? 0), [appointments.data?.length, reminders.data?.length]);

  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-vetvax-border-soft bg-[rgba(255,255,255,0.82)] px-4 backdrop-blur-[14px] md:px-8">
      <div className="vetvax-page flex h-full items-center justify-between !px-0">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 md:hidden" onClick={onOpenMenu}>
            <Menu className="h-4 w-4" />
          </Button>
          <p className="truncate text-sm">
            <span className="text-vetvax-text-tertiary">VetVAX</span>
            <span className="px-1.5 text-vetvax-text-tertiary">/</span>
            <span className="font-bold text-vetvax-text-main">{pageName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GlobalCommandPalette className="hidden lg:flex" />
          <Button variant="outline" size="icon" className="relative h-10 w-10">
            <Bell className="h-4 w-4" />
            {notifCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-pill bg-vetvax-primary px-1 text-[10px] font-bold text-white">
                {Math.min(99, notifCount)}
              </span>
            ) : null}
          </Button>
          <button
            type="button"
            onClick={() => nav("/profile")}
            className="hidden h-10 items-center gap-2 rounded-pill border border-vetvax-border-soft bg-white px-2.5 hover:bg-vetvax-surface-alt md:flex"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-vetvax-primary-soft text-xs font-bold text-vetvax-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="max-w-[140px] truncate text-sm font-semibold text-vetvax-text-main">{profile?.display_name ?? "Usuário"}</span>
          </button>
          <Button className="h-[42px] rounded-control" onClick={() => nav("/appointments/new")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo agendamento</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
