import { NavLink, Outlet, useNavigate } from "react-router-dom";
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

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm transition-colors",
              "text-foreground hover:bg-muted/60",
              isActive && "bg-primary text-primary-foreground shadow-sm",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              <span className={cn("truncate", isActive && "text-primary-foreground")}>{label}</span>
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();

  const role = profile?.role ?? "viewer";
  const isAdmin = role === "admin";
  const canManage = role === "admin" || role === "manager";

  return (
    <SidebarProvider defaultOpen className="bg-background">
      <Sidebar variant="inset" collapsible="icon" className="bg-sidebar border-r border-sidebar-border">
        <SidebarHeader className="gap-3 px-3 py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-[10px] bg-primary text-primary-foreground grid place-items-center font-semibold">
                V
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">VetVAX</div>
                <div className="truncate text-xs text-muted-foreground">Chines • Profissional • Auditável</div>
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
                <NavItem to="/dashboard" icon={CalendarDays} label="Dashboard" />
                <NavItem to="/tutors" icon={Users} label="Tutores" />
                <NavItem to="/appointments/new" icon={ClipboardList} label="Novo agendamento" />
                <NavItem to="/reminders" icon={Bell} label="Lembretes" />
                <NavItem to="/reports" icon={FileDown} label="Relatórios" />
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
                  {isAdmin && <NavItem to="/access" icon={UserCog} label="Acessos" />}
                  {isAdmin && <NavItem to="/catalog" icon={Shield} label="Catálogo" />}
                  <NavItem to="/settings" icon={Settings} label="Configurações" />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="pb-5 px-3">
          <div className="flex items-center justify-between gap-2 rounded-[12px] bg-muted/30 px-3 py-3 border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 rounded-full">
                <AvatarFallback className="rounded-full bg-primary/10 text-primary font-semibold">
                  {(profile?.display_name?.[0] ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{profile?.display_name ?? "Usuário"}</div>
                <div className="truncate text-xs text-muted-foreground">{profile?.role ?? "viewer"}</div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[10px]">
                  <LogOut className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-[12px]">
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    nav("/login", { replace: true });
                  }}
                  className="rounded-[10px]"
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
        <div className="px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[20px] border border-border bg-card shadow-sm">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-5">
              <SidebarTrigger className="rounded-[10px]" />

              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">VetVAX</div>
                <div className="text-[11px] text-muted-foreground">Chines • Profissional • Auditável</div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <GlobalCommandPalette />

                <Button
                  size="icon"
                  className="inline-flex rounded-[12px] bg-primary hover:bg-[#1E40AF] sm:hidden"
                  onClick={() => nav("/appointments/new")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  className="hidden sm:inline-flex rounded-[12px] bg-primary hover:bg-[#1E40AF]"
                  onClick={() => nav("/appointments/new")}
                >
                  Novo agendamento
                </Button>
              </div>
            </header>

            <main className="px-4 py-5 sm:px-5 sm:py-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}