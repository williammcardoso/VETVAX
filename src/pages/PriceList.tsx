import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Plus, Send, Tag, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import type { MessageTemplate, PriceListItem, QuoteTemplate, QuoteTemplateItem, Tutor } from "@/types/vetvax";
import PageHeader from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { buildWhatsAppLink, normalizeBrPhone } from "@/lib/phone";
import { renderTemplate } from "@/lib/template";

type QuoteItemDraft = {
  price_list_item_id: string;
  quantity: number;
};

const DEFAULT_QUOTE_TEMPLATE = [
  "Olá {{tutor_name}}! Aqui é da {{store_name}}.",
  "Segue o orçamento: {{quote_name}}.",
  "{{quote_items}}",
  "Total: {{quote_total}}.",
].join("\n");

function centsToCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPriceMask(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskToCents(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function PriceList() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceListItem | null>(null);
  const [vaccineName, setVaccineName] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [priceActive, setPriceActive] = useState(true);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteTemplate | null>(null);
  const [quoteName, setQuoteName] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteItemsDraft, setQuoteItemsDraft] = useState<QuoteItemDraft[]>([{ price_list_item_id: "", quantity: 1 }]);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<{ quote: QuoteTemplate; items: Array<QuoteTemplateItem & { vaccine_name: string }> } | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState("");

  const priceItems = useQuery({
    queryKey: ["prices", "items", q],
    queryFn: async () => {
      let query = supabase
        .from("price_list_items")
        .select("id, org_id, vaccine_name, price_cents, is_active, created_at, updated_at")
        .order("is_active", { ascending: false })
        .order("vaccine_name", { ascending: true });
      const term = q.trim();
      if (term) query = query.ilike("vaccine_name", `%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PriceListItem[];
    },
  });

  const quoteTemplates = useQuery({
    queryKey: ["prices", "quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_templates")
        .select("id, org_id, name, notes, is_active, created_at, updated_at")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuoteTemplate[];
    },
  });

  const quoteItems = useQuery({
    queryKey: ["prices", "quote-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_template_items")
        .select("id, org_id, quote_template_id, price_list_item_id, quantity, unit_price_cents, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuoteTemplateItem[];
    },
  });

  const tutors = useQuery({
    queryKey: ["prices", "tutors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, org_id, branch_id, name, street, number, complement, neighborhood, city, uf, phone1, phone2, notes, tags, contact_consent, is_active, created_at")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Tutor[];
    },
  });

  const whatsQuoteTemplate = useQuery({
    queryKey: ["prices", "quote-whats-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, org_id, name, channel, body, is_active, created_at, updated_at")
        .eq("channel", "whatsapp")
        .eq("name", "Orçamento - padrão")
        .eq("is_active", true)
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as MessageTemplate | null;
    },
  });

  const orgSettings = useQuery({
    queryKey: ["org", "settings", "prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_settings").select("store_name").limit(1);
      if (error) throw error;
      return data?.[0]?.store_name ?? "VetVAX";
    },
  });

  const priceMap = useMemo(() => new Map((priceItems.data ?? []).map((p) => [p.id, p])), [priceItems.data]);

  const quoteRows = useMemo(() => {
    const templates = quoteTemplates.data ?? [];
    const items = quoteItems.data ?? [];
    return templates.map((quote) => {
      const lineItems = items
        .filter((it) => it.quote_template_id === quote.id)
        .map((it) => ({
          ...it,
          vaccine_name: priceMap.get(it.price_list_item_id)?.vaccine_name ?? "Vacina removida",
        }));
      const totalCents = lineItems.reduce((acc, it) => acc + it.unit_price_cents * it.quantity, 0);
      return { quote, items: lineItems, totalCents };
    });
  }, [priceMap, quoteItems.data, quoteTemplates.data]);

  const upsertPrice = useMutation({
    mutationFn: async () => {
      if (!profile?.org_id) throw new Error("Perfil sem organização.");
      const name = vaccineName.trim();
      if (name.length < 2) throw new Error("Informe o nome da vacina.");
      const price_cents = maskToCents(priceValue);
      if (!Number.isFinite(price_cents) || price_cents < 0) throw new Error("Informe um valor válido.");
      if (editingPrice?.id) {
        const { error } = await supabase
          .from("price_list_items")
          .update({ vaccine_name: name, price_cents, is_active: priceActive })
          .eq("id", editingPrice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("price_list_items")
          .insert({ org_id: profile.org_id, vaccine_name: name, price_cents, is_active: priceActive });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast({ title: "Preço salvo" });
      setPriceDialogOpen(false);
      setEditingPrice(null);
      setVaccineName("");
      setPriceValue("");
      setPriceActive(true);
      await qc.invalidateQueries({ queryKey: ["prices", "items"] });
    },
    onError: (e: unknown) => toast({ title: "Falha ao salvar preço", description: getErrorMessage(e), variant: "destructive" }),
  });

  const upsertQuote = useMutation({
    mutationFn: async () => {
      if (!profile?.org_id) throw new Error("Perfil sem organização.");
      const cleanName = quoteName.trim();
      if (cleanName.length < 2) throw new Error("Informe o nome do orçamento.");
      const cleanItems = quoteItemsDraft.filter((it) => it.price_list_item_id && it.quantity > 0);
      if (cleanItems.length === 0) throw new Error("Adicione ao menos 1 item no orçamento.");

      let quoteId = editingQuote?.id;
      if (quoteId) {
        const { error: quoteError } = await supabase
          .from("quote_templates")
          .update({ name: cleanName, notes: quoteNotes || null, is_active: true })
          .eq("id", quoteId);
        if (quoteError) throw quoteError;
        const { error: delError } = await supabase.from("quote_template_items").delete().eq("quote_template_id", quoteId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase
          .from("quote_templates")
          .insert({ org_id: profile.org_id, name: cleanName, notes: quoteNotes || null, is_active: true })
          .select("id")
          .single();
        if (error) throw error;
        quoteId = data.id;
      }
      const payload = cleanItems.map((it) => ({
        org_id: profile.org_id!,
        quote_template_id: quoteId!,
        price_list_item_id: it.price_list_item_id,
        quantity: it.quantity,
        unit_price_cents: priceMap.get(it.price_list_item_id)?.price_cents ?? 0,
      }));
      const { error } = await supabase.from("quote_template_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Orçamento salvo" });
      setQuoteDialogOpen(false);
      setEditingQuote(null);
      setQuoteName("");
      setQuoteNotes("");
      setQuoteItemsDraft([{ price_list_item_id: "", quantity: 1 }]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["prices", "quotes"] }),
        qc.invalidateQueries({ queryKey: ["prices", "quote-items"] }),
      ]);
    },
    onError: (e: unknown) => toast({ title: "Falha ao salvar orçamento", description: getErrorMessage(e), variant: "destructive" }),
  });

  const setQuoteActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("quote_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["prices", "quotes"] });
    },
  });

  const sendQuoteWhats = async () => {
    if (!selectedQuote) return;
    const tutor = (tutors.data ?? []).find((t) => t.id === selectedTutorId);
    if (!tutor) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    const rawPhone = tutor.phone1 || tutor.phone2 || "";
    const phone = normalizeBrPhone(rawPhone);
    if (!phone) {
      toast({ title: "Cliente sem telefone", variant: "destructive" });
      return;
    }
    const quoteLines = selectedQuote.items.map((item) => `- ${item.quantity}x ${item.vaccine_name}: ${centsToCurrency(item.unit_price_cents * item.quantity)}`);
    const total = selectedQuote.items.reduce((acc, item) => acc + item.unit_price_cents * item.quantity, 0);
    const templateBody = whatsQuoteTemplate.data?.body ?? DEFAULT_QUOTE_TEMPLATE;
    const message = renderTemplate(templateBody, {
      tutor_name: tutor.name,
      store_name: orgSettings.data ?? "VetVAX",
      quote_name: selectedQuote.quote.name,
      quote_items: quoteLines.join("\n"),
      quote_total: centsToCurrency(total),
    });
    window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
    setSendDialogOpen(false);
    setSelectedTutorId("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Comercial"
        title="Lista de preço"
        description="Cadastre valores de vacinas e monte orçamentos padrão com envio rápido por WhatsApp."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingQuote(null);
                setQuoteName("");
                setQuoteNotes("");
                setQuoteItemsDraft([{ price_list_item_id: "", quantity: 1 }]);
                setQuoteDialogOpen(true);
              }}
            >
              <Tag className="h-4 w-4" />
              Novo orçamento
            </Button>
            <Button
              onClick={() => {
                setEditingPrice(null);
                setVaccineName("");
                setPriceValue("");
                setPriceActive(true);
                setPriceDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova vacina
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="vetvax-section-title">Valores de vacinas</h2>
            <Input
              className="sm:w-[260px]"
              placeholder="Buscar vacina..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {(priceItems.data ?? []).map((item) => (
              <article key={item.id} className="flex flex-col gap-2 rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-white to-vetvax-surface-panel/80 p-3 shadow-sm transition-[box-shadow,border-color,transform] duration-vetvax hover:-translate-y-px hover:border-vetvax-primary-border hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-vetvax-text-main">{item.vaccine_name}</p>
                  <p className="text-sm font-semibold text-vetvax-primary">{centsToCurrency(item.price_cents)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.is_active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setEditingPrice(item);
                      setVaccineName(item.vaccine_name);
                      setPriceValue(formatPriceMask(String(item.price_cents)));
                      setPriceActive(item.is_active);
                      setPriceDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
            {!priceItems.isLoading && (priceItems.data ?? []).length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-vetvax-border-soft px-3 py-8 text-center text-sm text-vetvax-text-tertiary">
                Nenhuma vacina cadastrada.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-[18px] border border-vetvax-border-soft bg-gradient-to-b from-white to-vetvax-surface-panel/40 p-5 shadow-vetvax-card ring-1 ring-black/[0.02]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="vetvax-section-title">Orçamentos padrão</h2>
            <Badge variant="info">{quoteRows.length}</Badge>
          </div>
          <div className="space-y-2">
            {quoteRows.map(({ quote, items, totalCents }) => (
              <article key={quote.id} className="rounded-[14px] border border-vetvax-border-soft bg-gradient-to-r from-white to-vetvax-surface-panel/80 p-3 shadow-sm transition-[box-shadow,border-color] duration-vetvax hover:border-vetvax-primary-border hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-vetvax-text-main">{quote.name}</p>
                    <p className="text-xs text-vetvax-text-secondary">{items.length} item(ns) • {centsToCurrency(totalCents)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {quote.is_active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Arquivado</Badge>}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditingQuote(quote);
                        setQuoteName(quote.name);
                        setQuoteNotes(quote.notes ?? "");
                        setQuoteItemsDraft(items.map((it) => ({ price_list_item_id: it.price_list_item_id, quantity: it.quantity })));
                        setQuoteDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuoteActive.mutate({ id: quote.id, is_active: !quote.is_active })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedQuote({ quote, items });
                        setSendDialogOpen(true);
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
                {quote.notes ? <p className="mt-2 text-xs text-vetvax-text-tertiary">{quote.notes}</p> : null}
              </article>
            ))}
            {!quoteTemplates.isLoading && quoteRows.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-vetvax-border-soft px-3 py-8 text-center text-sm text-vetvax-text-tertiary">
                Nenhum orçamento cadastrado.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPrice ? "Editar valor da vacina" : "Nova vacina na lista de preço"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nome da vacina</Label>
              <Input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Preço (R$)</Label>
              <Input value={priceValue} onChange={(e) => setPriceValue(formatPriceMask(e.target.value))} placeholder="0,00" />
            </div>
            <div className="flex items-center justify-between rounded-[12px] border border-vetvax-border-soft px-3 py-2">
              <span className="text-sm font-medium text-vetvax-text-main">Item ativo</span>
              <Button type="button" variant={priceActive ? "default" : "outline"} onClick={() => setPriceActive((v) => !v)}>
                {priceActive ? "Ativo" : "Inativo"}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => upsertPrice.mutate()} disabled={upsertPrice.isPending}>
                {upsertPrice.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingQuote ? "Editar orçamento padrão" : "Novo orçamento padrão"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nome do orçamento</Label>
              <Input value={quoteName} onChange={(e) => setQuoteName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              {quoteItemsDraft.map((draft, idx) => (
                <div key={idx} className="grid gap-2 rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label>Vacina</Label>
                    <Select
                      value={draft.price_list_item_id}
                      onValueChange={(value) =>
                        setQuoteItemsDraft((prev) => prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, price_list_item_id: value } : line)))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar vacina..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-control">
                        {(priceItems.data ?? []).filter((p) => p.is_active).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.vaccine_name} ({centsToCurrency(p.price_cents)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={draft.quantity}
                      onChange={(e) =>
                        setQuoteItemsDraft((prev) =>
                          prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, quantity: Math.max(1, Number(e.target.value || 1)) } : line)),
                        )
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuoteItemsDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setQuoteItemsDraft((prev) => [...prev, { price_list_item_id: "", quantity: 1 }])}>
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
              <Button onClick={() => upsertQuote.mutate()} disabled={upsertQuote.isPending}>
                {upsertQuote.isPending ? "Salvando..." : "Salvar orçamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar orçamento por WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Select value={selectedTutorId} onValueChange={setSelectedTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  {(tutors.data ?? []).map((tutor) => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-[12px] border border-vetvax-border-soft bg-vetvax-surface-panel/60 p-3 text-xs text-vetvax-text-secondary">
              {selectedQuote ? `${selectedQuote.quote.name} • ${selectedQuote.items.length} item(ns)` : "Orçamento não selecionado"}
            </div>
            <div className="flex justify-end">
              <Button onClick={sendQuoteWhats}>
                <Send className="h-4 w-4" />
                Enviar para WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
