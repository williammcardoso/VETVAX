import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AgendaItem = {
  scheduled_date: string;
  scheduled_time: string;
  tutor_name: string;
  pet_name: string | null;
  vaccine: string;
};

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
      return new Response("Invalid token", { status: 404, headers: corsHeaders });
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayIso = `${yyyy}-${mm}-${dd}`;

    // Pull upcoming appointments + items + pets + vaccines
    const { data, error } = await admin
      .from("appointments")
      .select(
        "id, org_id, scheduled_date, scheduled_time, status, is_active, tutor:tutors(name), items:appointment_items(pet:pets(name), item:catalog_items(name, category))",
      )
      .eq("org_id", match.org_id)
      .eq("is_active", true)
      .eq("status", "PENDENTE")
      .gte("scheduled_date", todayIso)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(700);

    if (error) {
      console.error("[public-agenda] appointments error", { error });
      return new Response("Failed to load agenda", { status: 500, headers: corsHeaders });
    }

    const flat: AgendaItem[] = [];

    for (const a of data ?? []) {
      const items = (a as any).items ?? [];
      const vaccines = items
        .filter((it: any) => (it?.item?.category ?? "") === "vaccine")
        .map((it: any) => ({
          pet_name: it?.pet?.name ?? null,
          vaccine: it?.item?.name ?? "",
        }))
        .filter((v: any) => typeof v.vaccine === "string" && v.vaccine.trim());

      const tutor_name = (a as any).tutor?.name ?? "—";
      const scheduled_date = String((a as any).scheduled_date);
      const scheduled_time = String((a as any).scheduled_time).slice(0, 5);

      if (vaccines.length === 0) {
        flat.push({ scheduled_date, scheduled_time, tutor_name, pet_name: null, vaccine: "—" });
        continue;
      }

      for (const v of vaccines) {
        flat.push({
          scheduled_date,
          scheduled_time,
          tutor_name,
          pet_name: v.pet_name,
          vaccine: v.vaccine,
        });
      }
    }

    const filtered = (filter ?? "all") === "saturday"
      ? flat.filter((r) => {
          // JS: 0=Sun ... 6=Sat
          const d = new Date(r.scheduled_date + "T00:00:00");
          return d.getDay() === 6;
        })
      : flat;

    return Response.json({ ok: true, items: filtered }, { headers: corsHeaders });
  } catch (e) {
    console.error("[public-agenda] error", { message: (e as any)?.message ?? String(e) });
    return Response.json({ ok: false, error: (e as any)?.message ?? String(e) }, { status: 500, headers: corsHeaders });
  }
});
