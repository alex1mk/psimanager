// confirm-scheduling/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers for public access via email confirmation links
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow GET requests for the confirmation link
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");

  if (!patientId) {
    return new Response("Erro: ID do paciente não fornecido.", {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    // 1. Fetch Patient Data
    const { data: patient, error: fetchError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (fetchError || !patient) {
      return new Response("Erro: Paciente não encontrado.", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    // Check if there's already a confirmed appointment for this patient
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, scheduled_date")
      .eq("patient_id", patientId)
      .eq("status", "confirmed")
      .order("scheduled_date", { ascending: false })
      .limit(1)
      .single();

    if (existingAppointment) {
      return new Response(
        `
              <!DOCTYPE html>
              <html lang="pt-BR">
                <head>
                   <meta charset="UTF-8">
                   <style>
                     body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #fef3c7; color: #92400e; margin: 0; }
                     .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
                     h1 { margin-bottom: 20px; color: #d97706; }
                   </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Presença Já Confirmada</h1>
                    <p>Sua presença já foi confirmada anteriormente.</p>
                    <p>Aguardamos você no horário agendado!</p>
                  </div>
                </body>
              </html>
            `,
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    }

    // 2. Calculate Next Appointment Date
    // Simplification: We assume next occurrence of the fixedDay
    const nextDate = calculateNextDate(patient.fixed_day);
    const startTime = patient.fixed_time; // e.g., "14:00"

    // 3. Create Appointment in DB
    const { error: appError } = await supabase.from("appointments").insert({
      patient_id: patient.id,
      scheduled_date: nextDate, // YYYY-MM-DD
      scheduled_time: startTime,
      status: "confirmed",
      source: "internal",
    });

    if (appError) console.error("DB Error (Appointments):", appError);

    // 4. Update Patient Status
    const { error: updateError } = await supabase
      .from("patients")
      .update({ status: "active" }) // or 'confirmed' if you added that status
      .eq("id", patientId);

    if (updateError) console.error("DB Error (Patient):", updateError);

    // 5. Add to Google Calendar
    try {
      console.log(
        `[Google Calendar] Attempting to create event for ${patient.name} on ${nextDate} at ${startTime}`,
      );
      await addToGoogleCalendar(patient.name, nextDate, startTime);
    } catch (gError) {
      console.error("Google Calendar Error:", gError);
      // We don't fail the request if Calendar fails, just log it
    }

    // 6. Send WhatsApp Notification (Twilio)
    try {
      console.log(
        `[WhatsApp] Attempting to send confirmation to ${patient.phone}`,
      );
      await sendWhatsAppConfirmation(
        patient.name,
        patient.phone,
        nextDate,
        startTime,
      );
    } catch (wError) {
      console.error("Twilio/WhatsApp Error:", wError);
    }

    // 7. Return Success Page
    return new Response(
      `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
           <meta charset="UTF-8">
           <style>
             body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #f0fdf4; color: #166534; margin: 0; }
             .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; width: 90%; }
             h1 { margin-bottom: 20px; font-size: 24px; }
             p { line-height: 1.5; margin: 10px 0; }
           </style>
        </head>
        <body>
          <div class="card">
            <h1>Agendamento Confirmado!</h1>
            <p>Sua consulta foi agendada para <strong>${nextDate.split("-").reverse().join("/")} às ${startTime}</strong>.</p>
            <p>Uma confirmação também foi enviada para seu WhatsApp.</p>
            <p>Obrigado, ${patient.name}.</p>
          </div>
        </body>
      </html>
    `,
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  } catch (err) {
    console.error("Unhandled Edge Function Error:", err);
    return new Response(
      `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #fef2f2; color: #991b1b; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Erro no Processamento</h1>
            <p>Não foi possível confirmar seu agendamento. Por favor, tente novamente ou entre em contato diretamente.</p>
          </div>
        </body>
      </html>
    `,
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  }
});

// --- Helper Functions ---

function calculateNextDate(dayName: string): string {
  const daysMap: { [key: string]: number } = {
    Domingo: 0,
    "Segunda-feira": 1,
    Segunda: 1,
    "Terça-feira": 2,
    Terça: 2,
    "Quarta-feira": 3,
    Quarta: 3,
    "Quinta-feira": 4,
    Quinta: 4,
    "Sexta-feira": 5,
    Sexta: 5,
    Sábado: 6,
  };
  const targetDay = daysMap[dayName];
  if (targetDay === undefined) return new Date().toISOString().split("T")[0]; // Fallback to today

  const today = new Date();
  const resultDate = new Date(today);

  // Calculate days until next occurrence
  // If today is Monday(1) and we want Monday(1), we default to *next* week or today?
  // Usually confirmed means upcoming. Let's say if today is the day, we schedule for next week,
  // or if the time has passed... for simplicity, let's just find the next occurrence index.
  resultDate.setDate(today.getDate() + ((targetDay + 7 - today.getDay()) % 7));

  // If calculated date is today, check time? Assuming simplified "future date" logic:
  // If result is today, invoke next week logic if you want strict future.
  // For now, allow today.

  return resultDate.toISOString().split("T")[0];
}

async function addToGoogleCalendar(
  patientName: string,
  date: string,
  time: string,
) {
  const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY"); // JSON string
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID"); // 'primary' or specific email

  if (!serviceAccountKey || !calendarId) {
    console.warn("Skipping Google Calendar: Credentials not found.");
    return;
  }

  try {
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    // Calculate End Time (assume 1h duration)
    // We construct the string directly to avoid UTC conversion shifts in the SDK
    const startDateTime = `${date}T${time}:00`;
    const [hours, minutes] = time.split(":").map(Number);
    let endHours = hours + 1;
    let endDateStr = date;

    // Handle day overflow if 23:00 -> 00:00 (unlikely for therapy but good practice)
    if (endHours >= 24) {
      endHours = 0;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      endDateStr = nextDay.toISOString().split("T")[0];
    }
    const endDateTime = `${endDateStr}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

    console.log(
      `Creating calendar event for ${patientName} at ${startDateTime}`,
    );

    await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `Consulta - ${patientName}`,
        description:
          "Agendamento confirmado automaticamente via Supabase / PsiManager.",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
        colorId: "2", // Green (Sage)
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "email", minutes: 60 },
          ],
        },
      },
    });
    console.log("Calendar event created successfully!");
  } catch (err) {
    console.error("Critical Google Calendar error:", err);
    throw err; // Re-throw to be caught by the outer try-catch
  }
}

async function sendWhatsAppConfirmation(
  name: string,
  phone: string,
  date: string,
  time: string,
) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER"); // e.g. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Skipping WhatsApp: Twilio credentials not found.");
    return;
  }

  // Clean phone number: remove non-numeric, ensure +55 (BR) if missing
  let cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone.startsWith("55") && cleanPhone.length > 9) {
    cleanPhone = "55" + cleanPhone;
  }
  const toNumber = `whatsapp:+${cleanPhone}`;

  const messageBody = `Olá ${name}, sua consulta foi confirmada para ${date.split("-").reverse().join("/")} às ${time}. Até lá!`;

  console.log(`Sending WhatsApp to ${toNumber}: ${messageBody}`);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(accountSid + ":" + authToken)}`,
      },
      body: new URLSearchParams({
        To: toNumber,
        From: fromNumber,
        Body: messageBody,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twilio API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  console.log("WhatsApp sent! SID:", data.sid);
}
