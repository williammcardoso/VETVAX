import { Bell, Menu, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import GlobalCommandPalette from "@/components/command/GlobalCommandPalette";
import { supabase } from "@/lib/supabase";
import type { DueReminderRow } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

async function fetchTopbarReminders() {
  const { data, error } = await supabase.from("vw_due_reminders").select("*").limit(20);
  if (error) throw error;
  return (data ?? []) as DueReminderRow[];
}

export default function Topbar({
  pageName,
  onOpenMenu,
}: {
  pageName: string;
  onOpenMenu: () => void;
}) {
  const nav = useNavigate();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const { profile } = useAuth();
  const initials = (profile?.display_name?.[0] ?? "U").toUpperCase();
  const reminders = useQuery({ queryKey: ["topbar", "reminders"], queryFn: fetchTopbarReminders });
  const notifCount = useMemo(() => reminders.data?.length ?? 0, [reminders.data?.length]);

  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-vetvax-border-soft bg-white/86 px-4 shadow-vetvax-topbar backdrop-blur-[14px] md:px-8">
      <div className="vetvax-page flex h-full items-center justify-between !px-0">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 md:hidden" onClick={onOpenMenu}>
            <Menu className="h-[18px] w-[18px] stroke-[2]" />
          </Button>
          <p className="truncate text-sm">
            <span className="text-vetvax-text-tertiary">VetVAX</span>
            <span className="px-1.5 text-vetvax-text-tertiary">/</span>
            <span className="font-semibold text-vetvax-text-main">{pageName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <form
            className="hidden md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const term = quickSearch.trim();
              if (!term) return;
              nav(`/tutors?q=${encodeURIComponent(term)}`);
            }}
          >
            <Input
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Buscar cliente, telefone ou região..."
              className="h-10 w-[240px] bg-white lg:w-[300px]"
            />
          </form>
          <GlobalCommandPalette className="hidden lg:flex lg:w-[150px]" placeholder="Busca avançada..." />
          <Popover open={openNotifications} onOpenChange={setOpenNotifications}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10">
                <Bell className="h-[18px] w-[18px] stroke-[2] text-vetvax-text-secondary" />
                {notifCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-pill bg-vetvax-primary px-1 text-[10px] font-bold text-white">
                    {Math.min(99, notifCount)}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,380px)] rounded-[14px] border border-vetvax-border-soft p-0 shadow-vetvax-card">
              <div className="border-b border-vetvax-border-soft px-4 py-3">
                <p className="text-sm font-semibold text-vetvax-text-main">Lembretes ativos</p>
                <p className="text-xs text-vetvax-text-tertiary">{(reminders.data?.length ?? 0)} lembrete(s) aguardando contato</p>
              </div>
              <div className="flex items-center gap-2 border-b border-vetvax-border-soft px-3 py-2">
                <Button
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => {
                    setOpenNotifications(false);
                    nav("/reminders");
                  }}
                >
                  Ver lembretes
                </Button>
                <Button
                  variant="outline"
                  className="ml-auto h-8 text-xs"
                  onClick={async () => {
                    await reminders.refetch();
                  }}
                >
                  Atualizar
                </Button>
              </div>
              <div
                className="max-h-[350px] overflow-y-auto overscroll-contain p-3"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="space-y-2">
                  {(reminders.data ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setOpenNotifications(false);
                        nav("/reminders");
                      }}
                      className="w-full rounded-[12px] border border-vetvax-border-soft bg-white px-3 py-2 text-left hover:bg-vetvax-surface-alt"
                    >
                      <p className="truncate text-sm font-semibold text-vetvax-text-main">{item.tutor_name}</p>
                      <p className="text-xs text-vetvax-text-tertiary">
                        Lembrete em {dayjs(item.due_date).format("DD/MM/YYYY")}
                      </p>
                    </button>
                  ))}
                  {notifCount === 0 ? (
                    <p className="rounded-[12px] border border-dashed border-vetvax-border-soft px-3 py-5 text-center text-xs text-vetvax-text-tertiary">
                      Nenhuma notificação no momento.
                    </p>
                  ) : null}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => nav("/profile")}
            className="hidden h-10 items-center gap-2 rounded-pill border border-vetvax-border-soft bg-white px-2.5 shadow-sm transition-[background-color,box-shadow,border-color] duration-vetvax hover:border-vetvax-border-medium hover:bg-vetvax-surface-panel hover:shadow md:flex"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-vetvax-primary-soft text-xs font-bold text-vetvax-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="max-w-[140px] truncate text-sm font-semibold text-vetvax-text-main">{profile?.display_name ?? "Usuário"}</span>
          </button>
          <Button className="h-[42px] rounded-control" onClick={() => nav("/vaccinations/new")}>
            <Plus className="h-[18px] w-[18px] stroke-[2]" />
            <span className="hidden sm:inline">Registrar aplicação</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
