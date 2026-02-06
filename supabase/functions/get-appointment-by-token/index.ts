// ─── EDGE FUNCTION: GET APPOINTMENT BY TOKEN ────────────────────────────────
// Purpose: Validates token and returns appointment data for public confirmation
// Created: 2026-02-06
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { token } = await req.json();

        if (!token) {
            return new Response(
                JSON.stringify({ error: "Token não fornecido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Buscar token com appointment e patient
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*, appointment:appointments(*, patient:patients(name))")
            .eq("token", token)
            .single();

        if (tokenError || !tokenData) {
            console.error("[get-appointment-by-token] Token not found:", token);
            return new Response(
                JSON.stringify({ error: "Token inválido" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verificar expiração
        if (new Date(tokenData.expires_at) < new Date()) {
            console.log("[get-appointment-by-token] Token expired:", token);
            return new Response(
                JSON.stringify({ error: "Token expirado" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verificar se já foi usado
        if (tokenData.used_at) {
            console.log("[get-appointment-by-token] Token already used:", token);
            return new Response(
                JSON.stringify({ error: "Token já utilizado" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("[get-appointment-by-token] ✅ Valid token for patient:", tokenData.appointment.patient.name);

        return new Response(
            JSON.stringify({
                appointment: {
                    patient_name: tokenData.appointment.patient.name,
                    suggested_date: tokenData.appointment.scheduled_date,
                    suggested_time: tokenData.appointment.scheduled_time,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[get-appointment-by-token] Error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
