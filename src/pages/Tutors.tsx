import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function Tutors() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const tutors = useQuery({
    queryKey: ["tutors", "list", q],
    queryFn: async () => {
      let query = supabase
        .from("tutors")
        .select(
          "id, org_id, branch_id, name, street, number, complement, neighborhood, city, uf, phone1, phone2, notes, tags, contact_consent, is_active, created_at",
        )
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(200);

      const term = q.trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,phone1.ilike.%${term}%,phone2.ilike.%${term}%,city.ilike.%${term}%,neighborhood.ilike.%${term}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Tutor[];
    },
  });

  const rows = useMemo(() => tutors.data ?? [], [tutors.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Base de clientes (tutores)
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tutores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque por nome, telefone ou região. Abra um tutor para gerenciar pets e histórico.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 w-full rounded-[10px] border-[1.5px] pl-9 sm:w-[320px]"
              placeholder="Buscar tutor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button className="h-10 rounded-[10px]" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo tutor
          </Button>
        </div>
      </div>

      <Card className="rounded-[10px] border-[1.5px] border-border p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-5">
        <div className="overflow-hidden rounded-[10px] border-[1.5px] border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Tutor</TableHead>
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
                      <Skeleton className="h-9 w-full rounded-[10px]" />
                    </TableCell>
                  </TableRow>
                ))}

              {(rows ?? []).map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/30"
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
                    <Button asChild variant="secondary" className="h-10 rounded-[10px]" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/appointments/new?tutor=${t.id}`}>Agendar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!tutors.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10">
                    <div className="mx-auto max-w-sm text-center">
                      <div className="text-sm font-medium">Nenhum tutor encontrado</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cadastre o primeiro tutor para começar a agendar.
                      </p>
                      <Button className="mt-4 h-10 rounded-[10px]" onClick={() => setOpenCreate(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo tutor
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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