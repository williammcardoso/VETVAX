import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { CalendarPlus, ClipboardList, MessageCircle, PawPrint, Phone, UserCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Pet, Tutor } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBrPhoneForDisplay, buildWhatsAppLink } from "@/lib/phone";
import { toast } from "@/hooks/use-toast";
import PetUpsertDialog from "@/components/tutors/PetUpsertDialog";
import TutorUpsertDialog from "@/components/tutors/TutorUpsertDialog";

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
      const [apptsRes, remRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, scheduled_date, scheduled_time, status, channel, notes, created_at")
          .eq("tutor_id", tutorId)
          .order("scheduled_date", { ascending: false })
          .limit(15),
        supabase
          .from("reminders")
          .select("id, due_date, status, reminder_type, last_sent_at, send_count, notes, created_at")
          .eq("tutor_id", tutorId)
          .order("due_date", { ascending: false })
          .limit(15),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (remRes.error) throw remRes.error;

      return {
        appointments: apptsRes.data ?? [],
        reminders: remRes.data ?? [],
      };
    },
  });

  const primaryPhone = useMemo(() => {
    const t = tutor.data;
    if (!t) return null;
    return t.phone1 || t.phone2;
  }, [tutor.data]);

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
      <Card className="rounded-3xl p-5">
        <div className="text-sm text-muted-foreground">Carregando tutor…</div>
      </Card>
    );
  }

  if (!t) {
    return (
      <Card className="rounded-3xl p-5">
        <div className="text-sm font-medium">Tutor não encontrado</div>
        <p className="mt-1 text-sm text-muted-foreground">Verifique o link ou volte para a lista.</p>
        <Button asChild className="mt-4 rounded-2xl" variant="secondary">
          <Link to="/tutors">Voltar</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <UserCircle2 className="h-3.5 w-3.5" />
            Tutor
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full">
                {tag}
              </Badge>
            ))}
            {t.contact_consent && <Badge className="rounded-full">consentimento</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="secondary" className="rounded-2xl">
            <Link to={`/appointments/new?tutor=${t.id}`}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Novo agendamento
            </Link>
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => openWhats.mutate()}
            disabled={openWhats.isPending}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Whats
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={() => setOpenEditTutor(true)}>
            Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-3xl p-5 lg:col-span-2">
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
                  <div className="text-muted-foreground">
                    {[t.neighborhood, t.city, t.uf].filter(Boolean).join(" • ")}
                  </div>
                </>
              ) : null}
            </div>
            {t.notes ? (
              <div className="rounded-2xl border bg-muted/20 p-3 text-xs text-muted-foreground">{t.notes}</div>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-3xl p-5">
          <div className="text-sm font-semibold">Atalhos</div>
          <div className="mt-3 grid gap-2">
            <Button asChild className="rounded-2xl">
              <Link to={`/appointments/new?tutor=${t.id}`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Agendar em 20s
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="rounded-2xl"
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
        <TabsList className="rounded-2xl">
          <TabsTrigger value="pets" className="rounded-2xl">
            Pets
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-2xl">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pets" className="mt-4">
          <Card className="rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pets</div>
                <div className="mt-1 text-xs text-muted-foreground">Opcional — vincule itens por pet quando fizer sentido.</div>
              </div>
              <Button
                className="rounded-2xl"
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
                  className="text-left rounded-3xl border bg-card p-4 hover:bg-muted/30"
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
                  </div>
                  {p.notes ? (
                    <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">{p.notes}</div>
                  ) : null}
                </button>
              ))}

              {!pets.isLoading && (pets.data?.length ?? 0) === 0 && (
                <div className="rounded-3xl border bg-muted/10 p-6 text-center sm:col-span-2 lg:col-span-3">
                  <div className="text-sm font-medium">Nenhum pet cadastrado</div>
                  <p className="mt-1 text-xs text-muted-foreground">Você pode cadastrar agora ou seguir usando sem pets.</p>
                  <Button
                    className="mt-4 rounded-2xl"
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
          <Card className="rounded-3xl p-5">
            <div className="text-sm font-semibold">Timeline (últimos 15)</div>
            <div className="mt-4 grid gap-3">
              {(history.data?.appointments ?? []).map((a: any) => (
                <div key={a.id} className="rounded-3xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Agendamento • {a.status}</div>
                    <Badge variant="secondary" className="rounded-full">
                      {a.channel}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.scheduled_date} {a.scheduled_time}
                  </div>
                  {a.notes ? <div className="mt-2 text-xs text-muted-foreground">{a.notes}</div> : null}
                </div>
              ))}

              {(history.data?.reminders ?? []).map((r: any) => (
                <div key={r.id} className="rounded-3xl border bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Lembrete • {r.status}</div>
                    <Badge variant="secondary" className="rounded-full">
                      {r.reminder_type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Vence: {r.due_date}</div>
                  {r.notes ? <div className="mt-2 text-xs text-muted-foreground">{r.notes}</div> : null}
                </div>
              ))}

              {!history.isLoading &&
                (history.data?.appointments?.length ?? 0) === 0 &&
                (history.data?.reminders?.length ?? 0) === 0 && (
                  <div className="rounded-3xl border bg-muted/10 p-6 text-center">
                    <div className="text-sm font-medium">Sem histórico ainda</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Crie um agendamento para este tutor e o sistema começará a construir a timeline.
                    </p>
                    <Button asChild className="mt-4 rounded-2xl">
                      <Link to={`/appointments/new?tutor=${t.id}`}>Novo agendamento</Link>
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
