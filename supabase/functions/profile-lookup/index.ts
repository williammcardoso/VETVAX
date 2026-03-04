import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[profile-lookup] missing env", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!anonKey,
        hasService: !!serviceRoleKey,
      });
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) {
      console.error("[profile-lookup] invalid user", { userErr });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { data: myProfile, error: profErr } = await client
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr || !myProfile?.org_id) {
      console.error("[profile-lookup] profile error", { profErr });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // staff+ only
    const role = String(myProfile.role ?? "viewer");
    if (!(["admin", "manager", "staff"] as const).includes(role as any)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x) : [];

    if (ids.length === 0) {
      return Response.json({ ok: true, map: {} }, { headers: corsHeaders });
    }

    const uniq = Array.from(new Set(ids)).slice(0, 50);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin
      .from("profiles")
      .select("id, org_id, display_name")
      .eq("org_id", myProfile.org_id)
      .in("id", uniq);

    if (error) {
      console.error("[profile-lookup] query error", { error });
      return new Response("Failed", { status: 500, headers: corsHeaders });
    }

    const map: Record<string, string> = {};
    for (const p of data ?? []) {
      if (!p?.id) continue;
      map[p.id] = (p as any).display_name ?? "";
    }

    return Response.json({ ok: true, map }, { headers: corsHeaders });
  } catch (e) {
    console.error("[profile-lookup] error", { message: (e as any)?.message ?? String(e) });
    return Response.json({ ok: false, error: (e as any)?.message ?? String(e) }, { status: 500, headers: corsHeaders });
  }
});
