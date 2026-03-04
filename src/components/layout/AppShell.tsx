import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileDown,
  LogOut,
  Plus,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GlobalCommandPalette from "@/components/command/GlobalCommandPalette";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DueReminderRow, UpcomingAppointmentRow } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";

type NavKey = "dashboard" | "tutors" | "new" | "reminders" | "reports" | "access" | "catalog" | "settings";

function NavItem({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={onClick}
        className={cn(
          "h-10 rounded-[10px] px-3 justify-start gap-2",
          "text-foreground",
          "hover:bg-[rgba(29,78,216,0.15)] hover:text-[#1D4ED8]",
          "data-[active=true]:bg-[rgba(29,78,216,0.15)] data-[active=true]:text-[#1D4ED8]",
          "data-[active=true]:shadow-none",
          "data-[active=true]:[border-left:3px_solid_#1D4ED8] data-[active=true]:pl-[9px]",
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-[#1D4ED8]" : "text-muted-foreground")} />
        <span className={cn("truncate text-sm", active ? "text-[#1D4ED8] font-semibold" : "text-foreground")}>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

async function fetchTopbarReminders() {
  const { data, error } = await supabase
    .from("vw_due_reminders")
    .select("*")
    .order("due_date", { ascending: true })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as DueReminderRow[];
}

async function fetchTopbarAppointments() {
  const { data, error } = await supabase
    .from("vw_upcoming_appointments")
    .select("*")
    .gte("scheduled_date", dayjs().format("YYYY-MM-DD"))
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as UpcomingAppointmentRow[];
}

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const role = profile?.role ?? "viewer";
  const isAdmin = role === "admin";
  const canManage = role === "admin" || role === "manager";

  const current = useMemo<NavKey>(() => {
    const p = location.pathname;
    if (p.startsWith("/tutors")) return "tutors";
    if (p.startsWith("/appointments/new")) return "new";
    if (p.startsWith("/reminders")) return "reminders";
    if (p.startsWith("/reports")) return "reports";
    if (p.startsWith("/access")) return "access";
    if (p.startsWith("/catalog")) return "catalog";
    if (p.startsWith("/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

  const initials = (profile?.display_name?.[0] ?? "U").toUpperCase();

  const reminders = useQuery({ queryKey: ["topbar", "reminders"], queryFn: fetchTopbarReminders });
  const appts = useQuery({ queryKey: ["topbar", "appts"], queryFn: fetchTopbarAppointments });

  const notifCount = (reminders.data?.length ?? 0) + (appts.data?.length ?? 0);

  const roleLabel =
    role === "admin" ? "Administrador" : role === "staff" ? "Atendente" : role === "manager" ? "Administrador" : "Atendente";

  return (
    <SidebarProvider defaultOpen className="bg-background">
      <Sidebar variant="inset" collapsible="offcanvas" className="bg-sidebar border-r border-sidebar-border">
        <SidebarHeader className="gap-3 px-3 py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-[10px] bg-primary text-primary-foreground grid place-items-center font-semibold">
                V
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">VetVAX</div>
              </div>
            </div>
          </div>
          <SidebarSeparator />
        </SidebarHeader>

        <SidebarContent className="px-2 pb-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-medium text-muted-foreground tracking-wider">
              OPERAÇÃO
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                <NavItem active={current === "dashboard"} onClick={() => nav("/dashboard")} icon={CalendarDays} label="Dashboard" />
                <NavItem active={current === "tutors"} onClick={() => nav("/tutors")} icon={Users} label="Tutores" />
                <NavItem active={current === "new"} onClick={() => nav("/appointments/new")} icon={ClipboardList} label="Novo agendamento" />
                <NavItem active={current === "reminders"} onClick={() => nav("/reminders")} icon={Bell} label="Lembretes" />
                <NavItem active={current === "reports"} onClick={() => nav("/reports")} icon={FileDown} label="Relatórios" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {canManage && (
            <SidebarGroup className="mt-6">
              <SidebarSeparator />
              <SidebarGroupLabel className="px-2 pt-5 text-[11px] font-medium text-muted-foreground tracking-wider">
                ADMIN
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {isAdmin && <NavItem active={current === "access"} onClick={() => nav("/access")} icon={UserCog} label="Acessos" />}
                  {isAdmin && <NavItem active={current === "catalog"} onClick={() => nav("/catalog")} icon={Shield} label="Catálogo" />}
                  <NavItem active={current === "settings"} onClick={() => nav("/settings")} icon={Settings} label="Configurações" />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="pb-5 px-3">
          <div className="flex items-center justify-between gap-2 rounded-[10px] bg-muted/20 px-3 py-3 border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 rounded-full">
                <AvatarFallback className="rounded-full bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{profile?.display_name ?? "Usuário"}</div>
                <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[10px]">
                  <LogOut className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-[10px]">
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    nav("/login", { replace: true });
                  }}
                  className="rounded-[8px]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background">
        {/* Topbar integrado ao layout */}
        <div className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="px-4 py-3 lg:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="rounded-[10px]" />

                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">VetVAX</div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <GlobalCommandPalette />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-[10px] border-[1.5px]">
                        <Bell className="h-4 w-4" />
                        {notifCount > 0 ? (
                          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                            {Math.min(99, notifCount)}
                          </span>
                        ) : null}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[360px] rounded-[10px]">
                      <div className="px-2 py-2">
                        <div className="text-sm font-semibold">Notificações</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">Lembretes vencidos e agendamentos próximos</div>
                      </div>
                      <SidebarSeparator />

                      <div className="max-h-[360px] overflow-auto vetvax-scroll">
                        <div className="px-2 pb-2">
                          <div className="mt-2 text-xs font-semibold text-muted-foreground">LEMBRETES</div>
                          {(reminders.data ?? []).length === 0 ? (
                            <div className="mt-2 rounded-[10px] border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                              Nenhum lembrete no momento.
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {(reminders.data ?? []).map((r) => (
                                <button
                                  key={r.id}
                                  className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-left hover:bg-muted/30"
                                  onClick={() => nav("/reminders")}
                                >
                                  <div className="text-xs font-semibold">{r.tutor_name}</div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    vence em {dayjs(r.due_date).format("DD/MM")} • {r.reminder_type}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 text-xs font-semibold text-muted-foreground">AGENDAMENTOS</div>
                          {(appts.data ?? []).length === 0 ? (
                            <div className="mt-2 rounded-[10px] border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                              Nenhum agendamento próximo.
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {(appts.data ?? []).map((a) => (
                                <button
                                  key={a.id}
                                  className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-left hover:bg-muted/30"
                                  onClick={() => nav("/dashboard")}
                                >
                                  <div className="text-xs font-semibold">{a.tutor_name}</div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {dayjs(a.scheduled_date).format("DD/MM")} • {String(a.scheduled_time).slice(0, 5)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <SidebarSeparator />
                      <div className="flex items-center justify-end gap-2 p-2">
                        <Button variant="secondary" className="h-9 rounded-[10px]" onClick={() => nav("/reminders")}>
                          Ver lembretes
                        </Button>
                        <Button className="h-9 rounded-[10px]" onClick={() => nav("/dashboard")}>
                          Ver agenda
                        </Button>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 rounded-[10px] border-[1.5px] px-2.5">
                        <Avatar className="h-7 w-7 rounded-full">
                          <AvatarFallback className="rounded-full bg-primary/10 text-primary font-semibold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="ml-2 hidden sm:inline text-sm font-medium text-foreground">
                          {profile?.display_name ?? "Usuário"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-[10px]">
                      <DropdownMenuItem className="rounded-[8px]" onClick={() => nav("/settings")}>
                        Configurações
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-[8px]"
                        onClick={async () => {
                          await signOut();
                          nav("/login", { replace: true });
                        }}
                      >
                        Sair
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    size="icon"
                    className="inline-flex rounded-[10px] bg-primary hover:bg-[#1E40AF] sm:hidden"
                    onClick={() => nav("/appointments/new")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    className="hidden sm:inline-flex rounded-[10px] bg-primary hover:bg-[#1E40AF]"
                    onClick={() => nav("/appointments/new")}
                  >
                    Novo agendamento
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4 lg:px-6 lg:pb-6">
          <div className="mx-auto max-w-6xl">
            <main className="rounded-[10px] border-[1.5px] border-border bg-card p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-5">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}