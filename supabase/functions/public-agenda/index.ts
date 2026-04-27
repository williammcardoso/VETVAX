import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AgendaItem = {
  appointment_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "PENDENTE" | "APLICADO" | "CANCELADO";
  tutor_name: string;
  tutor_address: string | null;
  pet_name: string | null;
  category: string;
  item_name: string;
  quantity: number;
};

type PublicAgendaRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: AgendaItem["status"];
  tutor?: {
    name?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    uf?: string | null;
  } | null;
  items?: Array<{
    quantity?: number | null;
    pet?: { name?: string | null } | null;
    item?: { name?: string | null; category?: string | null } | null;
  }> | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function todayIsoInSaoPaulo() {
  // Avoid UTC date drift: appointments.scheduled_date is a DATE, so we should compare using the org's timezone.
  // en-CA produces YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatAddress(tutor: PublicAgendaRow["tutor"]) {
  if (!tutor) return null;
  const streetPart = [tutor.street, tutor.number].filter(Boolean).join(", ");
  const regionPart = [tutor.neighborhood, tutor.city].filter(Boolean).join(" • ");
  const uf = tutor.uf ? String(tutor.uf).toUpperCase() : "";
  const tail = [regionPart, uf].filter(Boolean).join(regionPart && uf ? " • " : "");
  return [streetPart, tail].filter(Boolean).join(streetPart && tail ? " • " : "") || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filter, status, from, to } = (await req.json().catch(() => ({}))) as {
      filter?: "all" | "saturday";
      status?: "all" | "PENDENTE" | "APLICADO" | "CANCELADO";
      from?: string;
      to?: string;
    };

    console.log("[public-agenda] request", {
      filter: filter ?? "all",
      status: status ?? "PENDENTE",
      hasFrom: !!from,
      hasTo: !!to,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[public-agenda] missing env", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const todayIso = todayIsoInSaoPaulo();
    const configuredOrgId = (Deno.env.get("PUBLIC_AGENDA_ORG_ID") ?? "").trim();
    console.log("[public-agenda] date filter", { todayIso, hasConfiguredOrg: !!configuredOrgId });

    // Public read-only agenda: show all active appointments by default.
    // Date filters are optional, so old pending appointments remain visible.
    let query = admin
      .from("appointments")
      .select(
        "id, scheduled_date, scheduled_time, status, is_active, tutor:tutors(name, street, number, neighborhood, city, uf), items:appointment_items(quantity, pet:pets(name), item:catalog_items(name, category))",
      )
      .eq("is_active", true)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(1000);

    if (!status || status === "PENDENTE") {
      query = query.eq("status", "PENDENTE");
    } else if (status !== "all") {
      query = query.eq("status", status);
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      query = query.gte("scheduled_date", from);
    }

    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      query = query.lte("scheduled_date", to);
    }

    if (configuredOrgId) {
      query = query.eq("org_id", configuredOrgId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[public-agenda] appointments error", { error });
      return new Response("Failed to load agenda", { status: 500, headers: corsHeaders });
    }

    console.log("[public-agenda] appointments loaded", { count: (data ?? []).length, from: todayIso });

    const flat: AgendaItem[] = [];

    for (const a of ((data ?? []) as PublicAgendaRow[])) {
      const tutor_name = a.tutor?.name ?? "—";
      const tutor_address = formatAddress(a.tutor);
      const scheduled_date = String(a.scheduled_date);
      const scheduled_time = String(a.scheduled_time).slice(0, 5);
      const status = String(a.status) as AgendaItem["status"];

      const items = a.items ?? [];
      if (items.length === 0) {
        flat.push({
          appointment_id: String(a.id),
          scheduled_date,
          scheduled_time,
          status,
          tutor_name,
          tutor_address,
          pet_name: null,
          category: "—",
          item_name: "—",
          quantity: 1,
        });
        continue;
      }

      for (const it of items) {
        flat.push({
          appointment_id: String(a.id),
          scheduled_date,
          scheduled_time,
          status,
          tutor_name,
          tutor_address,
          pet_name: it?.pet?.name ?? null,
          category: String(it?.item?.category ?? "—"),
          item_name: String(it?.item?.name ?? "—"),
          quantity: Number(it.quantity ?? 1),
        });
      }
    }

    const filtered = (filter ?? "all") === "saturday"
      ? flat.filter((r) => {
          const d = new Date(r.scheduled_date + "T00:00:00");
          return d.getDay() === 6;
        })
      : flat;

    console.log("[public-agenda] items ready", {
      flatCount: flat.length,
      filteredCount: filtered.length,
      filter: filter ?? "all",
    });

    return Response.json({ ok: true, items: filtered }, { headers: corsHeaders });
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[public-agenda] error", { message });
    return Response.json({ ok: false, error: message }, { status: 500, headers: corsHeaders });
  }
});