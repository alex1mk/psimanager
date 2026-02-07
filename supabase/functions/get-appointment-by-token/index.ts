import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase, corsHeaders } from "@shared/supabaseClient.ts";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body: { token?: string } = await req.json();
        const token: string | undefined = body.token?.trim();

        console.log(`[get-appointment-by-token] Processando token: "${token}"`);

        if (!token) {
            console.error("[get-appointment-by-token] Token não fornecido na requisição");
            return new Response(
                JSON.stringify({ error: "Token não fornecido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Buscar o registro do Token na tabela confirmation_tokens
        // O campo 'token' nesta tabela é o UUID que enviamos no link.
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*")
            .eq("token", token)
            .maybeSingle();

        if (tokenError) {
            console.error(`[ERRO BANCO]: ${tokenError.message}`);
            throw new Error(`Erro ao buscar registro do token: ${tokenError.message}`);
        }

        if (!tokenData) {
            console.warn(`[get-appointment-by-token] Token não encontrado ou inválido: "${token}"`);
            return new Response(
                JSON.stringify({ error: "Link de confirmação inválido ou não encontrado." }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const serverTime = new Date().toISOString();
        console.log(`[get-appointment-by-token] Registro encontrado para ID: ${tokenData.id}`);

        // 2. Validar Expiração e Uso
        if (new Date(tokenData.expires_at) < new Date()) {
            console.warn(`[get-appointment-by-token] Link expirado. Expiração: ${tokenData.expires_at} | Agora: ${serverTime}`);
            return new Response(
                JSON.stringify({ error: "Este link de confirmação expirou." }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (tokenData.used_at) {
            console.warn(`[get-appointment-by-token] Tentativa de usar token já utilizado: ${token}`);
            return new Response(
                JSON.stringify({ error: "Este agendamento já foi confirmado anteriormente." }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Buscar Agendamento Associado
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select("*, patient_id")
            .eq("id", tokenData.appointment_id)
            .maybeSingle();

        if (appError) {
            console.error(`[ERRO AGENDAMENTO]: ${appError.message}`);
            throw new Error(`Erro ao buscar dados do agendamento: ${appError.message}`);
        }

        if (!appointment) {
            console.error(`[get-appointment-by-token] Agendamento ${tokenData.appointment_id} não encontrado para o token ${token}`);
            return new Response(
                JSON.stringify({ error: "Agendamento associado não encontrado." }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 4. Buscar Nome do Paciente
        let patientName = "Paciente";
        if (appointment.patient_id) {
            const { data: patient } = await supabase
                .from("patients")
                .select("name")
                .eq("id", appointment.patient_id)
                .maybeSingle();

            if (patient) {
                patientName = patient.name;
            }
        }

        console.log(`[get-appointment-by-token] Sucesso ao recuperar dados para: ${patientName}`);

        return new Response(
            JSON.stringify({
                appointment: {
                    patient_name: patientName,
                    suggested_date: appointment.scheduled_date,
                    suggested_time: appointment.scheduled_time,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[get-appointment-by-token] ERRO CRÍTICO:", error);
        return new Response(
            JSON.stringify({
                error: "Erro interno no servidor",
                details: error.message
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
