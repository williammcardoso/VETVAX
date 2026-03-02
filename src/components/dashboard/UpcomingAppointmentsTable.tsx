import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, Phone, RotateCcw, Syringe, XCircle } from "lucide-react";
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
import { buildWhatsAppLink } from "@/lib/phone";
import { toast } from "@/hooks/use-toast";
import { useWhatsMessage } from "@/components/dashboard/useWhatsMessage";

function channelLabel(c: UpcomingAppointmentRow["channel"]) {
  if (c === "store") return "Loja";
  if (c === "phone") return "Telefone";
  if (c === "whatsapp") return "Whats";
  return "Outro";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export default function UpcomingAppointmentsTable({
  rows,
  loading,
  onChanged,
}: {
  rows: UpcomingAppointmentRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const nav = useNavigate();

  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const { buildAppointmentMessage, pickPhone } = useWhatsMessage();

  const empty = !loading && rows.length === 0;

  const summary = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      r.items?.forEach((it) => {
        map.set(it.item, (map.get(it.item) ?? 0) + (it.quantity ?? 0));
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [rows]);

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
    <div className="space-y-3">
      {summary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <Syringe className="h-3.5 w-3.5 text-primary" />
            Top itens no período:
          </span>
          {summary.map(([name, qty]) => (
            <Badge key={name} variant="secondary" className="rounded-full bg-muted text-muted-foreground">
              {name} • {qty}
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[130px]">Quando</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead className="hidden sm:table-cell">Itens</TableHead>
              <TableHead className="hidden md:table-cell">Canal</TableHead>
              <TableHead className="w-[56px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full rounded-md" />
                  </TableCell>
                </TableRow>
              ))}

            {rows.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-muted/20">
                <TableCell className="align-top">
                  <div className="text-xs font-medium text-foreground">{formatDateBr(row.scheduled_date)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{formatTimeBr(row.scheduled_time)}</div>
                </TableCell>

                <TableCell className="align-top">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {initials(row.tutor_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium leading-tight text-foreground">{row.tutor_name}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {row.tutor_phone1 || row.tutor_phone2 ? row.tutor_phone1 ?? row.tutor_phone2 : "—"}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="hidden sm:table-cell align-top">
                  <div className="text-xs text-muted-foreground">
                    {row.items?.length
                      ? row.items
                          .slice(0, 3)
                          .map((it) => `${it.quantity}× ${it.item}`)
                          .join(" • ")
                      : "—"}
                    {(row.items?.length ?? 0) > 3 && <span className="ml-2 text-[11px]">+{(row.items?.length ?? 0) - 3}</span>}
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell align-top">
                  <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
                    {channelLabel(row.channel)}
                  </Badge>
                </TableCell>

                <TableCell className="text-right align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-md">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-md">
                      <DropdownMenuItem className="rounded-sm" onClick={() => setCheckoutId(row.id)}>
                        <Syringe className="mr-2 h-4 w-4" />
                        Dar baixa
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-sm" onClick={() => setRescheduleId(row.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reagendar (duplicar)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-sm"
                        onClick={() => openWhats.mutate(row)}
                        disabled={openWhats.isPending}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Whats
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-sm" onClick={() => nav(`/tutors/${row.tutor_id}`)}>
                        Ver tutor
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {empty && (
              <TableRow>
                <TableCell colSpan={5} className="py-10">
                  <div className="mx-auto max-w-sm text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted">
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-3 text-sm font-medium">Nenhum agendamento pendente</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ajuste os filtros, ou crie um novo agendamento para começar.
                    </p>
                    <Button className="mt-4 rounded-md" onClick={() => nav("/appointments/new")}>
                      Novo agendamento
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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