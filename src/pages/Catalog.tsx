import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { CatalogItem } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/vetvax/EmptyState";
import ActionButton from "@/components/vetvax/ActionButton";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  category: z.enum(["vaccine", "medication", "other"]),
  requires_description: z.boolean().default(false),
  allows_origin: z.boolean().default(false),
  default_origin: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type Values = z.infer<typeof schema>;

const categoryLabels: Record<Values["category"], string> = {
  vaccine: "Vacina",
  medication: "Medicação",
  other: "Outro",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function Catalog() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | Values["category"]>("all");

  const items = useQuery({
    queryKey: ["catalog", "admin", q],
    queryFn: async () => {
      let query = supabase
        .from("catalog_items")
        .select("id, org_id, name, category, requires_description, allows_origin, default_origin, is_active")
        .order("is_active", { ascending: false })
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      const term = q.trim();
      if (term) query = query.ilike("name", `%${term}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      category: "vaccine",
      requires_description: false,
      allows_origin: false,
      default_origin: "",
      is_active: true,
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: Values) => {
      const payload = {
        name: values.name,
        category: values.category,
        requires_description: values.requires_description,
        allows_origin: values.allows_origin,
        default_origin: values.default_origin || null,
        is_active: values.is_active,
      };

      if (editing?.id) {
        const { error } = await supabase.from("catalog_items").update(payload).eq("id", editing.id);
        if (error) throw error;
        return;
      }

      if (!profile?.org_id) throw new Error("Sem organização no perfil");
      const { error } = await supabase.from("catalog_items").insert({ ...payload, org_id: profile.org_id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Catálogo salvo" });
      setOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao salvar item", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  const rows = useMemo(() => {
    const base = items.data ?? [];
    if (typeFilter === "all") return base;
    return base.filter((item) => item.category === typeFilter);
  }, [items.data, typeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Gestão de itens"
        title="Catálogo"
        description="Gerencie vacinas, medicamentos e itens usados nos agendamentos."
        actions={
          <ActionButton
            emphasis="primary"
            onClick={() => {
              setEditing(null);
              form.reset({
                name: "",
                category: "vaccine",
                requires_description: false,
                allows_origin: false,
                default_origin: "",
                is_active: true,
              });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo item
          </ActionButton>
        }
      />

      <Card className="vetvax-card-polish rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            className="md:w-[340px]"
            placeholder="Buscar item..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Todos" },
              { id: "vaccine", label: "Vacinas" },
              { id: "medication", label: "Medicações" },
              { id: "other", label: "Outros" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setTypeFilter(chip.id as typeof typeFilter)}
              className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-vetvax ${
                  typeFilter === chip.id
                    ? "border-vetvax-primary-border bg-vetvax-primary-soft text-vetvax-primary shadow-sm"
                    : "border-vetvax-border-soft bg-vetvax-surface-alt text-vetvax-text-secondary hover:bg-vetvax-surface-panel"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((it) => (
            <article
              key={it.id}
              className="flex flex-col gap-3 rounded-[14px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/60 p-4 shadow-sm transition-[border-color,box-shadow] duration-vetvax hover:border-vetvax-border-medium hover:shadow-md md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-vetvax-text-main">{it.name}</p>
                  <Badge variant={it.category === "vaccine" ? "success" : it.category === "medication" ? "warning" : "info"}>{categoryLabels[it.category]}</Badge>
                  {!it.is_active ? <Badge variant="outline">Inativo</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {it.requires_description ? <Badge variant="outline">Exige descrição</Badge> : null}
                  {it.allows_origin ? <Badge variant="outline">Permite origem</Badge> : null}
                  {it.default_origin ? <Badge variant="outline">Origem: {it.default_origin}</Badge> : null}
                </div>
              </div>
              <ActionButton
                emphasis="secondary"
                onClick={() => {
                  setEditing(it);
                  form.reset({
                    name: it.name,
                    category: it.category,
                    requires_description: it.requires_description,
                    allows_origin: it.allows_origin,
                    default_origin: it.default_origin ?? "",
                    is_active: it.is_active,
                  });
                  setOpen(true);
                }}
              >
                Editar
              </ActionButton>
            </article>
          ))}

          {!items.isLoading && rows.length === 0 ? (
            <EmptyState
              icon={ListPlus}
              title="Nada no catálogo"
              description="Cadastre vacinas, medicações ou outros itens para usar nos agendamentos."
            />
          ) : null}
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>

          <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => upsert.mutate(v))}>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input className="h-10" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as Values["category"])}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccine">Vacina</SelectItem>
                    <SelectItem value="medication">Medicação</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Ativo</div>
                  <div className="text-xs text-muted-foreground">Itens inativos não aparecem no agendamento.</div>
                </div>
                <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Exige descrição</div>
                  <div className="text-xs text-muted-foreground">Solicita campo extra no agendamento/baixa.</div>
                </div>
                <Switch
                  checked={form.watch("requires_description")}
                  onCheckedChange={(v) => form.setValue("requires_description", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Permite origem</div>
                  <div className="text-xs text-muted-foreground">Ex: nacional/importada.</div>
                </div>
                <Switch checked={form.watch("allows_origin")} onCheckedChange={(v) => form.setValue("allows_origin", v)} />
              </div>
            </div>

            {form.watch("allows_origin") && (
              <div className="grid gap-2">
                <Label>Origem padrão (opcional)</Label>
                <Input
                  className="h-10"
                  placeholder="nacional / importada"
                  {...form.register("default_origin")}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="h-10" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="h-10" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}