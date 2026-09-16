import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Sidebar, { type NavKey } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

type NavMeta = { key: NavKey; name: string };

function routeMeta(pathname: string): NavMeta {
  if (pathname.startsWith("/tutors")) return { key: "tutors", name: "Clientes" };
  if (pathname.startsWith("/vaccinations/new")) return { key: "new", name: "Registrar aplicação" };
  if (pathname.startsWith("/reminders/new")) return { key: "scheduleReturn", name: "Agendar retorno" };
  if (pathname.startsWith("/reminders")) return { key: "reminders", name: "Lembretes" };
  if (pathname.startsWith("/reports")) return { key: "reports", name: "Relatório de vacinações" };
  if (pathname.startsWith("/access")) return { key: "access", name: "Usuários" };
  if (pathname.startsWith("/catalog")) return { key: "catalog", name: "Catálogo" };
  if (pathname.startsWith("/prices")) return { key: "prices", name: "Lista de preço" };
  if (pathname.startsWith("/settings")) return { key: "settings", name: "Configurações" };
  if (pathname.startsWith("/profile")) return { key: "profile", name: "Perfil" };
  return { key: "dashboard", name: "Central de vacinação" };
}

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vetvax.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const meta = useMemo(() => routeMeta(location.pathname), [location.pathname]);

  const setCollapsed = (next: boolean) => {
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("vetvax.sidebar.collapsed", next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <div className={cn("fixed left-0 top-0 z-40 hidden h-screen transition-[width] duration-vetvax md:block", sidebarCollapsed ? "w-[84px]" : "w-[264px]")}>
          <Sidebar activeKey={meta.key} collapsed={sidebarCollapsed} onToggleCollapsed={() => setCollapsed(!sidebarCollapsed)} />
        </div>

        <div className={cn("min-w-0 flex-1 transition-[margin-left] duration-vetvax", sidebarCollapsed ? "md:ml-[84px]" : "md:ml-[264px]")}>
          <Topbar pageName={meta.name} onOpenMenu={() => setMobileOpen(true)} />
          <main className="vetvax-page py-7 md:py-9">
            <Outlet />
          </main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[264px] border-vetvax-border-soft p-0 sm:max-w-[264px]">
          <Sidebar activeKey={meta.key} onNavigateDone={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
