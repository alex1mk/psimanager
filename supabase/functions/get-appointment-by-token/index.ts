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

        // 1. Tentar buscar token no banco (Fluxo Novo)
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*, appointment:appointments(*, patient:patients(name))")
            .eq("token", token)
            .single();

        if (tokenData && !tokenError) {
            // Verificar expiração
            if (new Date(tokenData.expires_at) < new Date()) {
                return new Response(JSON.stringify({ error: "Token expirado" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            if (tokenData.used_at) {
                return new Response(JSON.stringify({ error: "Token já utilizado" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

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
        }

        // 2. Fallback: Validar HMAC se patient_id for fornecido (Fluxo Legado/Seguro)
        const url = new URL(req.url);
        const patient_id = url.searchParams.get("patient_id") || (await req.clone().json()).patient_id;

        if (patient_id) {
            const secret = Deno.env.get("CONFIRMATION_SECRET") || "your-secret-key-here";
            const expectedToken = await crypto.subtle
                .digest("SHA-256", new TextEncoder().encode(`${patient_id}:${secret}`))
                .then((buffer) =>
                    Array.from(new Uint8Array(buffer))
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join(""),
                );

            if (token === expectedToken) {
                // Token validado via HMAC! Buscar dados do paciente
                const { data: patient, error: pError } = await supabase
                    .from("patients")
                    .select("name, id")
                    .eq("id", patient_id)
                    .single();

                if (!pError && patient) {
                    // Buscar último agendamento pendente
                    const { data: appointment } = await supabase
                        .from("appointments")
                        .select("*")
                        .eq("patient_id", patient_id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .single();

                    return new Response(
                        JSON.stringify({
                            appointment: {
                                patient_name: patient.name,
                                suggested_date: appointment?.scheduled_date,
                                suggested_time: appointment?.scheduled_time,
                            },
                        }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }
        }

        return new Response(
            JSON.stringify({ error: "Token inválido ou expirado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[get-appointment-by-token] Error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
