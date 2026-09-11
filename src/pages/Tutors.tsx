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
import { buildWhatsAppLink, formatBrPhoneForDisplay } from "@/lib/phone";
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
  const street = [t.street, t.number, t.complement ? `- ${t.complement}` : null]
    .filter(Boolean).join(", ");
  const region = [
    t.neighborhood,
    t.city && t.uf ? `${t.city}/${t.uf}` : t.city || t.uf
  ].filter(Boolean).join(" • ");
  return { street: street || null, region: region || null };
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
  const filterByFromUrl = searchParams.get("filterBy");
  const initialFilterBy = filterByFromUrl === "name" || filterByFromUrl === "phone" || filterByFromUrl === "address" ? filterByFromUrl : "all";

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [filterBy, setFilterBy] = useState<"all" | "name" | "phone" | "address">(initialFilterBy);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<"latest" | "name" | "address" | "created_asc">("latest");
  const [openCreate, setOpenCreate] = useState(false);

  const tutors = useQuery({
    queryKey: ["tutors", "list", q, filterBy, page, pageSize, sortBy],
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
        const searchByFilter: Record<typeof filterBy, string> = {
          all: `name.ilike.%${term}%,phone1.ilike.%${term}%,phone2.ilike.%${term}%,city.ilike.%${term}%,neighborhood.ilike.%${term}%`,
          name: `name.ilike.%${term}%`,
          phone: `phone1.ilike.%${term}%,phone2.ilike.%${term}%`,
          address: `city.ilike.%${term}%,neighborhood.ilike.%${term}%,street.ilike.%${term}%,uf.ilike.%${term}%`,
        };
        query = query.or(searchByFilter[filterBy]);
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
  }, [q, filterBy, pageSize]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      if (filterBy === "all") next.delete("filterBy");
      else next.set("filterBy", filterBy);
      return next;
    }, { replace: true });
  }, [q, filterBy, setSearchParams]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-7">
      <style>
        {`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes countUp {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-up-1 { animation: fadeUp .45s cubic-bezier(.22,.68,0,1.2) .05s forwards; }
          .animate-fade-up-2 { animation: fadeUp .45s cubic-bezier(.22,.68,0,1.2) .15s forwards; }
          .animate-fade-up-3 { animation: fadeUp .45s cubic-bezier(.22,.68,0,1.2) .25s forwards; }
          .animate-count-up { animation: countUp .5s cubic-bezier(.22,.68,0,1.2) .35s forwards; }
        `}
      </style>
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
        <Card className="group rounded-[14px] border-[1.5px] border-[#378ADD] bg-[#E6F1FB] p-4 opacity-0 transition-[transform,box-shadow] duration-[180ms] ease-[ease] hover:-translate-y-[3px] hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.13)] animate-fade-up-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#185FA5]">Exibindo na página</p>
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#B5D4F4] text-[#0C447C] transition-transform duration-[180ms] group-hover:scale-110">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-[30px] font-medium tabular-nums text-[#0C447C] opacity-0 animate-count-up">{rows.length}</p>
        </Card>
        <Card className="group rounded-[14px] border-[1.5px] border-[#3B6D11] bg-[#EAF3DE] p-4 opacity-0 transition-[transform,box-shadow] duration-[180ms] ease-[ease] hover:-translate-y-[3px] hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.13)] animate-fade-up-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3B6D11]">Com telefone</p>
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#C0DD97] text-[#27500A] transition-transform duration-[180ms] group-hover:scale-110">
              <Phone className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-[30px] font-medium tabular-nums text-[#27500A] opacity-0 animate-count-up">{withPhoneCount}</p>
        </Card>
        <Card className="group rounded-[14px] border-[1.5px] border-[#534AB7] bg-[#EEEDFE] p-4 opacity-0 transition-[transform,box-shadow] duration-[180ms] ease-[ease] hover:-translate-y-[3px] hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.13)] animate-fade-up-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#534AB7]">Com consentimento</p>
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#CECBF6] text-[#3C3489] transition-transform duration-[180ms] group-hover:scale-110">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-1 text-[30px] font-medium tabular-nums text-[#3C3489] opacity-0 animate-count-up">{consentCount}</p>
        </Card>
      </section>

      <Card className="rounded-[18px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
        <div className="mb-4 rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-vetvax-surface-panel/90 to-vetvax-surface-alt p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <Select value={filterBy} onValueChange={(v) => setFilterBy(v as typeof filterBy)}>
                <SelectTrigger className="h-10 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campos</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="address">Endereço</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full md:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vetvax-text-tertiary" />
                <Input
                  className="pl-9"
                  placeholder={
                    filterBy === "name"
                      ? "Digite o nome do cliente..."
                      : filterBy === "phone"
                        ? "Digite o telefone..."
                        : filterBy === "address"
                          ? "Digite cidade, bairro ou rua..."
                          : "Buscar por nome, telefone ou região..."
                  }
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto rounded-[12px] border border-vetvax-border-soft bg-white px-2 py-1.5">
              <span className="text-xs font-medium text-vetvax-text-secondary">Ordenar</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-9 w-[148px] text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Mais recentes</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                  <SelectItem value="address">Endereço</SelectItem>
                  <SelectItem value="created_asc">Mais antigos</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-2 whitespace-nowrap text-xs font-medium text-vetvax-text-secondary">/ pág</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 20 | 50)}>
                <SelectTrigger className="h-9 w-[72px]">
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

        <div className="space-y-3">
          {tutors.isLoading
            ? Array.from({ length: 8 }).map((_, idx) => <Skeleton key={idx} className="h-[64px] rounded-[14px]" />)
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
              className="group cursor-pointer rounded-[14px] border border-[#CBD5E1] bg-white px-4 py-3 shadow-sm transition-[border-color,box-shadow,transform] duration-vetvax hover:-translate-y-px hover:border-vetvax-primary-border hover:shadow-vetvax-card"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0 border border-vetvax-border-soft bg-white shadow-sm ring-2 ring-vetvax-primary-soft/40">
                  <AvatarFallback className="bg-gradient-to-br from-vetvax-primary-soft to-sky-100 text-xs font-bold text-vetvax-primary">
                    {initials(t.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-vetvax-text-main">{t.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {(t.phone1 || t.phone2) && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <Phone className="h-3 w-3 shrink-0" />
                        {phoneLabel(t)}
                      </span>
                    )}
                    {t.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                    {t.contact_consent && (
                      <Badge variant="info" className="text-[10px]">consentimento</Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {(t.phone1 || t.phone2) && (
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      <a
                        href={buildWhatsAppLink(t.phone1 ?? t.phone2 ?? "", `Olá ${t.name}, tudo bem?`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="h-8 hidden sm:flex">
                    <Link to={`/vaccinations/new?tutor=${t.id}`}>
                      <Sparkles className="mr-1 h-3.5 w-3.5 text-vetvax-primary" />
                      Registrar
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="icon" className="h-8 w-8 sm:hidden">
                    <Link to={`/vaccinations/new?tutor=${t.id}`}>
                      <Sparkles className="h-3.5 w-3.5 text-vetvax-primary" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => nav(`/tutors/${t.id}`)}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {(() => {
                const loc = locationLabel(t);
                if (!loc.street && !loc.region) return null;
                return (
                  <div className="mt-1.5 flex items-center gap-1.5 pl-12 text-[11px] text-vetvax-text-tertiary">
                    <MapPin className="h-3 w-3 shrink-0 text-sky-500" />
                    <span className="truncate">
                      {loc.street ? `${loc.street} · ` : ""}{loc.region}
                    </span>
                  </div>
                );
              })()}
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
