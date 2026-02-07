// ─── EDGE FUNCTION: CONFIRM APPOINTMENT ─────────────────────────────────────
// Purpose: Confirms an appointment with user-provided details (date, time, recurrence)
// Created: 2026-02-06
// Updated: 2026-02-07 (Added Detailed Logging)
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";

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
        const {
            token,
            date,
            time,
            recurrence,
            payment_method,
            payment_due_day,
            additional_email,
            additional_phone
        } = body;

        console.log(`[confirm-appointment] Iniciando confirmação. Token: ${token?.substring(0, 10)}...`);

        // 1. Validar token
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*")
            .eq("token", token)
            .maybeSingle();

        if (tokenError) throw new Error(`Erro ao buscar token: ${tokenError.message}`);

        if (!tokenData) {
            console.error("[confirm-appointment] Token não encontrado.");
            return new Response(
                JSON.stringify({ error: "Link de confirmação inválido ou já utilizado." }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "Token expirado." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (tokenData.used_at) {
            return new Response(JSON.stringify({ error: "Agendamento já confirmado." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const targetAppointmentId = tokenData.appointment_id;

        // 2. Buscar Agendamento (Isolado)
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select("*")
            .eq("id", targetAppointmentId)
            .maybeSingle();

        if (appError || !appointment) throw new Error("Agendamento não encontrado.");

        // 3. Buscar Paciente (Isolado)
        const { data: patientDetails, error: patientError } = await supabase
            .from("patients")
            .select("*")
            .eq("id", appointment.patient_id)
            .maybeSingle();

        if (patientError || !patientDetails) throw new Error("Dados do paciente não encontrados.");

        // 2. Validar conflito de horário
        const { data: conflicts } = await supabase
            .from("appointments")
            .select("id")
            .eq("scheduled_date", date)
            .eq("scheduled_time", time)
            .neq("status", "cancelled")
            .neq("id", targetAppointmentId);

        if (conflicts && conflicts.length > 0) {
            console.warn(`[confirm-appointment] Conflito detectado para ${date} ${time}`);
            return new Response(
                JSON.stringify({ error: "Horário já está ocupado. Por favor, escolha outro." }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Atualizar Dados do Paciente (Pagamento e Contatos)
        console.log(`[confirm-appointment] Atualizando dados do paciente ${patientDetails.id}`);
        const patientUpdates: any = {};
        if (payment_method) patientUpdates.payment_method = payment_method;
        if (payment_due_day) patientUpdates.payment_due_day = payment_due_day;

        if (additional_email) {
            const existingEmails = patientDetails.additional_emails || [];
            if (!existingEmails.includes(additional_email)) {
                patientUpdates.additional_emails = [...existingEmails, additional_email];
            }
        }
        if (additional_phone) {
            const existingPhones = patientDetails.additional_phones || [];
            if (!existingPhones.includes(additional_phone)) {
                patientUpdates.additional_phones = [...existingPhones, additional_phone];
            }
        }

        if (Object.keys(patientUpdates).length > 0) {
            await supabase
                .from("patients")
                .update(patientUpdates)
                .eq("id", patientDetails.id);
        }

        // 4. Atualizar Agendamento
        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                scheduled_date: date,
                scheduled_time: time,
                recurrence_type: recurrence,
                status: "confirmed",
            })
            .eq("id", targetAppointmentId);

        if (updateError) throw updateError;

        // 5. Marcar token como usado
        if (tokenData) {
            await supabase
                .from("confirmation_tokens")
                .update({ used_at: new Date().toISOString() })
                .eq("token", token);
        }

        // 6. Sincronizar com Google Calendar
        console.log("[confirm-appointment] Iniciando sync com Google Calendar...");
        const calendarResult = await syncGoogleCalendar(
            patientDetails.name,
            date,
            time,
            recurrence,
            patientDetails.email // Passando email para tentar convidar
        );

        if (calendarResult.success) {
            console.log(`[confirm-appointment] Google Event ID gerado: ${calendarResult.eventId}`);
            await supabase
                .from("appointments")
                .update({ google_event_id: calendarResult.eventId })
                .eq("id", targetAppointmentId);
        } else {
            console.error("[confirm-appointment] Falha no sync com Google Calendar.");
        }

        // 7. Enviar e-mail de confirmação (sem await para não bloquear response se falhar na Vercel time limit)
        // Mas como é Edge Function, melhor aguardar.
        try {
            await sendSuccessEmail(
                patientDetails.email,
                patientDetails.name,
                date,
                time
            );
        } catch (emailErr) {
            console.error("[confirm-appointment] Erro ao enviar email de sucesso:", emailErr);
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("[FATAL ERROR]:", error);
        return new Response(
            JSON.stringify({
                error: "Erro interno ao confirmar agendamento",
                details: error.message
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function syncGoogleCalendar(
    patientName: string,
    date: string,
    time: string,
    recurrence: string,
    attendeeEmail?: string
): Promise<{ success: boolean; eventId?: string }> {
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

    if (!serviceAccountKey || !calendarId) {
        console.warn("[GoogleCalendar] Sincronização ignorada: Secrets não configurados.");
        return { success: false };
    }

    try {
        const credentials = JSON.parse(serviceAccountKey);
        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/calendar"],
        });

        const calendar = google.calendar({ version: "v3", auth });

        const [hours, minutes] = time.split(":").map(Number);
        const endHours = hours + 1;

        const startDateTime = `${date}T${time}:00-03:00`;
        const endDateTime = `${date}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00-03:00`;

        // Gerar RRULE RFC 5545
        let recurrenceRules: string[] | undefined;
        if (recurrence && recurrence !== "single") {
            if (recurrence === "weekly") {
                recurrenceRules = ["RRULE:FREQ=WEEKLY"];
            } else if (recurrence === "biweekly") {
                recurrenceRules = ["RRULE:FREQ=WEEKLY;INTERVAL=2"];
            } else if (recurrence === "monthly") {
                recurrenceRules = ["RRULE:FREQ=MONTHLY"];
            }
        }

        const eventPayload = {
            summary: `Consulta - ${patientName}`,
            description: "✅ Agendamento Seguro - PsiManager",
            start: {
                dateTime: startDateTime,
                timeZone: "America/Sao_Paulo",
            },
            end: {
                dateTime: endDateTime,
                timeZone: "America/Sao_Paulo",
            },
            recurrence: recurrenceRules,
            attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
            active: true,
            colorId: "10", // Verde Basilio
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "popup", minutes: 30 },
                    { method: "email", minutes: 60 },
                ],
            },
        };

        console.log("[GoogleCalendar] Enviando payload:", JSON.stringify(eventPayload, null, 2));

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: eventPayload,
        });

        if (response.status !== 200 && response.status !== 201) {
            console.error(`[GoogleCalendar] Erro na API. Status: ${response.status}`);
            throw new Error(`Google API status: ${response.status}`);
        }

        console.log("✅ [GoogleCalendar] Evento criado com sucesso. ID:", response.data.id);
        return { success: true, eventId: response.data.id };
    } catch (error) {
        console.error("❌ [GoogleCalendar Error DETAILED]:", error);
        return { success: false };
    }
}

async function sendSuccessEmail(
    email: string,
    name: string,
    date: string,
    time: string
): Promise<void> {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
        console.warn("Resend não configurado");
        return;
    }

    try {
        const [year, month, day] = date.split("-");
        const formattedDate = `${day}/${month}/${year}`;

        console.log(`[EmailSuccess] Enviando email para: ${email}`);

        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: "PsiManager <noreply@psimanager.com>",
                to: [email],
                subject: "Agendamento Confirmado - PsiManager",
                html: `
                  <div style="font-family: sans-serif; color: #333;">
                      <h1>Olá, ${name}!</h1>
                      <p>Sua consulta foi confirmada com sucesso!</p>
                      <p><strong>📅 Data:</strong> ${formattedDate}</p>
                      <p><strong>🕐 Horário:</strong> ${time}</p>
                      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                      <p style="font-size: 12px; color: #666;">Se precisar remarcar, entre em contato com antecedência.</p>
                  </div>
                `,
            }),
        });

        console.log("✅ [EmailSuccess] Email enviado.");
    } catch (error) {
        console.error("❌ [EmailSuccess Error]:", error);
    }
}
