// Supabase Edge Function (placeholder)
// Objetivo: processar public.message_outbox (PENDING) e enviar via provider configurado.
// MVP atual usa wa.me direto no frontend (sem credenciais).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({
      ok: true,
      message:
        "send-message placeholder: configure provider (WhatsApp Cloud API/Twilio/360dialog) e secrets no Supabase.",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
