import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/vetvax/StatusBadge";
import EmptyState from "@/components/vetvax/EmptyState";
import { Users } from "lucide-react";
import { formatBrPhoneForDisplay } from "@/lib/phone";
import { dayjs } from "@/lib/datetime";
import { toast } from "@/hooks/use-toast";

const DISMISSED_KEY = "vetvax.tutors.dismissedDuplicateGroups";

type TutorRow = {
  id: string;
  name: string;
  phone1: string | null;
  phone2: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
  created_at: string;
};

function normalizePhone(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

function addressLabel(t: TutorRow) {
  return [t.street, t.neighborhood, t.city && t.uf ? `${t.city}/${t.uf}` : t.city || t.uf].filter(Boolean).join(" • ") || "Sem endereço";
}

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissed(keys: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function DuplicateTutorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed());
  const [keeperByGroup, setKeeperByGroup] = useState<Record<string, string>>({});

  const tutors = useQuery({
    queryKey: ["tutors", "duplicate-check"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, name, phone1, phone2, street, neighborhood, city, uf, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TutorRow[];
    },
  });

  const groups = useMemo(() => {
    const byPhone = new Map<string, TutorRow[]>();
    for (const t of tutors.data ?? []) {
      const phone = normalizePhone(t.phone1) || normalizePhone(t.phone2);
      if (!phone || phone.length < 8) continue;
      const list = byPhone.get(phone) ?? [];
      list.push(t);
      byPhone.set(phone, list);
    }
    return Array.from(byPhone.entries())
      .filter(([, list]) => list.length > 1)
      .filter(([phone]) => !dismissed.includes(phone))
      .sort((a, b) => b[1].length - a[1].length);
  }, [tutors.data, dismissed]);

  const merge = useMutation({
    mutationFn: async ({ phone, members, keeperId }: { phone: string; members: TutorRow[]; keeperId: string }) => {
      for (const m of members) {
        if (m.id === keeperId) continue;
        const { error } = await supabase.rpc("merge_tutors", { old_id: m.id, new_id: keeperId });
        if (error) throw error;
      }
      return phone;
    },
    onSuccess: async (phone) => {
      toast({ title: "Clientes mesclados" });
      await qc.invalidateQueries({ queryKey: ["tutors"] });
      await qc.invalidateQueries({ queryKey: ["tutors", "duplicate-check"] });
      setKeeperByGroup((prev) => {
        const next = { ...prev };
        delete next[phone];
        return next;
      });
    },
    onError: (error: unknown) => {
      toast({ title: "Falha ao mesclar", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const dismiss = (phone: string) => {
    const next = [...dismissed, phone];
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-[14px] border-[1.5px] border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Possíveis clientes duplicados
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-vetvax-text-tertiary">
          Agrupado por telefone igual. Escolha qual cadastro manter — os pets, aplicações e lembretes dos outros são movidos para ele, e os
          duplicados são desativados. Essa ação não pode ser desfeita pelo app.
        </p>

        {tutors.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-card-md" />
            ))}
          </div>
        ) : null}

        {!tutors.isLoading && groups.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum duplicado encontrado" description="Não há clientes ativos com o mesmo telefone no momento." />
        ) : null}

        <div className="space-y-4">
          {groups.map(([phone, members]) => {
            const keeperId = keeperByGroup[phone] ?? members[0].id;
            return (
              <div key={phone} className="rounded-[14px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <StatusBadge tone="warning">{formatBrPhoneForDisplay(phone)} • {members.length} cadastros</StatusBadge>
                  <Button variant="ghost" size="sm" onClick={() => dismiss(phone)}>
                    Ignorar
                  </Button>
                </div>

                <RadioGroup value={keeperId} onValueChange={(v) => setKeeperByGroup((prev) => ({ ...prev, [phone]: v }))} className="space-y-2">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-start gap-3 rounded-[10px] border border-vetvax-border-soft bg-white p-3 text-sm has-[:checked]:border-vetvax-primary"
                    >
                      <RadioGroupItem value={m.id} className="mt-1" />
                      <div className="min-w-0">
                        <p className="font-semibold text-vetvax-text-main">{m.name}</p>
                        <p className="text-xs text-vetvax-text-tertiary">{addressLabel(m)}</p>
                        <p className="text-xs text-vetvax-text-tertiary">Cadastrado em {dayjs(m.created_at).format("DD/MM/YYYY")}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>

                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    disabled={merge.isPending}
                    onClick={() => merge.mutate({ phone, members, keeperId })}
                  >
                    Mesclar neste cadastro
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
