import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase, corsHeaders } from "../_shared/supabaseClient.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { appointment_id } = body;
        let { confirmation_link } = body;

        if (!appointment_id) {
            console.error("[send-confirmation-email] ID do agendamento não fornecido");
            throw new Error("O ID do agendamento é obrigatório");
        }

        console.log(`[send-confirmation-email] Processando para agendamento: ${appointment_id}`);

        // 1. Buscar Agendamento e Paciente
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select(`
                *,
                patient:patients(name, email)
            `)
            .eq("id", appointment_id)
            .single();

        if (appError || !appointment) {
            console.error(`[ERRO BANCO]: ${appError?.message}`);
            throw new Error("Agendamento não encontrado");
        }

        // 2. Resolver Link de Confirmação se estiver faltando
        if (!confirmation_link) {
            console.log("[send-confirmation-email] Link ausente, buscando token no banco...");
            const { data: tokenData, error: tokenError } = await supabase
                .from("confirmation_tokens")
                .select("token")
                .eq("appointment_id", appointment_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (tokenError || !tokenData) {
                console.error("[send-confirmation-email] Token não encontrado para este agendamento");
                throw new Error("Token de confirmação não encontrado para este agendamento.");
            }

            const origin = req.headers.get("origin") || "https://psimanager.vercel.app";
            // Foco total no Token UUID como solicitado
            confirmation_link = `${origin}/confirmar?token=${tokenData.token}`;
            console.log(`[send-confirmation-email] Link gerado com sucesso: ${confirmation_link}`);
        }

        const patientEmail = appointment.patient?.email;
        const patientName = appointment.patient?.name;

        if (!patientEmail) {
            console.error("[send-confirmation-email] Email do paciente não encontrado");
            throw new Error("Email do paciente não encontrado");
        }

        if (!resendApiKey) {
            console.warn("[AVISO] RESEND_API_KEY não configurada.");
            return new Response(
                JSON.stringify({ success: false, message: "API Key do Resend ausente" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Formatar Data para o e-mail
        const dateFormatted = new Date(appointment.scheduled_date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        console.log(`[send-confirmation-email] Enviando e-mail para: ${patientEmail}`);

        // 3. Enviar E-mail via Resend
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
            console.error(`[ERRO RESEND]: ${emailData.message}`);
            throw new Error(`Erro na API do Resend: ${emailData.message || emailResponse.statusText}`);
        }

        console.log(`[send-confirmation-email] E-mail enviado com sucesso. ID: ${emailData.id}`);

        return new Response(
            JSON.stringify({ success: true, id: emailData.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("[send-confirmation-email] ERRO CRÍTICO:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro desconhecido" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
