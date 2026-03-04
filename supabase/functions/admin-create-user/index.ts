import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeUsername(raw: string) {
  const v = (raw ?? "").trim().toLowerCase();
  // allow a-z, 0-9, dot, underscore, hyphen
  const cleaned = v.replace(/[^a-z0-9._-]/g, "");
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[admin-create-user] missing env", {
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
      console.error("[admin-create-user] invalid user", { userErr });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { data: myProfile, error: profErr } = await client
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr) {
      console.error("[admin-create-user] profile error", { profErr });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    if (!myProfile?.org_id || myProfile.role !== "admin") {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
      display_name?: string;
      role?: "admin" | "manager" | "staff" | "viewer";
      branch_id?: string | null;
    };

    const username = normalizeUsername(body.username ?? "");
    const password = String(body.password ?? "");

    if (!username || username.length < 3) {
      return new Response("Invalid username", { status: 400, headers: corsHeaders });
    }
    if (!password || password.length < 6) {
      return new Response("Invalid password", { status: 400, headers: corsHeaders });
    }

    const email = `${username}@vetvax.local`;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: body.display_name ?? null,
      },
    });

    if (createErr || !created?.user) {
      console.error("[admin-create-user] createUser error", { createErr });
      return new Response(createErr?.message ?? "Failed to create user", { status: 400, headers: corsHeaders });
    }

    const newUserId = created.user.id;

    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: newUserId,
      org_id: myProfile.org_id,
      branch_id: body.branch_id ?? null,
      role: body.role ?? "staff",
      display_name: body.display_name ?? username,
    });

    if (upsertErr) {
      console.error("[admin-create-user] profile upsert error", { upsertErr });
      return new Response("User created but profile failed", { status: 500, headers: corsHeaders });
    }

    return Response.json(
      {
        ok: true,
        user_id: newUserId,
        username,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    console.error("[admin-create-user] error", { message: (e as any)?.message ?? String(e) });
    return Response.json({ ok: false, error: (e as any)?.message ?? String(e) }, { status: 500, headers: corsHeaders });
  }
});
