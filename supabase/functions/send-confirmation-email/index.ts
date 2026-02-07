// ─── EDGE FUNCTION: SEND CONFIRMATION EMAIL ──────────────────────────────────
// Purpose: Triggered by frontend after appointment creation to send the confirmation link.
// Created: 2026-02-07
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY");

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
        const { appointment_id, confirmation_link } = await req.json();

        if (!appointment_id || !confirmation_link) {
            throw new Error("appointment_id and confirmation_link are required");
        }

        console.log(`[send-confirmation-email] Processing for appointment: ${appointment_id}`);

        // 1. Fetch Appointment and Patient
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select(`
                *,
                patient:patients(name, email)
            `)
            .eq("id", appointment_id)
            .single();

        if (appError || !appointment) {
            console.error("Error fetching appointment:", appError);
            throw new Error("Appointment not found");
        }

        const patientEmail = appointment.patient?.email;
        const patientName = appointment.patient?.name;

        if (!patientEmail) {
            throw new Error("Patient email not found");
        }

        console.log(`[send-confirmation-email] Sending to: ${patientEmail}`);
        console.log(`[send-confirmation-email] Link: ${confirmation_link}`);

        if (!resendApiKey) {
            console.warn("[WARNING] RESEND_API_KEY not configured. Email will not be sent.");
            return new Response(
                JSON.stringify({ success: false, message: "Resend API Key missing" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Format Date
        const dateFormatted = new Date(appointment.scheduled_date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // 3. Send Email via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: "PsiManager <noreply@psimanager.com>",
                to: [patientEmail],
                subject: `Confirmação de Agendamento - ${dateFormatted}`,
                html: `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #5B6D5B;">Olá, ${patientName}!</h1>
                        <p>Seu agendamento foi pré-reservado. Para confirmar sua presença, por favor clique no botão abaixo:</p>
                        
                        <div style="background: #F7F5F0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${dateFormatted}</p>
                            <p style="margin: 5px 0;"><strong>🕐 Horário:</strong> ${appointment.scheduled_time}</p>
                        </div>

                        <a href="${confirmation_link}" style="display: inline-block; padding: 12px 24px; background-color: #5B6D5B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Confirmar Agendamento
                        </a>
                        <p style="margin-top: 20px; font-size: 12px; color: #666;">
                            Se o botão não funcionar, copie e cole este link: ${confirmation_link}
                        </p>
                    </div>
                `,
            }),
        });

        const emailData = await emailResponse.json();

        if (!emailResponse.ok) {
            throw new Error(`Resend API Error: ${emailData.message || emailResponse.statusText}`);
        }

        return new Response(
            JSON.stringify({ success: true, id: emailData.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("[FATAL ERROR]:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro desconhecido" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
