import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Bell, CalendarPlus, Cat, ClipboardList, Dog, MapPin, PawPrint, Pencil, Phone, Plus, ShieldCheck, Syringe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Pet, Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBrPhoneForDisplay, buildWhatsAppLink } from "@/lib/phone";
import { formatDateBr } from "@/lib/datetime";
import { toast } from "@/hooks/use-toast";
import PetUpsertDialog from "@/components/tutors/PetUpsertDialog";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { formatTutorAddressLine } from "@/lib/address";
import StatusBadge from "@/components/vetvax/StatusBadge";
import RichListItem from "@/components/vetvax/RichListItem";
import EmptyState from "@/components/vetvax/EmptyState";

function speciesMeta(species: Pet["species"]) {
  if (species === "dog") {
    return { label: "Cão", Icon: Dog, tone: "border-sky-200 bg-sky-50 text-sky-700" };
  }
  if (species === "cat") {
    return { label: "Gato", Icon: Cat, tone: "border-violet-200 bg-violet-50 text-violet-700" };
  }
  return { label: "Outro", Icon: PawPrint, tone: "border-slate-200 bg-slate-50 text-slate-700" };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getItemTone(itemName: string) {
  const palette = [
    "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]",
    "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    "border-[#a7f3d0] bg-[#ecfeff] text-[#0f766e]",
    "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
  ];
  const value = itemName.toLowerCase();
  if (value.includes("v8") || value.includes("v10") || value.includes("polivalente")) return "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]";
  if (value.includes("raiva") || value.includes("antirr")) return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  if (value.includes("giardia") || value.includes("verm")) return "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]";
  if (value.includes("lepto") || value.includes("gripe") || value.includes("influenza")) return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
  if (value.includes("fiv") || value.includes("felv")) return "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

type TimelineEntry =
  | { kind: "record"; date: string; sortKey: string; data: any }
  | { kind: "reminder"; date: string; sortKey: string; data: any };

export default function TutorDetail() {
  const { id } = useParams();
  const tutorId = id as string;
  const qc = useQueryClient();

  const [openPet, setOpenPet] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [openEditTutor, setOpenEditTutor] = useState(false);

  const tutor = useQuery({
    queryKey: ["tutors", tutorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          "id, org_id, branch_id, name, street, number, complement, neighborhood, city, uf, phone1, phone2, notes, tags, contact_consent, is_active, created_at",
        )
        .eq("id", tutorId)
        .maybeSingle();
      if (error) throw error;
      return data as Tutor | null;
    },
  });

  const pets = useQuery({
    queryKey: ["pets", "byTutor", tutorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, org_id, tutor_id, name, species, age_text, birth_date, breed, color, notes, is_active")
        .eq("tutor_id", tutorId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pet[];
    },
  });

  const history = useQuery({
    queryKey: ["tutors", tutorId, "history"],
    queryFn: async () => {
      const [recordsRes, remRes] = await Promise.all([
        supabase
          .from("vw_vaccination_records")
          .select("id, applied_date, next_due_date, notes, items")
          .eq("tutor_id", tutorId)
          .order("applied_date", { ascending: false })
          .limit(15),
        supabase
          .from("reminders")
          .select("id, due_date, status, reminder_type, item_name, last_sent_at, send_count, notes, created_at, pet:pets(name)")
          .eq("tutor_id", tutorId)
          .order("due_date", { ascending: false })
          .limit(15),
      ]);

      if (recordsRes.error) throw recordsRes.error;
      if (remRes.error) throw remRes.error;

      return {
        records: recordsRes.data ?? [],
        reminders: remRes.data ?? [],
      };
    },
  });

  const primaryPhone = useMemo(() => {
    const t = tutor.data;
    if (!t) return null;
    return t.phone1 || t.phone2;
  }, [tutor.data]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const records = (history.data?.records ?? []).map((r: any) => ({
      kind: "record" as const,
      date: r.applied_date,
      sortKey: `${r.applied_date}Z`,
      data: r,
    }));
    const reminders = (history.data?.reminders ?? []).map((r: any) => ({
      kind: "reminder" as const,
      date: r.due_date,
      sortKey: `${r.due_date}A`,
      data: r,
    }));
    return [...records, ...reminders].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [history.data]);

  const openWhats = useMutation({
    mutationFn: async () => {
      const t = tutor.data;
      if (!t) throw new Error("Tutor não carregado");
      const phone = t.phone1 || t.phone2;
      if (!phone) throw new Error("Tutor sem telefone");
      const message = `Olá ${t.name}! Aqui é da VetVAX. Podemos ajudar com um novo agendamento?`;
      window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => {
      toast({ title: "Falha ao abrir Whats", description: e?.message, variant: "destructive" });
    },
  });

  const t = tutor.data;

  if (tutor.isLoading) {
    return (
      <Card className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <div className="text-sm text-vetvax-text-tertiary">Carregando tutor…</div>
      </Card>
    );
  }

  if (!t) {
    return (
      <Card className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <div className="text-sm font-medium text-vetvax-text-main">Tutor não encontrado</div>
        <p className="mt-1 text-sm text-vetvax-text-tertiary">Verifique o link ou volte para a lista.</p>
        <Button asChild className="mt-4 rounded-[10px]" variant="secondary">
          <Link to="/tutors">Voltar</Link>
        </Button>
      </Card>
    );
  }

  const addressLine = formatTutorAddressLine(t);

  return (
    <div className="vetvax-fade-in space-y-6">
      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#0d4f4a] p-6 text-white shadow-vetvax-card ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0 border border-white/20 bg-white/10 shadow-lg">
              <AvatarFallback className="bg-transparent text-lg font-bold text-white">{initials(t.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                Tutor
              </span>
              <h1 className="mt-1.5 truncate text-2xl font-bold tracking-tight text-white">{t.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/75">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {primaryPhone ? formatBrPhoneForDisplay(primaryPhone) : "—"}
                </span>
                {addressLine ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {addressLine}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.tags?.map((tag) => (
                  <Badge key={tag} className="rounded-pill border-white/15 bg-white/10 text-white hover:bg-white/10">
                    {tag}
                  </Badge>
                ))}
                {t.contact_consent && (
                  <Badge className="rounded-pill border-transparent bg-vetvax-success-soft text-vetvax-success">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    consentimento
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="rounded-control bg-white text-vetvax-text-main hover:bg-white/90">
              <Link to={`/vaccinations/new?tutor=${t.id}`}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Registrar aplicação
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-control border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => openWhats.mutate()}
              disabled={openWhats.isPending}
            >
              <WhatsAppIcon className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              variant="ghost"
              className="rounded-control text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => setOpenEditTutor(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02] lg:col-span-2">
          <h2 className="vetvax-section-title">Contato e endereço</h2>
          <div className="mt-3 grid gap-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-vetvax-text-secondary">
              <Phone className="h-4 w-4 text-vetvax-primary" />
              <span>{t.phone1 ? formatBrPhoneForDisplay(t.phone1) : "—"}</span>
              {t.phone2 ? <span>• {formatBrPhoneForDisplay(t.phone2)}</span> : null}
            </div>
            <div className="flex items-start gap-2 text-vetvax-text-secondary">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <div>
                <div>{[t.street, t.number, t.complement].filter(Boolean).join(", ") || "—"}</div>
                {t.neighborhood || t.city || t.uf ? (
                  <div className="text-vetvax-text-tertiary">{[t.neighborhood, t.city, t.uf].filter(Boolean).join(" • ")}</div>
                ) : null}
              </div>
            </div>
            {t.notes ? (
              <div className="rounded-[10px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-3 text-xs italic text-vetvax-text-tertiary">
                {t.notes}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <h2 className="vetvax-section-title">Atalhos</h2>
          <div className="mt-3 grid gap-2">
            <Button asChild className="rounded-control">
              <Link to={`/vaccinations/new?tutor=${t.id}`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Registrar em 20s
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="rounded-control"
              onClick={() => {
                setEditingPet(null);
                setOpenPet(true);
              }}
            >
              <PawPrint className="mr-2 h-4 w-4" />
              Cadastrar pet
            </Button>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="pets">
        <TabsList className="rounded-[10px]">
          <TabsTrigger value="pets" className="rounded-[10px]">
            Pets
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-[10px]">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pets" className="mt-4">
          <Card className="rounded-[16px] border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="vetvax-section-title">Pets</h2>
                <p className="mt-1 text-xs text-vetvax-text-tertiary">Opcional — vincule itens por pet quando fizer sentido.</p>
              </div>
              <Button
                className="rounded-control"
                onClick={() => {
                  setEditingPet(null);
                  setOpenPet(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo pet
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(pets.data ?? []).map((p) => {
                const meta = speciesMeta(p.species);
                const Icon = meta.Icon;
                return (
                  <button
                    key={p.id}
                    className="group relative text-left rounded-[14px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-vetvax hover:-translate-y-px hover:border-vetvax-primary-border hover:shadow-vetvax-card"
                    onClick={() => {
                      setEditingPet(p);
                      setOpenPet(true);
                    }}
                  >
                    <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 text-vetvax-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-start gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border ${meta.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-vetvax-text-main">{p.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-[10px]">{meta.label}</Badge>
                          {p.age_text ? <Badge variant="secondary" className="text-[10px]">{p.age_text}</Badge> : null}
                          {p.breed ? <Badge variant="secondary" className="text-[10px]">{p.breed}</Badge> : null}
                          {p.color ? <Badge variant="secondary" className="text-[10px]">{p.color}</Badge> : null}
                        </div>
                      </div>
                    </div>
                    {p.notes ? <p className="mt-3 line-clamp-2 text-xs italic text-vetvax-text-tertiary">{p.notes}</p> : null}
                  </button>
                );
              })}

              {!pets.isLoading && (pets.data?.length ?? 0) === 0 && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState
                    icon={PawPrint}
                    title="Nenhum pet cadastrado"
                    description="Você pode cadastrar agora ou seguir usando sem pets."
                    action={
                      <Button
                        onClick={() => {
                          setEditingPet(null);
                          setOpenPet(true);
                        }}
                      >
                        Cadastrar pet
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="rounded-[16px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
            <div className="flex items-center justify-between">
              <h2 className="vetvax-section-title">Linha do tempo</h2>
              <StatusBadge>{timeline.length} registro(s)</StatusBadge>
            </div>

            <div className="mt-4 grid gap-3">
              {timeline.map((entry) => {
                if (entry.kind === "record") {
                  const r = entry.data;
                  return (
                    <RichListItem key={`rec-${r.id}`} className="!min-h-0 border-vetvax-success-soft/70 bg-gradient-to-r from-white to-vetvax-success-soft/20">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-vetvax-success-soft text-vetvax-success">
                          <Syringe className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-vetvax-text-main">
                              Aplicação registrada <span className="font-normal text-vetvax-text-tertiary">· {formatDateBr(r.applied_date)}</span>
                            </p>
                            {r.next_due_date ? (
                              <StatusBadge tone="warning">próxima: {formatDateBr(r.next_due_date)}</StatusBadge>
                            ) : null}
                          </div>
                          {r.items?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {r.items.map((it: any, idx: number) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-[11px] font-bold leading-none ${getItemTone(it.item)}`}
                                >
                                  {it.quantity}x {it.item}
                                  {it.pet_name ? ` • ${it.pet_name}` : ""}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {r.notes ? <p className="mt-2 text-xs italic text-vetvax-text-tertiary">{r.notes}</p> : null}
                        </div>
                      </div>
                    </RichListItem>
                  );
                }

                const r = entry.data;
                const reminderTone = r.status === "ATIVO" ? "warning" : r.status === "FEITO" ? "success" : "default";
                return (
                  <RichListItem key={`rem-${r.id}`} className="!min-h-0">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-vetvax-warning-soft text-vetvax-warning">
                        <Bell className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-vetvax-text-main">
                            Lembrete <span className="font-normal text-vetvax-text-tertiary">· vence {formatDateBr(r.due_date)}</span>
                          </p>
                          <StatusBadge tone={reminderTone as "warning" | "success" | "default"}>
                            {r.status === "ATIVO" ? "ativo" : r.status === "FEITO" ? "resolvido" : "arquivado"}
                          </StatusBadge>
                        </div>
                        <span
                          className={`mt-1.5 inline-flex items-center rounded-pill border px-2.5 py-1 text-[11px] font-bold leading-none ${getItemTone(r.item_name ?? r.reminder_type)}`}
                        >
                          {r.pet?.name ? `${r.pet.name} • ` : ""}
                          {r.item_name ?? r.reminder_type}
                        </span>
                        {r.notes ? <p className="mt-2 text-xs italic text-vetvax-text-tertiary">{r.notes}</p> : null}
                      </div>
                    </div>
                  </RichListItem>
                );
              })}

              {!history.isLoading && timeline.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-vetvax-border-soft bg-vetvax-surface-panel/60 p-6 text-center">
                  <div className="text-sm font-medium">Sem histórico ainda</div>
                  <p className="mt-1 text-xs text-vetvax-text-tertiary">
                    Registre uma aplicação para este tutor e o sistema começará a construir a timeline.
                  </p>
                  <Button asChild className="mt-4 rounded-[10px]">
                    <Link to={`/vaccinations/new?tutor=${t.id}`}>Registrar aplicação</Link>
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <PetUpsertDialog
        open={openPet}
        onOpenChange={(v) => {
          setOpenPet(v);
          if (!v) setEditingPet(null);
        }}
        tutorId={tutorId}
        initial={editingPet}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ["pets", "byTutor", tutorId] });
          setOpenPet(false);
          setEditingPet(null);
        }}
      />

      <TutorUpsertDialog
        open={openEditTutor}
        onOpenChange={setOpenEditTutor}
        initial={t}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ["tutors", tutorId] });
          setOpenEditTutor(false);
        }}
      />
    </div>
  );
}