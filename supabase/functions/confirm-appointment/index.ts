import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";
import { supabase, corsHeaders } from "@shared/supabaseClient.ts";

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        interface RequestBody {
            token?: string;
            date?: string;
            time?: string;
            recurrence?: string;
            payment_method?: string;
            payment_due_day?: number;
            additional_email?: string;
            additional_phone?: string;
            preview?: boolean;
        }

        const body: RequestBody = await req.json();
        const {
            token: rawToken,
            date,
            time,
            recurrence,
            payment_method,
            payment_due_day,
            additional_email,
            additional_phone,
            preview
        } = body;

        const token: string | undefined = rawToken?.trim();

        if (!token) {
            return new Response(
                JSON.stringify({ error: "Token é obrigatório" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[confirm-appointment] Processando ${preview ? 'PREVIEW' : 'CONFIRMAÇÃO'} para token: "${token?.substring(0, 10)}..." (Length: ${token?.length})`);

        // 1. Validar token
        const cleanToken = token?.trim();
        const { data: tokenData, error: tokenError } = await supabase
            .from("confirmation_tokens")
            .select("*")
            .eq("token", cleanToken)
            .maybeSingle();

        if (tokenError || !tokenData) {
            console.error(`[confirm-appointment] ❌ Token NÃO ENCONTRADO no banco: "${cleanToken}"`);

            // DIAGNÓSTICO: Buscar qualquer token para ver se a tabela está acessível e ver o formato
            const { data: anyToken } = await supabase.from("confirmation_tokens").select("token").limit(1);
            if (anyToken && anyToken.length > 0) {
                console.log(`[DEBUG] Token de exemplo no DB: "${anyToken[0].token}" (Length: ${anyToken[0].token.length})`);
            } else {
                console.log("[DEBUG] Tabela confirmation_tokens parece estar vazia ou inacessível.");
            }
            return new Response(
                JSON.stringify({ error: "Link de confirmação inválido ou expirado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Verificar se já foi usado (bloqueia confirmação, mas permite preview com aviso)
        if (tokenData.used_at && !preview) {
            return new Response(
                JSON.stringify({ error: "Este link já foi utilizado anteriormente" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Verificar expiração
        if (new Date(tokenData.expires_at) < new Date()) {
            console.warn(`[confirm-appointment] Link expirado: ${tokenData.expires_at}`);
            return new Response(
                JSON.stringify({ error: "Este link de confirmação expirou" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 4. Buscar agendamento e paciente
        const { data: appointment, error: appError } = await supabase
            .from("appointments")
            .select(`
                *,
                patient:patients(*)
            `)
            .eq("id", tokenData.appointment_id)
            .maybeSingle();

        if (appError || !appointment) {
            console.error("[confirm-appointment] Agendamento não encontrado:", appError);
            throw new Error("Agendamento não encontrado.");
        }

        const patientDetails = appointment.patient;

        // 5. Se for apenas PREVIEW, retornar dados aqui
        if (preview) {
            return new Response(
                JSON.stringify({
                    appointment: {
                        patient_name: patientDetails.name,
                        suggested_date: appointment.scheduled_date,
                        suggested_time: appointment.scheduled_time,
                        used_at: tokenData.used_at
                    }
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 6. Validar conflito de horário
        const { data: conflicts } = await supabase
            .from("appointments")
            .select("id")
            .eq("scheduled_date", date)
            .eq("scheduled_time", time)
            .neq("status", "cancelled")
            .neq("id", appointment.id);

        if (conflicts && conflicts.length > 0) {
            return new Response(
                JSON.stringify({ error: "Horário já está ocupado. Por favor, escolha outro." }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 7. Atualizar Dados do Paciente
        const patientUpdates: any = {};
        if (payment_method) patientUpdates.payment_method = payment_method;
        if (payment_due_day) patientUpdates.payment_due_day = payment_due_day;

        if (additional_email && !patientDetails.additional_emails?.includes(additional_email)) {
            patientUpdates.additional_emails = [...(patientDetails.additional_emails || []), additional_email];
        }
        if (additional_phone && !patientDetails.additional_phones?.includes(additional_phone)) {
            patientUpdates.additional_phones = [...(patientDetails.additional_phones || []), additional_phone];
        }

        if (Object.keys(patientUpdates).length > 0) {
            await supabase.from("patients").update(patientUpdates).eq("id", patientDetails.id);
        }

        // 8. Atualizar Agendamento
        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                scheduled_date: date,
                scheduled_time: time,
                recurrence_type: recurrence,
                status: "confirmed",
            })
            .eq("id", appointment.id);

        if (updateError) throw updateError;

        // 9. Marcar token como usado
        await supabase
            .from("confirmation_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("token", token.trim());

        // 10. Sync Google Calendar
        try {
            const calendarResult = await syncGoogleCalendar(patientDetails.name, date, time, recurrence, patientDetails.email);
            if (calendarResult.success) {
                await supabase.from("appointments").update({ google_event_id: calendarResult.eventId }).eq("id", appointment.id);
            }
        } catch (calErr) {
            console.error("[confirm-appointment] Erro não-crítico Calendar:", calErr);
        }

        // 11. Email de Sucesso
        try {
            await sendSuccessEmail(patientDetails.email, patientDetails.name, date, time);
        } catch (emailErr) {
            console.error("[confirm-appointment] Erro envio email sucesso:", emailErr);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("[confirm-appointment] Erro Fatal:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro interno ao confirmar agendamento" }),
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
