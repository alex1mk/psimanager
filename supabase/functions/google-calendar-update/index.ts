import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { event_id, updates } = await req.json();

        if (!event_id) {
            throw new Error("event_id é obrigatório");
        }

        const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

        if (!serviceAccountKey || !calendarId) {
            throw new Error("Google Calendar não configurado");
        }

        const credentials = JSON.parse(serviceAccountKey);

        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/calendar"],
        });

        const calendar = google.calendar({ version: "v3", auth });

        // Buscar evento atual
        const existingEvent = await calendar.events.get({
            calendarId: calendarId,
            eventId: event_id,
        });

        if (!existingEvent.data) {
            throw new Error("Evento não encontrado no Google Calendar");
        }

        // Preparar updates
        const updatedFields: any = {
            summary: existingEvent.data.summary,
            description: existingEvent.data.description,
            start: existingEvent.data.start,
            end: existingEvent.data.end,
        };

        // Atualizar campos fornecidos
        if (updates.patient_name) {
            updatedFields.summary = `Consulta - ${updates.patient_name}`;
        }

        if (updates.date && updates.time) {
            const [hours, minutes] = updates.time.split(":").map(Number);
            const endHours = hours + 1;

            updatedFields.start = {
                dateTime: `${updates.date}T${updates.time}:00-03:00`,
                timeZone: "America/Sao_Paulo",
            };

            updatedFields.end = {
                dateTime: `${updates.date}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00-03:00`,
                timeZone: "America/Sao_Paulo",
            };
        }

        if (updates.notes) {
            updatedFields.description = updates.notes;
        }

        // Atualizar evento
        const response = await calendar.events.update({
            calendarId: calendarId,
            eventId: event_id,
            requestBody: updatedFields,
        });

        if (response.status !== 200) {
            throw new Error(`Google Calendar API retornou status ${response.status}`);
        }

        console.log("[GoogleCalendar] ✅ Event updated:", event_id);

        return new Response(
            JSON.stringify({
                success: true,
                event_id: response.data.id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[GoogleCalendar] ❌ Error:", error);

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Erro ao atualizar evento",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
