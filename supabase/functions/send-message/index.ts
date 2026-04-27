// VetVAX — Edge Function (skeleton)
// Objetivo: processar a fila message_outbox para evoluir do wa.me (MVP) para providers reais.
//
// Fase 1 (sem credenciais): apenas lista mensagens pendentes.
// Fase 2: integrar WhatsApp Cloud API/Twilio/360dialog e marcar como SENT/FAILED.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const expectedSecret = Deno.env.get("SEND_MESSAGE_SECRET") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    if (expectedSecret) {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
      if (token !== expectedSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
    const mark = url.searchParams.get("mark") === "true";

    const { data, error } = await supabase
      .from("message_outbox")
      .select("id, org_id, provider, channel, status, payload, scheduled_for, created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    if (mark && (data?.length ?? 0) > 0) {
      const ids = (data ?? []).map((m) => m.id);
      await supabase
        .from("message_outbox")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .in("id", ids);
    }

    return Response.json({
      ok: true,
      dry_run: !mark,
      count: data?.length ?? 0,
      messages: data ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
});
