import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase, corsHeaders } from "../_shared/supabaseClient.ts";

serve(async (req) => {
  const portalUrl = "https://psimanager.vercel.app/confirmar";

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      }
    });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");
  const token = url.searchParams.get("token");

  if (!patientId || !token) {
    console.warn("[Redirect] Parâmetros insuficientes para redirecionamento");
    return new Response(JSON.stringify({ error: "Parâmetros inválidos." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[Redirect] Link legado para paciente ${patientId} -> Redirecionando para o Portal`);
  const redirectUrl = `${portalUrl}?token=${token}`;

  return Response.redirect(redirectUrl, 302);
});
