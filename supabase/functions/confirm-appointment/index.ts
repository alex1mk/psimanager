// ─── EDGE FUNCTION: CONFIRM APPOINTMENT ─────────────────────────────────────
// Purpose: Confirms an appointment with user-provided details (date, time, recurrence)
// Created: 2026-02-06
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
        const {
            token,
            date,
            time,
            recurrence,
            payment_method,
            payment_due_day,
            additional_email,
            additional_phone
        } = await req.json();

        // 1. Validar token
        let targetAppointmentId = null;
        let patientDetails = null;

        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*, appointment:appointments(*, patient:patients(*))")
            .eq("token", token)
            .single();

        if (tokenData && !tokenError) {
            if (new Date(tokenData.expires_at) < new Date()) {
                return new Response(JSON.stringify({ error: "Token expirado" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            if (tokenData.used_at) {
                return new Response(JSON.stringify({ error: "Token já utilizado" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            targetAppointmentId = tokenData.appointment_id;
            patientDetails = tokenData.appointment.patient;
        } else {
            // Fluxo HMAC Fallback
            const body = await req.clone().json();
            const patient_id = body.patient_id;
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
                    const { data: patient } = await supabase.from("patients").select("*").eq("id", patient_id).single();
                    const { data: appointment } = await supabase
                        .from("appointments")
                        .select("id")
                        .eq("patient_id", patient_id)
                        .eq("status", "pending_confirmation") // Updated status check
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .single();

                    targetAppointmentId = appointment?.id;
                    patientDetails = patient;
                }
            }
        }

        if (!targetAppointmentId || !patientDetails) {
            return new Response(
                JSON.stringify({ error: "Token inválido ou agendamento não encontrado" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Validar conflito de horário
        const { data: conflicts } = await supabase
            .from("appointments")
            .select("id")
            .eq("scheduled_date", date)
            .eq("scheduled_time", time)
            .neq("status", "cancelled")
            .neq("id", targetAppointmentId);

        if (conflicts && conflicts.length > 0) {
            return new Response(
                JSON.stringify({ error: "Horário já está ocupado. Por favor, escolha outro." }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Atualizar Dados do Paciente (Pagamento e Contatos)
        const patientUpdates: any = {};
        if (payment_method) patientUpdates.payment_method = payment_method;
        if (payment_due_day) patientUpdates.payment_due_day = payment_due_day;

        // Append additional contacts if provided and not duplicate
        // Note: Logic simplified for brevity, in production consider deduping
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

        // 5. Marcar token como usado (se UUID)
        if (tokenData) {
            await supabase
                .from("confirmation_tokens")
                .update({ used_at: new Date().toISOString() })
                .eq("token", token);
        }

        // 6. Sincronizar com Google Calendar
        const calendarResult = await syncGoogleCalendar(
            patientDetails.name,
            date,
            time,
            recurrence
        );

        if (calendarResult.success) {
            await supabase
                .from("appointments")
                .update({ google_event_id: calendarResult.eventId })
                .eq("id", targetAppointmentId);
        }

        // 7. Enviar e-mail de confirmação
        await sendConfirmationEmail(
            patientDetails.email,
            patientDetails.name,
            date,
            time
        );

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: "Erro ao confirmar agendamento" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function syncGoogleCalendar(
    patientName: string,
    date: string,
    time: string,
    recurrence: string
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

        // Gerar RRULE RFC 5545 (Array de strings)
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

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: {
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
                active: true,
                colorId: "10", // Verde Basilio (Senior Standard)
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: "popup", minutes: 30 },
                        { method: "email", minutes: 60 },
                    ],
                },
            },
        });

        if (response.status !== 200 && response.status !== 201) {
            throw new Error(`Google API status: ${response.status}`);
        }

        console.log("✅ [GoogleCalendar] Evento sincronizado:", response.data.id);
        return { success: true, eventId: response.data.id };
    } catch (error) {
        console.error("❌ [GoogleCalendar Error]:", error);
        return { success: false };
    }
}

async function sendConfirmationEmail(
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

        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: "PsiManager <noreply@psimanager.com>",
                to: [email],
                subject: "Agendamento Confirmado",
                html: `
          <h1>Olá, ${name}!</h1>
          <p>Seu agendamento foi confirmado:</p>
          <p><strong>📅 Data:</strong> ${formattedDate}</p>
          <p><strong>🕐 Horário:</strong> ${time}</p>
          <p>Aguardamos você!</p>
        `,
            }),
        });

        console.log("✅ Email sent to:", email);
    } catch (error) {
        console.error("❌ Email error:", error);
    }
}
