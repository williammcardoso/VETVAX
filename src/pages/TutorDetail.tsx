import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Bell, CalendarPlus, ClipboardList, PawPrint, Phone, Syringe, UserCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Pet, Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
          .select("id, due_date, status, reminder_type, item_name, last_sent_at, send_count, notes, created_at")
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
      <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
        <div className="text-sm text-muted-foreground">Carregando tutor…</div>
      </Card>
    );
  }

  if (!t) {
    return (
      <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
        <div className="text-sm font-medium">Tutor não encontrado</div>
        <p className="mt-1 text-sm text-muted-foreground">Verifique o link ou volte para a lista.</p>
        <Button asChild className="mt-4 rounded-[10px]" variant="secondary">
          <Link to="/tutors">Voltar</Link>
        </Button>
      </Card>
    );
  }

  const addressLine = formatTutorAddressLine(t);

  return (
    <div className="vetvax-fade-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <UserCircle2 className="h-3.5 w-3.5" />
            Tutor
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight uppercase">{t.name}</h1>

          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{primaryPhone ? formatBrPhoneForDisplay(primaryPhone) : "—"}</span>
            </div>
            {addressLine ? <div className="text-sm">{addressLine}</div> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {t.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full">
                {tag}
              </Badge>
            ))}
            {t.contact_consent && <Badge className="rounded-full">consentimento</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="secondary" className="rounded-[10px]">
            <Link to={`/vaccinations/new?tutor=${t.id}`}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Registrar aplicação
            </Link>
          </Button>
          <Button variant="secondary" className="rounded-[10px]" onClick={() => openWhats.mutate()} disabled={openWhats.isPending}>
            <WhatsAppIcon className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="ghost" className="rounded-[10px]" onClick={() => setOpenEditTutor(true)}>
            Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="vetvax-card-polish rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)] lg:col-span-2">
          <div className="text-sm font-semibold">Contato e endereço</div>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{t.phone1 ? formatBrPhoneForDisplay(t.phone1) : "—"}</span>
              {t.phone2 ? <span>• {formatBrPhoneForDisplay(t.phone2)}</span> : null}
            </div>
            <div className="text-muted-foreground">
              {[t.street, t.number, t.complement].filter(Boolean).join(", ")}
              {t.neighborhood || t.city || t.uf ? (
                <>
                  <div className="text-muted-foreground">{[t.neighborhood, t.city, t.uf].filter(Boolean).join(" • ")}</div>
                </>
              ) : null}
            </div>
            {t.notes ? <div className="rounded-[10px] border-[1.5px] bg-muted/20 p-3 text-xs text-muted-foreground">{t.notes}</div> : null}
          </div>
        </Card>

        <Card className="vetvax-card-polish rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
          <div className="text-sm font-semibold">Atalhos</div>
          <div className="mt-3 grid gap-2">
            <Button asChild className="rounded-[10px]">
              <Link to={`/vaccinations/new?tutor=${t.id}`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Registrar em 20s
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="rounded-[10px]"
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
          <Card className="rounded-[10px] border-[1.5px] border-border p-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pets</div>
                <div className="mt-1 text-xs text-muted-foreground">Opcional — vincule itens por pet quando fizer sentido.</div>
              </div>
              <Button
                className="rounded-[10px]"
                onClick={() => {
                  setEditingPet(null);
                  setOpenPet(true);
                }}
              >
                <PawPrint className="mr-2 h-4 w-4" />
                Novo pet
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(pets.data ?? []).map((p) => (
                <button
                  key={p.id}
                  className="text-left rounded-[10px] border-[1.5px] border-border bg-card p-4 hover:bg-muted/30"
                  onClick={() => {
                    setEditingPet(p);
                    setOpenPet(true);
                  }}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.species}
                    {p.age_text ? ` • ${p.age_text}` : ""}
                    {p.breed ? ` • ${p.breed}` : ""}
                    {p.color ? ` • ${p.color}` : ""}
                  </div>
                  {p.notes ? <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">{p.notes}</div> : null}
                </button>
              ))}

              {!pets.isLoading && (pets.data?.length ?? 0) === 0 && (
                <div className="rounded-[10px] border-[1.5px] border-border bg-muted/10 p-6 text-center sm:col-span-2 lg:col-span-3">
                  <div className="text-sm font-medium">Nenhum pet cadastrado</div>
                  <p className="mt-1 text-xs text-muted-foreground">Você pode cadastrar agora ou seguir usando sem pets.</p>
                  <Button
                    className="mt-4 rounded-[10px]"
                    onClick={() => {
                      setEditingPet(null);
                      setOpenPet(true);
                    }}
                  >
                    Cadastrar pet
                  </Button>
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
                        <p className="mt-1 text-xs font-semibold text-vetvax-text-secondary">{r.item_name ?? r.reminder_type}</p>
                        {r.notes ? <p className="mt-1 text-xs italic text-vetvax-text-tertiary">{r.notes}</p> : null}
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