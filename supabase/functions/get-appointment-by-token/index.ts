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
        const body = await req.json();
        const { token } = body;

        console.log(`[get-appointment-by-token] Analisando token: ${token?.substring(0, 10)}...`);

        if (!token) {
            return new Response(JSON.stringify({ error: "Token não fornecido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 1. Buscar Token
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*")
            .eq("token", token)
            .maybeSingle();

        if (tokenError) throw new Error(`Erro ao buscar token: ${tokenError.message}`);
        if (!tokenData) return new Response(JSON.stringify({ error: "Link de confirmação inválido." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        console.log(`[get-appointment-by-token] Token encontrado. Usado em: ${tokenData.used_at || 'Nunca'}`);

        // 2. Validar Expiração
        if (new Date(tokenData.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "Este link de confirmação expirou." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (tokenData.used_at) {
            return new Response(JSON.stringify({ error: "Este agendamento já foi confirmado." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Buscar Agendamento
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select("*")
            .eq("id", tokenData.appointment_id)
            .maybeSingle();

        if (appError) throw new Error(`Erro ao buscar agendamento: ${appError.message}`);

        // 4. Buscar Paciente
        let patientName = "Paciente";
        if (appointment?.patient_id) {
            const { data: patient } = await supabase
                .from("patients")
                .select("name")
                .eq("id", appointment.patient_id)
                .maybeSingle();
            if (patient) patientName = patient.name;
        }

        return new Response(
            JSON.stringify({
                appointment: {
                    patient_name: patientName,
                    suggested_date: appointment?.scheduled_date,
                    suggested_time: appointment?.scheduled_time,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[get-appointment-by-token] FATAL:", error);
        return new Response(
            JSON.stringify({
                error: "Erro interno",
                details: error.message
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
