// ─── EDGE FUNCTION: CONFIRM SCHEDULING (LEGACY REDIRECT) ─────────────────────
// Purpose: Redirects old links to the new Public Confirmation Portal
// Created: 2026-02-06
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const portalUrl = "https://psimanager-bay.vercel.app/confirmar";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");
  const token = url.searchParams.get("token");

  if (!patientId || !token) {
    return new Response(JSON.stringify({ error: "Parâmetros inválidos." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[Redirect] Legacy link for patient ${patientId} -> Portal`);
  const redirectUrl = `${portalUrl}?token=${token}&patient_id=${patientId}`;

  return Response.redirect(redirectUrl, 302);
});
