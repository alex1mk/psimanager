// ─── EDGE FUNCTION: CONFIRM APPOINTMENT ─────────────────────────────────────
// Purpose: Confirms an appointment with user-provided details (date, time, recurrence)
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
        const { token, date, time, recurrence } = await req.json();

        if (!token) {
            return new Response(
                JSON.stringify({ error: "Token não fornecido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Validar token
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*")
            .eq("token", token)
            .single();

        if (tokenError || !tokenData) {
            return new Response(
                JSON.stringify({ error: "Token inválido" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: "Token expirado" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (tokenData.used_at) {
            return new Response(
                JSON.stringify({ error: "Token já utilizado" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Atualizar e Confirmar Agendamento
        // Como estamos na Edge Function, podemos usar o Supabase Client diretamente
        // Simificando a lógica do AppointmentEngine aqui para o Deno environment

        // Validar conflitos (opcional, mas recomendado)
        const { data: conflicts } = await supabase
            .from("appointments")
            .select("id")
            .eq("scheduled_date", date)
            .eq("scheduled_time", time)
            .neq("status", "cancelled")
            .neq("id", tokenData.appointment_id);

        if (conflicts && conflicts.length > 0) {
            return new Response(
                JSON.stringify({ error: "Este horário já foi preenchido. Por favor, escolha outro." }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Atualizar agendamento
        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                status: "confirmed",
                scheduled_date: date,
                scheduled_time: time,
                recurrence_type: recurrence,
            })
            .eq("id", tokenData.appointment_id);

        if (updateError) throw updateError;

        // Marcar token como utilizado
        await supabase
            .from("confirmation_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("token", token);

        console.log("[confirm-appointment] ✅ Confirmed:", tokenData.appointment_id);

        return new Response(
            JSON.stringify({ success: true, message: "Agendamento confirmado com sucesso" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[confirm-appointment] Error:", error);
        return new Response(
            JSON.stringify({ error: "Erro ao confirmar agendamento" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
