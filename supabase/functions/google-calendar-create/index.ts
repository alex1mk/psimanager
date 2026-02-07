// ─── SENIOR EDGE FUNCTION: GOOGLE CALENDAR CREATE ────────────────────────────
// Rigor Técnico: Autenticação via JWT (Service Account), Suporte a Recorrência e Tratamento de Fuso Horário.
// Propósito: Criar eventos na agenda da psicóloga via Google Calendar API.
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";
import { supabase, corsHeaders } from "@shared/supabaseClient.ts";

serve(async (req) => {
    // 1. Preflight CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { patient_name, date, time, recurrence_type, recurrence_end_date, notes } = payload;

        // 2. Validação Exigente de Configuração (Secrets)
        const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

        if (!serviceAccountKey || !calendarId) {
            console.error("[GoogleCalendar] Erro: Variáveis GOOGLE_SERVICE_ACCOUNT_KEY ou GOOGLE_CALENDAR_ID não encontradas.");
            throw new Error("Infraestrutura de integração com Google não configurada (Secrets faltando).");
        }

        // 3. Autenticação e Instanciação da API
        const credentials = JSON.parse(serviceAccountKey);
        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/calendar"],
        });

        const calendar = google.calendar({ version: "v3", auth });

        // 4. Lógica de Tempo (Tratamento de Fuso Horário BR-3)
        // Calcula fim da sessão assumindo 1 hora de duração padrão
        const [hours, minutes] = time.split(":").map(Number);
        const endHours = hours + 1;

        // ISO Format: YYYY-MM-DDTHH:mm:ss-03:00
        const startDateTime = `${date}T${time}:00-03:00`;
        const endDateTime = `${date}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00-03:00`;

        // 5. Motor de Recorrência (RRULE RFC 5545)
        let recurrenceRules: string[] | undefined;

        if (recurrence_type && recurrence_type !== "single") {
            const until = recurrence_end_date ? `;UNTIL=${recurrence_end_date.replace(/-/g, "")}T235959Z` : "";

            switch (recurrence_type) {
                case "weekly":
                    recurrenceRules = [`RRULE:FREQ=WEEKLY${until}`];
                    break;
                case "biweekly":
                    recurrenceRules = [`RRULE:FREQ=WEEKLY;INTERVAL=2${until}`];
                    break;
                case "monthly":
                    recurrenceRules = [`RRULE:FREQ=MONTHLY${until}`];
                    break;
            }
        }

        console.log(`[GoogleCalendar] 🚀 Criando evento para: ${patient_name} em ${startDateTime}`);

        // 6. Chamada à API do Google
        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: {
                summary: `Consulta: ${patient_name}`,
                description: notes ? `${notes}\n\n🏷️ Gerado automaticamente pelo PsiManager` : "🏷️ Gerado automaticamente pelo PsiManager",
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
                colorId: "10", // Verde/Basilio para consultas
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
            throw new Error(`Google Calendar API retornou falha catastrófica: ${response.status}`);
        }

        const eventData = response.data;
        console.log(`[GoogleCalendar] ✅ Sucesso: Evento criado ID ${eventData.id}`);

        return new Response(
            JSON.stringify({
                success: true,
                event_id: eventData.id,
                details: {
                    link: eventData.htmlLink,
                    start: eventData.start,
                    end: eventData.end,
                    recurrence: eventData.recurrence,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("❌ [GoogleCalendar Exception]:", error);

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Erro desconhecido ao processar integração Google",
                stack: Deno.env.get("DEBUG") ? error.stack : undefined
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
