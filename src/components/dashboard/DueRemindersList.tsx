import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import type { DueReminderRow } from "@/types/vetvax";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { buildWhatsAppLink } from "@/lib/phone";
import { daysDiffFromToday, formatDateBr } from "@/lib/datetime";
import { supabase } from "@/lib/supabase";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

function statusTone(diff: number) {
  if (diff < 0) return { bar: "border-l-[#DC2626]", dot: "bg-[#DC2626]" };
  return { bar: "border-l-[#16A34A]", dot: "bg-[#16A34A]" };
}

export default function DueRemindersList({
  rows,
  loading,
  onChanged,
}: {
  rows: DueReminderRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { buildReminderMessage, pickPhone } = useWhatsMessage();

  const rowsWithDiff = useMemo(() => {
    return rows.map((r) => ({ r, diff: daysDiffFromToday(r.due_date) }));
  }, [rows]);

  const openWhats = useMutation({
    mutationFn: async (row: DueReminderRow) => {
      const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
      if (!phone) throw new Error("Tutor sem telefone");

      if (row.last_sent_at) {
        const last = new Date(row.last_sent_at).getTime();
        const hours = (Date.now() - last) / (1000 * 60 * 60);
        if (hours < 24) throw new Error("Envio recente (menos de 24h). Aguarde para reenviar.");
      }

      const msg = await buildReminderMessage(row);

      await supabase
        .from("reminders")
        .update({
          last_sent_at: new Date().toISOString(),
          send_count: (row.send_count ?? 0) + 1,
        })
        .eq("id", row.id);

      window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
    },
    onSuccess: () => onChanged(),
    onError: (e: any) => {
      toast({
        title: "Não foi possível abrir o WhatsApp",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "FEITO" | "ARQUIVADO" }) => {
      const { error } = await supabase.from("reminders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
    onError: (e: any) => {
      toast({
        title: "Falha ao atualizar lembrete",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="divide-y divide-border">
      {loading &&
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3">
            <Skeleton className="h-14 w-full rounded-[10px]" />
          </div>
        ))}

      {!loading && rowsWithDiff.length === 0 && (
        <div className="p-8 text-center">
          <div className="text-sm font-semibold">Tudo em dia</div>
          <div className="mt-1 text-xs text-muted-foreground">Sem lembretes pendentes no momento.</div>
        </div>
      )}

      {rowsWithDiff.map(({ r, diff }) => {
        const tone = statusTone(diff);
        const subtitle = r.pet_name ? `${r.reminder_type} • ${r.pet_name}` : r.reminder_type;
        const lastSentRecently = r.last_sent_at
          ? (Date.now() - new Date(r.last_sent_at).getTime()) / (1000 * 60 * 60) < 24
          : false;

        return (
          <div key={r.id} className={`flex gap-3 border-l-4 ${tone.bar} p-3`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    <div className="text-[13px] font-semibold text-foreground">{formatDateBr(r.due_date)}</div>
                  </div>
                  <div className="mt-1 truncate text-[13px] font-semibold">{r.tutor_name}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-[10px] border-[1.5px]"
                    onClick={() => openWhats.mutate(r)}
                    disabled={openWhats.isPending || lastSentRecently}
                    title={lastSentRecently ? "Envio recente (menos de 24h)" : "WhatsApp"}
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" className="h-9 w-9 rounded-[10px] border-[1.5px]">
                        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-[10px]">
                      <DropdownMenuItem className="rounded-[8px]" onClick={() => setStatus.mutate({ id: r.id, status: "FEITO" })}>
                        Marcar como resolvido
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-[8px]" onClick={() => setStatus.mutate({ id: r.id, status: "ARQUIVADO" })}>
                        Arquivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}