import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  FileDown,
  LogOut,
  Settings,
  Shield,
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
import { Badge } from "@/components/ui/badge";
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
              "rounded-xl",
              isActive &&
                "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border",
            )
          }
        >
          <Icon className="opacity-80" />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="gap-2">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-2xl bg-[hsl(var(--brand))] text-white grid place-items-center font-semibold">
                V
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">VetVAX</div>
                <div className="truncate text-xs text-sidebar-foreground/70">Agenda • Baixa • Lembretes</div>
              </div>
            </div>
          </div>
          <SidebarSeparator />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem to="/dashboard" icon={CalendarDays} label="Dashboard" />
                <NavItem to="/tutors" icon={Users} label="Tutores" />
                <NavItem to="/appointments/new" icon={ClipboardList} label="Novo agendamento" />
                <NavItem to="/reports" icon={FileDown} label="Relatórios" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem to="/catalog" icon={Shield} label="Catálogo" />
                <NavItem to="/settings" icon={Settings} label="Configurações" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="pb-3">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-2 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 rounded-2xl">
                <AvatarFallback className="rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
                  {(profile?.display_name?.[0] ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">
                  {profile?.display_name ?? "Usuário"}
                </div>
                <div className="truncate text-[11px] text-sidebar-foreground/70">
                  <Badge variant="secondary" className="rounded-xl px-2 py-0 text-[10px]">
                    {profile?.role ?? "viewer"}
                  </Badge>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-2xl">
                  <LogOut className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    nav("/login", { replace: true });
                  }}
                  className="rounded-xl"
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
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <SidebarTrigger className="rounded-xl" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">VetVAX</div>
              <div className="text-[11px] text-muted-foreground">Multi-tenant • RBAC • Auditoria</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <GlobalCommandPalette />
              <Button
                variant="secondary"
                className="hidden sm:inline-flex rounded-2xl"
                onClick={() => nav("/appointments/new")}
              >
                Novo agendamento
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}