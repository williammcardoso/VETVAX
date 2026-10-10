import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Building2, MapPin, Phone, Plus, Search, ShieldCheck, Sparkles, Users, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import DuplicateTutorsDialog from "@/components/tutors/DuplicateTutorsDialog";
import PaginationBar from "@/components/vetvax/PaginationBar";
import { buildWhatsAppLink, formatBrPhoneForDisplay } from "@/lib/phone";
import { buildGoogleMapsUrl } from "@/lib/address";
import { matchesSearch, matchesSearchAny } from "@/lib/search";
import { useTutorPets } from "@/lib/useTutorPets";
import PetBadge from "@/components/vetvax/PetBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/vetvax/EmptyState";
import DataToolbar from "@/components/vetvax/DataToolbar";
import RichListItem from "@/components/vetvax/RichListItem";
import MetricTile from "@/components/vetvax/MetricTile";
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
  const [openDuplicates, setOpenDuplicates] = useState(false);

  const tutors = useQuery({
    queryKey: ["tutors", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          "id, org_id, branch_id, name, street, number, complement, neighborhood, city, uf, phone1, phone2, notes, tags, contact_consent, is_active, created_at",
        )
        .eq("is_active", true)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Tutor[];
    },
  });

  const { petNamesOf, matchingPets } = useTutorPets();

  const filteredSorted = useMemo(() => {
    const all = tutors.data ?? [];
    const term = q.trim();
    const filtered = !term
      ? all
      : all.filter((t) => {
          if (filterBy === "name") return matchesSearch(t.name, term) || matchesSearchAny(petNamesOf(t.id), term);
          if (filterBy === "phone") return matchesSearchAny([t.phone1, t.phone2], term);
          if (filterBy === "address") return matchesSearchAny([t.city, t.neighborhood, t.street, t.uf], term);
          return matchesSearchAny([t.name, t.phone1, t.phone2, t.city, t.neighborhood, ...petNamesOf(t.id)], term);
        });

    const sorted = [...filtered];
    if (sortBy === "latest") {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "address") {
      sorted.sort(
        (a, b) =>
          (a.city ?? "").localeCompare(b.city ?? "") ||
          (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "") ||
          a.name.localeCompare(b.name),
      );
    } else {
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
    }
    return sorted;
  }, [tutors.data, q, filterBy, sortBy, petNamesOf]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);
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
      <PageHeader
        badge="Relacionamento"
        title="Clientes"
        description="Busque por nome, telefone ou região. Abra um cliente para gerenciar pets e histórico."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{total} clientes</Badge>
            <Button variant="outline" onClick={() => setOpenDuplicates(true)}>
              <Copy className="mr-1 h-4 w-4" />
              Duplicados
            </Button>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        }
      />

      <DuplicateTutorsDialog open={openDuplicates} onOpenChange={setOpenDuplicates} />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Exibindo na página" value={rows.length} icon={Users} tone="info" />
        <MetricTile label="Com telefone" value={withPhoneCount} icon={Phone} tone="success" />
        <MetricTile label="Com consentimento" value={consentCount} icon={ShieldCheck} tone="default" />
      </section>

      <DataToolbar
        className="rounded-[18px] p-4"
        leading={
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
                        : "Buscar por cliente, pet, telefone ou região..."
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        }
        filters={
          <>
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
          </>
        }
      />

      <Card className="rounded-[18px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
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
            <RichListItem key={t.id} onClick={() => nav(`/tutors/${t.id}`)} className="group">
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
                    {matchingPets(t.id, q).map((pet) => (
                      <PetBadge key={pet} name={pet} />
                    ))}
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
                const mapsUrl = buildGoogleMapsUrl(t);
                return (
                  <a
                    href={mapsUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 flex items-center gap-1.5 pl-12 text-[11px] text-vetvax-text-tertiary hover:text-vetvax-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3 shrink-0 text-sky-500" />
                    <span className="truncate">
                      {loc.street ? `${loc.street} · ` : ""}{loc.region}
                    </span>
                  </a>
                );
              })()}
            </RichListItem>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-vetvax-border-soft pt-3 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-vetvax-text-tertiary">
            <Building2 className="h-3.5 w-3.5" />
            Mostrando {(page - 1) * pageSize + (rows.length ? 1 : 0)}-{(page - 1) * pageSize + rows.length} de {total} clientes
          </p>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
