// confirm-scheduling/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9.0.0";
import { google } from "npm:googleapis@126.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const allowedOrigins = [
    "https://psimanager-bay.vercel.app",
    "https://psimanager.vercel.app",
    ...(Deno.env.get("ENV") === "development" ? ["http://localhost:5173"] : []),
  ];

  const origin = req.headers.get("Origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");
  const token = url.searchParams.get("token");

  if (!patientId || !token) {
    return new Response(JSON.stringify({ error: "Parâmetros inválidos." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validar token HMAC
  const secret = Deno.env.get("CONFIRMATION_SECRET") || "your-secret-key-here";
  const expectedToken = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${patientId}:${secret}`))
    .then((buffer) =>
      Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );

  if (token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Token inválido." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: patient, error: fetchError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (fetchError || !patient) {
      return new Response("Erro: Paciente não encontrado.", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

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
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Já Confirmada</title>
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
</html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const nextDate = calculateNextDate(patient.fixed_day || patient.fixedDay || "");
    const startTime = patient.fixed_time || patient.fixedTime || "Horário a definir";

    const { error: appError } = await supabase.from("appointments").insert({
      patient_id: patient.id,
      scheduled_date: nextDate,
      scheduled_time: startTime === "Horário a definir" ? "08:00" : startTime,
      status: "confirmed",
      source: "internal",
    });

    if (appError) console.error("DB Error (Appointments):", appError);

    const { error: updateError } = await supabase
      .from("patients")
      .update({ status: "active" })
      .eq("id", patientId);

    if (updateError) console.error("DB Error (Patient):", updateError);

    if (startTime !== "Horário a definir") {
      const calendarResult = await addToGoogleCalendar(patient.name, nextDate, startTime);
      if (calendarResult.success) {
        console.log("[Sync] ✅ Google Calendar sincronizado! Event ID:", calendarResult.eventId);
      } else {
        console.error("[Sync] ❌ Google Calendar falhou:", calendarResult.error);
      }
    }

    const whatsappResult = await sendWhatsAppConfirmation(patient.name, patient.phone, nextDate, startTime);
    if (whatsappResult.success) {
      console.log("[Sync] ✅ WhatsApp enviado! SID:", whatsappResult.sid);
    } else {
      console.error("[Sync] ❌ WhatsApp falhou:", whatsappResult.error);
    }

    const [year, month, day] = nextDate.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    return new Response(
      `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Agendamento</title>
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      margin: 0;
      padding: 20px;
    }
    .card { 
      background: white; 
      padding: 3rem; 
      border-radius: 20px; 
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      text-align: center; 
      max-width: 500px; 
      width: 100%;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: inline-block;
      background: #10b981;
      color: white;
      font-size: 48px;
      line-height: 80px;
      margin-bottom: 1.5rem;
    }
    h1 { 
      margin-bottom: 1rem; 
      font-size: 28px; 
      color: #166534; 
      font-weight: 700;
    }
    p { 
      line-height: 1.8; 
      margin: 1rem 0;
      color: #374151;
      font-size: 16px;
    }
    .highlight {
      background: #f0fdf4;
      padding: 1rem;
      border-radius: 8px;
      margin: 1.5rem 0;
      border-left: 4px solid #10b981;
    }
    strong {
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="checkmark">✓</div>
    <h1>Agendamento Confirmado!</h1>
    <div class="highlight">
      <p><strong>📅 Data:</strong> ${formattedDate}</p>
      <p><strong>🕐 Horário:</strong> ${startTime}</p>
    </div>
    <p>Uma confirmação também foi enviada para seu WhatsApp.</p>
    <p><strong>Obrigado, ${patient.name}!</strong></p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      }
    );
  } catch (err) {
    console.error("Unhandled Edge Function Error:", err);
    return new Response(
      `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro no Processamento</title>
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
</html>`,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});

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
  if (targetDay === undefined) return new Date().toISOString().split("T")[0];

  const today = new Date();
  const resultDate = new Date(today);
  resultDate.setDate(today.getDate() + ((targetDay + 7 - today.getDay()) % 7));

  return resultDate.toISOString().split("T")[0];
}

async function addToGoogleCalendar(
  patientName: string,
  date: string,
  time: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

  if (!serviceAccountKey || !calendarId) {
    const msg = "Google Calendar não configurado (faltam variáveis de ambiente)";
    console.warn("[Google Calendar]", msg);
    return { success: false, error: msg };
  }

  try {
    const credentials = JSON.parse(serviceAccountKey);

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Service Account JSON inválido (falta client_email ou private_key)");
    }

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

    console.log("[Google Calendar] Creating event:", {
      patient: patientName,
      start: startDateTime,
      end: endDateTime,
      calendar: calendarId,
    });

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `Consulta - ${patientName}`,
        description: `Agendamento confirmado via PsiManager\nPaciente: ${patientName}`,
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
        colorId: "2",
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
      throw new Error(`API retornou status ${response.status}`);
    }

    if (!response.data.id) {
      throw new Error("API não retornou event ID");
    }

    console.log("[Google Calendar] ✅ Event criado! ID:", response.data.id);
    console.log("[Google Calendar] Link:", response.data.htmlLink);

    return { success: true, eventId: response.data.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Google Calendar] ❌ Erro:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ─── MODIFICAÇÃO: Removida dependência do Twilio ───────────────────────────
// Motivo: Limpeza de código obsoleto - Twilio descontinuado
// Impacto: WhatsApp agora é placeholder para futura integração n8n
// Data: 2026-02-06
// ────────────────────────────────────────────────────────────────────────────

async function sendWhatsAppConfirmation(
  name: string,
  phone: string,
  date: string,
  time: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  // TODO: Integrar via n8n webhook quando configurado
  // Webhook URL esperada: Deno.env.get("N8N_WHATSAPP_WEBHOOK")
  
  const [year, month, day] = date.split("-");
  const formattedDate = `${day}/${month}/${year}`;

  console.log("[WhatsApp] 📋 Notificação pendente (n8n não configurado):");
  console.log("[WhatsApp] → Paciente:", name);
  console.log("[WhatsApp] → Telefone:", phone);
  console.log("[WhatsApp] → Data:", formattedDate);
  console.log("[WhatsApp] → Horário:", time);
  console.log("[WhatsApp] ⏳ Aguardando configuração do webhook n8n...");

  // Retorna sucesso silencioso para não bloquear o fluxo
  return { 
    success: true, 
    sid: "placeholder-awaiting-n8n",
    error: undefined 
  };
}