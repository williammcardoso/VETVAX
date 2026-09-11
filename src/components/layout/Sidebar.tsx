import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, ChevronDown, ClipboardList, FileDown, ListPlus, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Tag, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import VetVaxMark from "@/components/branding/VetVaxMark";

export type NavKey = "dashboard" | "tutors" | "new" | "reminders" | "reports" | "access" | "catalog" | "prices" | "settings" | "profile";

type MenuItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  to: string;
};

const operations: MenuItem[] = [
  { key: "dashboard", label: "Início", icon: CalendarDays, iconClass: "text-sky-600", to: "/dashboard" },
  { key: "tutors", label: "Clientes", icon: Users, iconClass: "text-indigo-600", to: "/tutors" },
  { key: "new", label: "Registrar aplicação", icon: ClipboardList, iconClass: "text-violet-600", to: "/vaccinations/new" },
  { key: "reminders", label: "Lembretes", icon: Bell, iconClass: "text-amber-600", to: "/reminders" },
  { key: "reports", label: "Relatórios", icon: FileDown, iconClass: "text-emerald-600", to: "/reports" },
];

const systemItems: MenuItem[] = [
  { key: "access", label: "Usuários", icon: UserCog, iconClass: "text-blue-600", to: "/access" },
  { key: "catalog", label: "Catálogo", icon: ListPlus, iconClass: "text-fuchsia-600", to: "/catalog" },
  { key: "prices", label: "Lista de preço", icon: Tag, iconClass: "text-rose-600", to: "/prices" },
  { key: "settings", label: "Configurações", icon: Settings, iconClass: "text-slate-600", to: "/settings" },
];

function SidebarEntry({ item, active, collapsed, onClick }: { item: MenuItem; active: boolean; collapsed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-9 w-full items-center gap-2 rounded-[12px] px-2.5 text-left text-sm font-normal transition-[color,background-color,box-shadow,transform] duration-vetvax",
        collapsed && "justify-center px-0",
        active
          ? "bg-[rgba(16,185,129,0.10)] text-[#059669] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28)]"
          : "bg-transparent text-vetvax-text-secondary hover:bg-vetvax-surface-panel hover:text-vetvax-text-main hover:translate-x-[1px]",
      )}
    >
      <span className={cn("absolute inset-y-1 left-0 w-[3px] rounded-pill bg-[#059669]", active ? "opacity-100" : "opacity-0")} />
      <item.icon className={cn("h-[17px] w-[17px] shrink-0 stroke-[2]", active ? "text-[#059669]" : `${item.iconClass} opacity-90 group-hover:opacity-100`)} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  );
}

function SidebarGroup({
  title,
  items,
  activeKey,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: MenuItem[];
  activeKey: NavKey;
  collapsed?: boolean;
  onNavigate: (item: MenuItem) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-5 first:mt-0">
      <button
        type="button"
        title={collapsed ? title : undefined}
        className="mb-1 flex w-full items-center justify-between rounded-[8px] px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetvax-text-tertiary hover:bg-vetvax-surface-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {!collapsed ? title : "•"}
        {!collapsed ? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-vetvax", open ? "rotate-0" : "-rotate-90")} /> : null}
      </button>
      <div className={cn("space-y-0.5", !open && "hidden")}>
        {items.map((item) => (
          <SidebarEntry key={item.key} item={item} active={item.key === activeKey} collapsed={collapsed} onClick={() => onNavigate(item)} />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({
  activeKey,
  onNavigateDone,
  collapsed = false,
  onToggleCollapsed,
}: {
  activeKey: NavKey;
  onNavigateDone?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const nav = useNavigate();
  const { profile, signOut } = useAuth();
  const initials = (profile?.display_name?.[0] ?? "U").toUpperCase();

  const navigateTo = (item: MenuItem) => {
    nav(item.to);
    onNavigateDone?.();
  };

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-vetvax-border-soft bg-gradient-to-b from-[#ffffff] via-[#f9fbfd] to-[#f7f9fc] px-4 py-5 shadow-[inset_-1px_0_0_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <VetVaxMark className="h-10 w-10 drop-shadow-[0_10px_20px_rgba(16,185,129,0.3)]" />
          {!collapsed ? (
            <div>
              <p className="text-[15px] font-extrabold leading-none text-vetvax-text-main">VetVAX</p>
              <p className="mt-1 text-xs text-vetvax-text-tertiary">Agenda vacinal</p>
            </div>
          ) : null}
        </div>

        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[8px]"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 h-px bg-gradient-to-r from-transparent via-vetvax-border-soft to-transparent" />

      <div className="vetvax-scroll mt-2 flex-1 overflow-y-auto pr-1">
        <SidebarGroup title="Operação" items={operations} activeKey={activeKey} collapsed={collapsed} onNavigate={navigateTo} />
        <SidebarGroup title="Sistema" items={systemItems} activeKey={activeKey} collapsed={collapsed} onNavigate={navigateTo} />
      </div>

      <div className={cn("mt-4 flex h-[50px] items-center rounded-[14px] border border-vetvax-border-soft bg-white/95 shadow-[0_8px_20px_rgba(15,23,42,0.06)]", collapsed ? "justify-center px-1" : "justify-between px-3")}>
        <div className={cn("flex min-w-0 items-center", collapsed ? "gap-0" : "gap-2.5")}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-vetvax-primary-soft text-xs font-bold text-vetvax-primary">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed ? <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-vetvax-text-main">{profile?.display_name ?? "Usuário"}</p>
            <p className="truncate text-[11px] text-vetvax-text-tertiary">Acesso interno</p>
          </div> : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-control hover:bg-[#f1f5f9]"
          onClick={async () => {
            await signOut();
            nav("/login", { replace: true });
          }}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
