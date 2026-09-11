import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Building2, MapPin, Phone, Plus, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import { formatBrPhoneForDisplay } from "@/lib/phone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/vetvax/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function locationLabel(t: Tutor) {
  return [t.neighborhood, t.city, t.uf].filter(Boolean).join(" • ") || "Região não informada";
}

function phoneLabel(t: Tutor) {
  const p1 = t.phone1 ? formatBrPhoneForDisplay(t.phone1) : null;
  const p2 = t.phone2 ? formatBrPhoneForDisplay(t.phone2) : null;
  return [p1, p2].filter(Boolean).join(" • ") || "Sem telefone";
}

export default function Tutors() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<"latest" | "name" | "address" | "created_asc">("latest");
  const [openCreate, setOpenCreate] = useState(false);

  const tutors = useQuery({
    queryKey: ["tutors", "list", q, page, pageSize, sortBy],
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
        .range(from, to);

      if (sortBy === "latest") {
        query = query.order("created_at", { ascending: false }).order("name", { ascending: true });
      } else if (sortBy === "name") {
        query = query.order("name", { ascending: true });
      } else if (sortBy === "address") {
        query = query.order("city", { ascending: true }).order("neighborhood", { ascending: true }).order("name", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: true }).order("name", { ascending: true });
      }

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
  const withPhoneCount = useMemo(() => rows.filter((r) => r.phone1 || r.phone2).length, [rows]);
  const consentCount = useMemo(() => rows.filter((r) => r.contact_consent).length, [rows]);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      return next;
    }, { replace: true });
  }, [q, setSearchParams]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-7">
      <PageHeader
        badge="Relacionamento"
        title="Clientes"
        description="Busque por nome, telefone ou região. Abra um cliente para gerenciar pets e histórico."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{total} clientes</Badge>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[16px] border-sky-200/80 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-sky-700">Exibindo na página</p>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-sky-800">{rows.length}</p>
        </Card>
        <Card className="rounded-[16px] border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">Com telefone</p>
            <Phone className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-800">{withPhoneCount}</p>
        </Card>
        <Card className="rounded-[16px] border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-700">Com consentimento</p>
            <ShieldCheck className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-violet-800">{consentCount}</p>
        </Card>
      </section>

      <Card className="rounded-[18px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <div className="mb-4 rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel/90 to-vetvax-surface-alt p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
              <Input className="pl-9" placeholder="Buscar cliente por nome, telefone ou região..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-vetvax-border-soft bg-white px-3 py-2">
              <span className="text-xs font-medium text-vetvax-text-secondary">Ordenar</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Últimos cadastrados</SelectItem>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                  <SelectItem value="address">Endereço</SelectItem>
                  <SelectItem value="created_asc">Data cadastro (antigos)</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-2 text-xs font-medium text-vetvax-text-secondary">Por página</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 20 | 50)}>
                <SelectTrigger className="h-9 w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {tutors.isLoading
            ? Array.from({ length: 8 }).map((_, idx) => <Skeleton key={idx} className="h-[88px] rounded-[14px]" />)
            : null}

          {!tutors.isLoading && rows.length === 0 ? (
            <div className="rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-2">
              <EmptyState
                icon={Users}
                title="Nenhum cliente encontrado"
                description="Cadastre o primeiro cliente para começar a registrar aplicações."
                action={
                  <Button onClick={() => setOpenCreate(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo cliente
                  </Button>
                }
              />
            </div>
          ) : null}

          {rows.map((t) => (
            <article
              key={t.id}
              onClick={() => nav(`/tutors/${t.id}`)}
              className="group cursor-pointer rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-white via-white to-vetvax-surface-panel/50 px-4 py-3 shadow-sm transition-[border-color,box-shadow,transform,background-color] duration-vetvax hover:-translate-y-px hover:border-vetvax-primary-border hover:to-vetvax-surface-panel/85 hover:shadow-vetvax-card"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 border border-vetvax-border-soft bg-white shadow-sm ring-2 ring-vetvax-primary-soft/40">
                    <AvatarFallback className="bg-gradient-to-br from-vetvax-primary-soft to-sky-100 text-xs font-bold text-vetvax-primary">{initials(t.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-vetvax-text-main">{t.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                      {t.contact_consent ? (
                        <Badge variant="info" className="text-[11px]">
                          consentimento
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-vetvax-text-secondary">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate font-medium">{phoneLabel(t)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-vetvax-text-secondary">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                  <span className="truncate font-medium">{locationLabel(t)}</span>
                </div>

                <div className="flex items-center gap-2 justify-self-end" onClick={(e) => e.stopPropagation()}>
                  <Button asChild variant="outline" size="sm" className="h-9">
                    <Link to={`/vaccinations/new?tutor=${t.id}`}>
                      <Sparkles className="mr-1 h-3.5 w-3.5 text-vetvax-primary" />
                      Registrar
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => nav(`/tutors/${t.id}`)}>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-vetvax-border-soft pt-3 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-vetvax-text-tertiary">
            <Building2 className="h-3.5 w-3.5" />
            Mostrando {(page - 1) * pageSize + (rows.length ? 1 : 0)}-{(page - 1) * pageSize + rows.length} de {total} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs font-semibold text-vetvax-text-secondary">Página {page} de {totalPages}</span>
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