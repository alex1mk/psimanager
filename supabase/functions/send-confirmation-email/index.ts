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
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { appointment_id } = await req.json();

        if (!appointment_id) {
            throw new Error("appointment_id is required");
        }

        console.log(`[send-confirmation-email] Processing for appointment: ${appointment_id}`);

        // 1. Fetch Appointment, Patient and Token
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select(`
                *,
                patient:patients(name, email),
                token:confirmation_tokens(token)
            `)
            .eq("id", appointment_id)
            .single();

        if (appError || !appointment) {
            console.error("Error fetching appointment:", appError);
            throw new Error("Appointment not found");
        }

        const patientEmail = appointment.patient?.email;
        const patientName = appointment.patient?.name;
        // The token is now in a separate table, linked by appointment_id. 
        // Note: The query above assumes a 1:1 relationship or takes the first one. 
        // If query fails to get token via join implies 1:1 relation setup in DB or need separate query.
        // Let's safe-guard by fetching token specifically if the join didn't work as expected or if multiple exist.

        let token = appointment.token?.token;
        if (!token) {
            const { data: tokenData } = await supabase
                .from("confirmation_tokens")
                .select("token")
                .eq("appointment_id", appointment_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            token = tokenData?.token;
        }

        if (!token) {
            console.error("Token not found for appointment", appointment_id);
            throw new Error("Confirmation token not generated yet");
        }

        // 2. Prepare Email Content
        const patientId = appointment.patient_id;
        const origin = req.headers.get("origin") || "https://psimanager-bay.vercel.app";
        const confirmationLink = `${origin}/confirmar?token=${token}&patient_id=${patientId}`;

        console.log(`[send-confirmation-email] Sending to: ${patientEmail}`);
        console.log(`[send-confirmation-email] Link: ${confirmationLink}`);

        if (!resendApiKey) {
            console.warn("[WARNING] RESEND_API_KEY not configured. Email will not be sent.");
            return new Response(
                JSON.stringify({ success: false, message: "Resend API Key missing" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Send Email via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: "PsiManager <noreply@psimanager.com>", // Make sure verify domain or use 'onboarding@resend.dev' for sandbox
                to: [patientEmail],
                subject: "Confirme seu Agendamento - PsiManager",
                html: `
                    <div style="font-family: sans-serif; color: #333;">
                        <h1>Olá, ${patientName}!</h1>
                        <p>Seu agendamento foi pré-reservado. Para confirmar, por favor clique no botão abaixo:</p>
                        <a href="${confirmationLink}" style="display: inline-block; padding: 12px 24px; background-color: #5B6D5B; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Confirmar Agendamento
                        </a>
                        <p style="margin-top: 20px; font-size: 12px; color: #666;">
                            Se o botão não funcionar, copie e cole este link: ${confirmationLink}
                        </p>
                    </div>
                `,
            }),
        });

        const emailData = await emailResponse.json();

        // 4. Handle Resend Errors (Sandbox vs Critical)
        if (!emailResponse.ok) {
            console.error("[Resend Error Payload]:", emailData);

            // Check for Sandbox restriction (403 Forbidden usually)
            if (emailResponse.status === 403 && emailData.message?.includes("domain is not verified")) {
                console.warn("[RESEND SANDBOX] Email not sent because domain is not verified. Valid in dev mode.");
                return new Response(
                    JSON.stringify({
                        success: true,
                        warning: "Sandbox Mode: Email not sent to unverified address.",
                        mockLink: confirmationLink // Return link for dev testing
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            throw new Error(`Resend API Error: ${emailData.message || emailResponse.statusText}`);
        }

        console.log("[send-confirmation-email] Email sent successfully:", emailData.id);

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
