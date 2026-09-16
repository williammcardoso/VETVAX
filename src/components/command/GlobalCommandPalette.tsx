import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CalendarPlus, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TutorLite = { id: string; name: string; phone1: string | null; phone2: string | null };

function useHotkey(callback: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if (!isK) return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [callback]);
}

export default function GlobalCommandPalette({ className, placeholder = "Buscar cliente, telefone ou vacina..." }: { className?: string; placeholder?: string }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useHotkey(() => setOpen((v) => !v));

  const tutors = useQuery({
    queryKey: ["cmdk", "tutors", q],
    enabled: open,
    queryFn: async () => {
      const term = q.trim();
      if (!term) return [] as TutorLite[];

      const { data, error } = await supabase
        .from("tutors")
        .select("id, name, phone1, phone2")
        .eq("is_active", true)
        .or(`name.ilike.%${term}%,phone1.ilike.%${term}%,phone2.ilike.%${term}%`)
        .order("name", { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as TutorLite[];
    },
  });

  const quickActions = useMemo(
    () => [
      {
        key: "new-vaccination",
        label: "Registrar aplicação",
        icon: CalendarPlus,
        run: () => nav("/vaccinations/new"),
      },
      {
        key: "schedule-return",
        label: "Agendar retorno",
        icon: CalendarClock,
        run: () => nav("/reminders/new"),
      },
      {
        key: "tutors",
        label: "Abrir Clientes",
        icon: Users,
        run: () => nav("/tutors"),
      },
      {
        key: "search-term",
        label: q.trim() ? `Buscar "${q.trim()}" em Clientes` : "Buscar em Clientes",
        icon: Search,
        run: () => nav(`/tutors${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
      },
    ],
    [nav, q],
  );

  return (
    <>
      <button
        className={cn(
          "flex h-10 w-[260px] items-center gap-2 rounded-control border border-vetvax-border-soft bg-[#f8fafc] px-3 text-left text-sm text-vetvax-text-tertiary hover:bg-vetvax-surface-alt",
          className,
        )}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">{placeholder}</span>
        <Badge variant="secondary" className="ml-auto hidden rounded-[8px] px-1.5 py-1 text-[10px] sm:inline-flex">
          Ctrl+K
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 rounded-[10px] overflow-hidden max-w-2xl border-[1.5px] border-border shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
          <Command>
            <div className="border-b border-border p-2">
              <CommandInput placeholder="Buscar tutor ou ação…" value={q} onValueChange={setQ} />
            </div>
            <CommandList>
              <CommandEmpty>
                <div className="p-6 text-sm text-muted-foreground">Nada encontrado.</div>
              </CommandEmpty>

              <CommandGroup heading="Ações">
                {quickActions.map((a) => (
                  <CommandItem
                    key={a.key}
                    className="rounded-[10px]"
                    onSelect={() => {
                      setOpen(false);
                      a.run();
                    }}
                  >
                    <a.icon className="mr-2 h-4 w-4" />
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Clientes">
                {(tutors.data ?? []).map((t) => (
                  <CommandItem
                    key={t.id}
                    className="rounded-[10px]"
                    onSelect={() => {
                      setOpen(false);
                      nav(`/tutors/${t.id}`);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[t.phone1, t.phone2].filter(Boolean).join(" • ") || "sem telefone"}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}