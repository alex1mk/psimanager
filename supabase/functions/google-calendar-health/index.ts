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
        const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

        if (!serviceAccountKey || !calendarId) {
            return new Response(
                JSON.stringify({
                    configured: false,
                    error: "Variáveis de ambiente não configuradas",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const credentials = JSON.parse(serviceAccountKey);

        if (!credentials.client_email || !credentials.private_key) {
            return new Response(
                JSON.stringify({
                    configured: false,
                    error: "Service Account JSON inválido",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/calendar"],
        });

        const calendar = google.calendar({ version: "v3", auth });

        // Testar acesso ao calendário
        await calendar.calendarList.get({ calendarId: calendarId });

        console.log("[GoogleCalendar] ✅ Health check passed");

        return new Response(
            JSON.stringify({
                configured: true,
                calendar_id: calendarId,
                service_account: credentials.client_email,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[GoogleCalendar] ❌ Health check failed:", error);

        return new Response(
            JSON.stringify({
                configured: false,
                error: error instanceof Error ? error.message : "Erro desconhecido",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
