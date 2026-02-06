
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { type } = await req.json(); // "24h" ou "30min"

        if (type === "24h") {
            await send24hReminders();
        } else if (type === "30min") {
            await send30minReminders();
        } else {
            throw new Error("Tipo inválido. Use '24h' ou '30min'");
        }

        return new Response(
            JSON.stringify({ success: true, message: `Lembretes ${type} processados` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Erro ao processar lembretes:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function send24hReminders() {
    console.log("[Reminders] Processando lembretes 24h...");

    const { data: appointments, error } = await supabase.rpc(
        "get_appointments_needing_24h_reminder"
    );

    if (error) throw error;

    console.log(`[Reminders] ${appointments.length} agendamentos encontrados`);

    for (const apt of appointments) {
        // Email principal
        await sendReminderEmail(apt, "24h");

        // Emails adicionais
        if (apt.additional_emails && apt.additional_emails.length > 0) {
            for (const email of apt.additional_emails) {
                await sendReminderEmail({ ...apt, patient_email: email }, "24h");
            }
        }

        // Gerar mensagem WhatsApp (para cópia manual)
        const whatsappMessage = generateWhatsAppMessage(apt, "24h");
        console.log(`[WhatsApp] Mensagem para ${apt.patient_phone}:\n${whatsappMessage}`);

        // Marcar como enviado
        await supabase
            .from("appointments")
            .update({
                reminder_24h_sent: true,
                reminder_24h_sent_at: new Date().toISOString(),
            })
            .eq("id", apt.appointment_id);
    }

    console.log("[Reminders] ✅ Lembretes 24h processados");
}

async function send30minReminders() {
    console.log("[Reminders] Processando lembretes 30min...");

    const { data: appointments, error } = await supabase.rpc(
        "get_appointments_needing_30min_reminder"
    );

    if (error) throw error;

    console.log(`[Reminders] ${appointments.length} agendamentos encontrados`);

    for (const apt of appointments) {
        await sendReminderEmail(apt, "30min");

        if (apt.additional_emails && apt.additional_emails.length > 0) {
            for (const email of apt.additional_emails) {
                await sendReminderEmail({ ...apt, patient_email: email }, "30min");
            }
        }

        const whatsappMessage = generateWhatsAppMessage(apt, "30min");
        console.log(`[WhatsApp] Mensagem para ${apt.patient_phone}:\n${whatsappMessage}`);

        await supabase
            .from("appointments")
            .update({
                reminder_30min_sent: true,
                reminder_30min_sent_at: new Date().toISOString(),
            })
            .eq("id", apt.appointment_id);
    }

    console.log("[Reminders] ✅ Lembretes 30min processados");
}

async function sendReminderEmail(appointment: any, type: string) {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return;

    const [year, month, day] = appointment.scheduled_date.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    const subject = type === "24h"
        ? "Lembrete: Consulta amanhã!"
        : "Sua consulta é daqui a 30 minutos!";

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .highlight { background: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Olá, ${appointment.patient_name}! 👋</h1>
          
          ${type === "24h" ? "<p>Este é um lembrete de que sua consulta está marcada para <strong>amanhã</strong>:</p>" :
            "<p>Sua consulta começa em <strong>30 minutos</strong>!</p>"}
          
          <div class="highlight">
            <p><strong>📅 Data:</strong> ${formattedDate}</p>
            <p><strong>🕐 Horário:</strong> ${appointment.scheduled_time}</p>
          </div>
          
          ${type === "30min" ? `
            <p>Por favor, confirme sua presença clicando no botão abaixo:</p>
            <a href="${Deno.env.get("APP_URL") || "https://psimanager-bay.vercel.app"}/reconfirmar?id=${appointment.appointment_id}" class="button">
              Confirmar Presença
            </a>
          ` : ""}
          
          <p>Aguardamos você! 💚</p>
        </div>
      </body>
    </html>
  `;

    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: "PsiManager <noreply@psimanager.com>",
                to: [appointment.patient_email],
                subject: subject,
                html: html,
            }),
        });

        console.log(`[Email] ✅ Enviado para ${appointment.patient_email}`);
    } catch (error) {
        console.error(`[Email] ❌ Erro ao enviar para ${appointment.patient_email}:`, error);
    }
}

function generateWhatsAppMessage(appointment: any, type: string): string {
    const [year, month, day] = appointment.scheduled_date.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    if (type === "24h") {
        return `Olá ${appointment.patient_name}! 👋

Este é um lembrete de que sua consulta está marcada para *amanhã*:

📅 Data: ${formattedDate}
🕐 Horário: ${appointment.scheduled_time}

Aguardamos você! 💚

_Mensagem automática - PsiManager_`;
    } else {
        return `Olá ${appointment.patient_name}! 👋

Sua consulta começa em *30 minutos*!

📅 Data: ${formattedDate}
🕐 Horário: ${appointment.scheduled_time}

Por favor, confirme sua presença: ${Deno.env.get("APP_URL") || "https://psimanager-bay.vercel.app"}/reconfirmar?id=${appointment.appointment_id}

Aguardamos você! 💚

_Mensagem automática - PsiManager_`;
    }
}
