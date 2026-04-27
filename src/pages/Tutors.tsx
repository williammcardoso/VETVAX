import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import { formatBrPhoneForDisplay } from "@/lib/phone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/vetvax/EmptyState";

export default function Tutors() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [openCreate, setOpenCreate] = useState(false);

  const tutors = useQuery({
    queryKey: ["tutors", "list", q, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("tutors")
        .select(
          "id, org_id, branch_id, name, street, number, complement, neighborhood, city, uf, phone1, phone2, notes, tags, contact_consent, is_active, created_at",
          { count: "exact" },
        )
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(from, to);

      const term = q.trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,phone1.ilike.%${term}%,phone2.ilike.%${term}%,city.ilike.%${term}%,neighborhood.ilike.%${term}%`,
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return {
        rows: (data ?? []) as Tutor[],
        count: count ?? 0,
      };
    },
  });

  const rows = useMemo(() => tutors.data?.rows ?? [], [tutors.data?.rows]);
  const total = tutors.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Relacionamento"
        title="Clientes"
        description="Busque por nome, telefone ou região. Abra um cliente para gerenciar pets e histórico."
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      <Card className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
            <Input
              className="pl-9"
              placeholder="Buscar cliente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-vetvax-text-tertiary">Por página</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 20 | 50)}>
              <SelectTrigger className="w-[96px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-hidden rounded-card-md border border-vetvax-border-soft">
          <Table>
            <TableHeader>
              <TableRow className="bg-vetvax-surface-alt">
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Contato</TableHead>
                <TableHead className="hidden lg:table-cell">Região</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tutors.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-10 w-full rounded-control" />
                    </TableCell>
                  </TableRow>
                ))}

              {(rows ?? []).map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-vetvax-surface-alt"
                  onClick={() => nav(`/tutors/${t.id}`)}
                >
                  <TableCell>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                      {t.contact_consent && (
                        <Badge className="rounded-full text-[11px]">consentimento</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-xs text-muted-foreground">
                      {t.phone1 ? formatBrPhoneForDisplay(t.phone1) : "—"}
                      {t.phone2 ? ` • ${formatBrPhoneForDisplay(t.phone2)}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-xs text-muted-foreground">
                      {[t.neighborhood, t.city, t.uf].filter(Boolean).join(" • ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/appointments/new?tutor=${t.id}`}>Agendar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!tutors.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10">
                    <EmptyState
                      icon={Users}
                      title="Nenhum cliente encontrado"
                      description="Cadastre o primeiro cliente para começar a agendar."
                      action={
                        <Button onClick={() => setOpenCreate(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Novo cliente
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-vetvax-text-tertiary">
            Mostrando {(page - 1) * pageSize + (rows.length ? 1 : 0)}-{(page - 1) * pageSize + rows.length} de {total} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs font-semibold text-vetvax-text-secondary">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <TutorUpsertDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        initial={null}
        onSaved={async (id) => {
          await qc.invalidateQueries({ queryKey: ["tutors"] });
          setOpenCreate(false);
          nav(`/tutors/${id}`);
        }}
      />
    </div>
  );
}