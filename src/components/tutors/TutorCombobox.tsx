import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type TutorLite = {
  id: string;
  name: string;
  phone1: string | null;
  phone2: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
};

export default function TutorCombobox({
  value,
  onChange,
  onCreateNew,
}: {
  value: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const tutors = useQuery({
    queryKey: ["tutors", "combo", q],
    queryFn: async () => {
      let query = supabase
        .from("tutors")
        .select("id, name, phone1, phone2, street, number, neighborhood")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(50);

      const term = q.trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,phone1.ilike.%${term}%,phone2.ilike.%${term}%,street.ilike.%${term}%,number.ilike.%${term}%,neighborhood.ilike.%${term}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TutorLite[];
    },
  });

  const selected = useMemo(() => tutors.data?.find((t) => t.id === value) ?? null, [tutors.data, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between rounded-[10px]"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selected?.name ?? (value ? "Tutor selecionado" : "Selecione um tutor…")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,90vw)] p-0 rounded-[10px] border-[1.5px]" align="start">
        <Command>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <CommandInput placeholder="Buscar tutor…" value={q} onValueChange={setQ} />
          </div>
          <CommandList>
            <CommandEmpty>
              <div className="p-4 text-sm text-muted-foreground">
                Nenhum tutor encontrado.
                <Button className="mt-3 h-10 w-full rounded-[10px]" onClick={onCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar novo tutor
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup heading="Tutores">
              {(tutors.data ?? []).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.phone1 ?? ""} ${t.phone2 ?? ""} ${t.street ?? ""} ${t.number ?? ""} ${t.neighborhood ?? ""}`}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className="rounded-[10px]"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === t.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[t.street, t.number, t.neighborhood].filter(Boolean).join(", ") || "endereço não informado"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {(t.phone1 ?? t.phone2) ? [t.phone1, t.phone2].filter(Boolean).join(" • ") : "sem telefone"}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t border-border p-2">
              <Button variant="secondary" className="h-10 w-full rounded-[10px]" onClick={onCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Criar novo tutor
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}