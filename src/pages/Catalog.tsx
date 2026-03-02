import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  category: z.enum(["vaccine", "medication", "other"]),
  requires_description: z.boolean().default(false),
  allows_origin: z.boolean().default(false),
  default_origin: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type Values = z.infer<typeof schema>;

export default function Catalog() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

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

      const { error } = await supabase.from("catalog_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Catálogo salvo" });
      setOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao salvar item", description: e?.message, variant: "destructive" });
    },
  });

  const rows = useMemo(() => items.data ?? [], [items.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Admin
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Catálogo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Itens configuráveis por organização (vacinas, medicações, outros).</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className="rounded-2xl sm:w-[320px]"
            placeholder="Buscar item…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            className="rounded-2xl"
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
            <Plus className="mr-2 h-4 w-4" />
            Novo item
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl p-4 sm:p-5">
        <div className="overflow-hidden rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Item</TableHead>
                <TableHead className="hidden md:table-cell">Regras</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((it) => (
                <TableRow key={it.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{it.name}</div>
                      {!it.is_active && (
                        <Badge variant="secondary" className="rounded-full">
                          inativo
                        </Badge>
                      )}
                      <Badge className="rounded-full" variant="secondary">
                        {it.category}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {it.requires_description ? (
                        <Badge variant="secondary" className="rounded-full">
                          exige descrição
                        </Badge>
                      ) : null}
                      {it.allows_origin ? (
                        <Badge variant="secondary" className="rounded-full">
                          permite origem
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      className="rounded-2xl"
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
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!items.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center">
                    <div className="text-sm font-medium">Nada no catálogo</div>
                    <p className="mt-1 text-xs text-muted-foreground">No onboarding já criamos itens iniciais — verifique seu RLS/seed.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="rounded-3xl max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>

          <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => upsert.mutate(v))}>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input className="rounded-2xl" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) => form.setValue("category", v as Values["category"]) }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="vaccine">vacina</SelectItem>
                    <SelectItem value="medication">medicação</SelectItem>
                    <SelectItem value="other">outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Origem padrão (opcional)</Label>
                <Input className="rounded-2xl" placeholder="nacional / importada" {...form.register("default_origin")} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Exige descrição</div>
                  <div className="text-xs text-muted-foreground">Ex: “Outro”, “Medicações”.</div>
                </div>
                <Switch
                  checked={form.watch("requires_description")}
                  onCheckedChange={(v) => form.setValue("requires_description", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
                <div>
                  <div className="text-sm font-medium">Permite origem/marca</div>
                  <div className="text-xs text-muted-foreground">Ex: anticion com marca.</div>
                </div>
                <Switch checked={form.watch("allows_origin")} onCheckedChange={(v) => form.setValue("allows_origin", v)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">Itens inativos não aparecem no agendamento.</div>
              </div>
              <Switch checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
