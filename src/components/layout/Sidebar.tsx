import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, ClipboardList, ExternalLink, FileDown, ListPlus, LogOut, Settings, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

export type NavKey = "dashboard" | "tutors" | "new" | "reminders" | "reports" | "access" | "catalog" | "settings" | "profile";

type MenuItem = {
  key: NavKey | "public";
  label: string;
  icon: LucideIcon;
  to?: string;
  external?: string;
};

const operations: MenuItem[] = [
  { key: "dashboard", label: "Início", icon: CalendarDays, to: "/dashboard" },
  { key: "tutors", label: "Clientes", icon: Users, to: "/tutors" },
  { key: "new", label: "Novo agendamento", icon: ClipboardList, to: "/appointments/new" },
  { key: "reminders", label: "Lembretes", icon: Bell, to: "/reminders" },
  { key: "reports", label: "Relatórios", icon: FileDown, to: "/reports" },
  { key: "public", label: "Agenda pública", icon: ExternalLink, external: "/agenda-publica" },
];

const systemItems: MenuItem[] = [
  { key: "access", label: "Usuários", icon: UserCog, to: "/access" },
  { key: "catalog", label: "Catálogo", icon: ListPlus, to: "/catalog" },
  { key: "settings", label: "Configurações", icon: Settings, to: "/settings" },
];

function SidebarEntry({ item, active, onClick }: { item: MenuItem; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-full items-center gap-2.5 rounded-[11px] px-3 text-left text-sm font-semibold transition-[color,background-color,box-shadow] duration-vetvax",
        active
          ? "bg-gradient-to-r from-teal-50 to-emerald-50/80 font-bold text-vetvax-primary shadow-[inset_0_0_0_1px_rgba(15,118,110,0.12)]"
          : "bg-transparent text-vetvax-text-secondary hover:bg-vetvax-surface-panel hover:text-vetvax-text-main",
      )}
    >
      <span className={cn("absolute inset-y-1 left-0 w-[3px] rounded-pill bg-vetvax-primary", active ? "opacity-100" : "opacity-0")} />
      <item.icon className={cn("h-[18px] w-[18px] shrink-0 stroke-[2]", active ? "text-vetvax-primary" : "text-vetvax-text-tertiary group-hover:text-vetvax-primary")} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function SidebarGroup({
  title,
  items,
  activeKey,
  onNavigate,
}: {
  title: string;
  items: MenuItem[];
  activeKey: NavKey;
  onNavigate: (item: MenuItem) => void;
}) {
  return (
    <div className="mt-7 first:mt-0">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-vetvax-text-tertiary">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <SidebarEntry key={item.key} item={item} active={item.key === activeKey} onClick={() => onNavigate(item)} />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ activeKey, onNavigateDone }: { activeKey: NavKey; onNavigateDone?: () => void }) {
  const nav = useNavigate();
  const { profile, signOut } = useAuth();
  const initials = (profile?.display_name?.[0] ?? "U").toUpperCase();

  const navigateTo = (item: MenuItem) => {
    if (item.external) {
      window.open(item.external, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.to) {
      nav(item.to);
      onNavigateDone?.();
    }
  };

  return (
    <aside className="flex h-full min-h-screen w-[248px] flex-col border-r border-vetvax-border-soft bg-gradient-to-b from-white via-vetvax-surface-panel to-vetvax-surface-alt px-4 py-6 shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-vetvax-primary text-sm font-extrabold text-white shadow-vetvax-button">V</div>
        <div>
          <p className="text-[15px] font-extrabold leading-none text-vetvax-text-main">VetVAX</p>
          <p className="mt-1 text-xs text-vetvax-text-tertiary">Agenda vacinal</p>
        </div>
      </div>

      <div className="mt-5 h-px bg-gradient-to-r from-transparent via-vetvax-border-soft to-transparent" />

      <div className="vetvax-scroll mt-2 flex-1 overflow-y-auto pr-1">
        <SidebarGroup title="Operação" items={operations} activeKey={activeKey} onNavigate={navigateTo} />
        <SidebarGroup title="Sistema" items={systemItems} activeKey={activeKey} onNavigate={navigateTo} />
      </div>

      <div className="mt-5 flex h-[52px] items-center justify-between rounded-[14px] border border-vetvax-border-soft bg-white/90 px-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-vetvax-primary-soft text-xs font-bold text-vetvax-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-vetvax-text-main">{profile?.display_name ?? "Usuário"}</p>
            <p className="truncate text-[11px] text-vetvax-text-tertiary">Acesso interno</p>
          </div>
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
