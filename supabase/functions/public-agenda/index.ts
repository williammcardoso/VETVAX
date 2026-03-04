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
  pet_name: string | null;
  category: string;
  item_name: string;
  quantity: number;
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, filter } = (await req.json().catch(() => ({}))) as {
      token?: string;
      filter?: "all" | "saturday";
    };

    if (!token || typeof token !== "string") {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    console.log("[public-agenda] request", {
      filter: filter ?? "all",
      tokenLength: token.length,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[public-agenda] missing env", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsErr } = await admin
      .from("org_settings")
      .select("org_id, branding")
      .eq("is_active", true)
      .limit(200);

    if (settingsErr) {
      console.error("[public-agenda] org_settings error", { settingsErr });
      return new Response("Failed to load settings", { status: 500, headers: corsHeaders });
    }

    const match = (settings ?? []).find((s: any) => {
      const t = s?.branding?.public_agenda_token;
      return typeof t === "string" && t === token;
    });

    if (!match?.org_id) {
      console.warn("[public-agenda] invalid token", { tokenLength: token.length });
      return new Response("Invalid token", { status: 404, headers: corsHeaders });
    }

    console.log("[public-agenda] matched org", { org_id: match.org_id });

    const todayIso = todayIsoInSaoPaulo();
    console.log("[public-agenda] date filter", { todayIso });

    // IMPORTANT: public agenda should show *all* upcoming appointments (not only PENDENTE and not only vaccines).
    const { data, error } = await admin
      .from("appointments")
      .select(
        "id, org_id, scheduled_date, scheduled_time, status, is_active, tutor:tutors(name), items:appointment_items(quantity, pet:pets(name), item:catalog_items(name, category))",
      )
      .eq("org_id", match.org_id)
      .eq("is_active", true)
      .gte("scheduled_date", todayIso)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("[public-agenda] appointments error", { error });
      return new Response("Failed to load agenda", { status: 500, headers: corsHeaders });
    }

    console.log("[public-agenda] appointments loaded", { count: (data ?? []).length, from: todayIso });

    const flat: AgendaItem[] = [];

    for (const a of data ?? []) {
      const tutor_name = (a as any).tutor?.name ?? "—";
      const scheduled_date = String((a as any).scheduled_date);
      const scheduled_time = String((a as any).scheduled_time).slice(0, 5);
      const status = String((a as any).status) as AgendaItem["status"];

      const items = ((a as any).items ?? []) as any[];
      if (items.length === 0) {
        flat.push({
          appointment_id: String((a as any).id),
          scheduled_date,
          scheduled_time,
          status,
          tutor_name,
          pet_name: null,
          category: "—",
          item_name: "—",
          quantity: 1,
        });
        continue;
      }

      for (const it of items) {
        flat.push({
          appointment_id: String((a as any).id),
          scheduled_date,
          scheduled_time,
          status,
          tutor_name,
          pet_name: it?.pet?.name ?? null,
          category: String(it?.item?.category ?? "—"),
          item_name: String(it?.item?.name ?? "—"),
          quantity: Number(it?.quantity ?? 1),
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
    console.error("[public-agenda] error", { message: (e as any)?.message ?? String(e) });
    return Response.json({ ok: false, error: (e as any)?.message ?? String(e) }, { status: 500, headers: corsHeaders });
  }
});