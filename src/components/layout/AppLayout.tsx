import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Sidebar, { type NavKey } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

type NavMeta = { key: NavKey; name: string };

function routeMeta(pathname: string): NavMeta {
  if (pathname.startsWith("/tutors")) return { key: "tutors", name: "Clientes" };
  if (pathname.startsWith("/appointments/new")) return { key: "new", name: "Novo agendamento" };
  if (pathname.startsWith("/reminders")) return { key: "reminders", name: "Lembretes" };
  if (pathname.startsWith("/reports")) return { key: "reports", name: "Relatório de agendamentos" };
  if (pathname.startsWith("/access")) return { key: "access", name: "Usuários" };
  if (pathname.startsWith("/catalog")) return { key: "catalog", name: "Catálogo" };
  if (pathname.startsWith("/settings")) return { key: "settings", name: "Configurações" };
  if (pathname.startsWith("/profile")) return { key: "profile", name: "Perfil" };
  return { key: "dashboard", name: "Central de vacinação" };
}

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = useMemo(() => routeMeta(location.pathname), [location.pathname]);

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <div className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] md:block">
          <Sidebar activeKey={meta.key} />
        </div>

        <div className="min-w-0 flex-1 md:ml-[248px]">
          <Topbar pageName={meta.name} onOpenMenu={() => setMobileOpen(true)} />
          <main className="vetvax-page py-7 md:py-9">
            <Outlet />
          </main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[248px] border-vetvax-border-soft p-0 sm:max-w-[248px]">
          <Sidebar activeKey={meta.key} onNavigateDone={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
