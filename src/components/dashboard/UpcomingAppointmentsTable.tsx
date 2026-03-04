import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, RotateCcw, Syringe, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { UpcomingAppointmentRow } from "@/types/vetvax";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBr, formatTimeBr } from "@/lib/datetime";
import CheckoutDialog from "@/components/dashboard/CheckoutDialog";
import RescheduleDialog from "@/components/dashboard/RescheduleDialog";
import { buildWhatsAppLink, formatBrPhoneForDisplay } from "@/lib/phone";
import { toast } from "@/hooks/use-toast";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { formatTutorAddressLine } from "@/lib/address";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

type Variant = "today" | "compact";

export default function UpcomingAppointmentsTable({
  rows,
  loading,
  onChanged,
  variant = "today",
}: {
  rows: UpcomingAppointmentRow[];
  loading: boolean;
  onChanged: () => void;
  variant?: Variant;
}) {
  const nav = useNavigate();

  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const { buildAppointmentMessage, pickPhone } = useWhatsMessage();

  const empty = !loading && rows.length === 0;
  const isCompact = variant === "compact";

  const openWhats = useMutation({
    mutationFn: async (row: UpcomingAppointmentRow) => {
      const phone = pickPhone(row.tutor_phone1, row.tutor_phone2);
      if (!phone) throw new Error("Tutor sem telefone");
      const msg = await buildAppointmentMessage(row);
      window.open(buildWhatsAppLink(phone, msg), "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => {
      toast({
        title: "Não foi possível abrir o WhatsApp",
        description: e?.message ?? "Verifique telefone do tutor.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="overflow-hidden rounded-[10px] border-[1.5px] border-border bg-card shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className={isCompact ? "w-[160px]" : "w-[140px]"}>{isCompact ? "Quando" : "Data"}</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead className="hidden sm:table-cell">Itens</TableHead>
            <TableHead className="w-[56px]"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="[&_tr]:border-0">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-10 w-full rounded-md" />
                </TableCell>
              </TableRow>
            ))}

          {rows.map((row) => {
            const displayPhone = row.tutor_phone1 || row.tutor_phone2 ? formatBrPhoneForDisplay(row.tutor_phone1 ?? row.tutor_phone2) : "—";
            const address = formatTutorAddressLine(row as any);

            return (
              <TableRow key={row.id} className="group transition-colors hover:bg-slate-50">
                <TableCell className="align-top py-4">
                  <div className="text-xs font-semibold text-foreground">{formatDateBr(row.scheduled_date)}</div>
                  <div className="mt-1 text-[12px] font-bold text-primary">{formatTimeBr(row.scheduled_time)}</div>
                </TableCell>

                <TableCell className="align-top py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
                      {initials(row.tutor_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold leading-tight text-foreground">{row.tutor_name}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{displayPhone}</div>
                      {address ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{address}</div> : null}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="hidden sm:table-cell align-top py-4">
                  {row.items?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.items.slice(0, 4).map((it, idx) => (
                        <Badge key={idx} variant="secondary" className="rounded-full border-[1.5px] border-slate-300 bg-white text-slate-800">
                          {it.quantity}× {it.item}
                        </Badge>
                      ))}
                      {(row.items?.length ?? 0) > 4 && (
                        <Badge className="rounded-full border-[1.5px] border-slate-300 bg-white text-slate-800">+{(row.items?.length ?? 0) - 4}</Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-right align-top py-4">
                  <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-[10px]">
                          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-[10px]">
                        <DropdownMenuItem className="rounded-[8px]" onClick={() => setCheckoutId(row.id)}>
                          <Syringe className="mr-2 h-4 w-4" strokeWidth={2} />
                          Dar baixa
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-[8px]" onClick={() => setRescheduleId(row.id)}>
                          <RotateCcw className="mr-2 h-4 w-4" strokeWidth={2} />
                          Reagendar (duplicar)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-[8px]" onClick={() => openWhats.mutate(row)} disabled={openWhats.isPending}>
                          <WhatsAppIcon className="mr-2 h-4 w-4" />
                          WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-[8px]" onClick={() => nav(`/tutors/${row.tutor_id}`)}>
                          Ver tutor
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {empty && (
            <TableRow>
              <TableCell colSpan={4} className="py-12">
                <div className="mx-auto max-w-sm text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <XCircle className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="mt-3 text-sm font-semibold">
                    {variant === "today" ? "Nenhum agendamento hoje" : "Nenhum agendamento futuro"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {variant === "today" ? "Se precisar, crie um novo agendamento." : "Quando houver agendamentos, eles aparecerão aqui em ordem cronológica."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <CheckoutDialog
        open={!!checkoutId}
        appointmentId={checkoutId}
        onOpenChange={(v) => !v && setCheckoutId(null)}
        onChanged={() => {
          setCheckoutId(null);
          onChanged();
        }}
      />

      <RescheduleDialog
        open={!!rescheduleId}
        appointmentId={rescheduleId}
        onOpenChange={(v) => !v && setRescheduleId(null)}
        onChanged={() => {
          setRescheduleId(null);
          onChanged();
        }}
      />
    </div>
  );
}