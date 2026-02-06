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
        const { event_id } = await req.json();

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

        // Deletar evento (ou marcar como cancelado)
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: event_id,
        });

        console.log("[GoogleCalendar] ✅ Event cancelled:", event_id);

        return new Response(
            JSON.stringify({
                success: true,
                event_id: event_id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[GoogleCalendar] ❌ Error:", error);

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Erro ao cancelar evento",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
