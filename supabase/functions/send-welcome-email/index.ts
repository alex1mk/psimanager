// Setup type definitions for built-in Supabase Runtime APIs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import twilio from "npm:twilio@4.19.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const twilioClient = twilio(
  Deno.env.get("TWILIO_ACCOUNT_SID"),
  Deno.env.get("TWILIO_AUTH_TOKEN"),
);

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    [key: string]: any;
  };
  schema: string;
  old_record: null | any;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    console.log("Webhook received:", payload);

    // Validate event type
    if (payload.type !== "INSERT") {
      return new Response(
        JSON.stringify({ message: "Ignored: Not an INSERT event" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const { id, name, email, phone } = payload.record;

    // 1. Generate Secure Confirmation Link with HMAC Token
    const secret = Deno.env.get("CONFIRMATION_SECRET") || "your-secret-key-here";
    const token = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`${id}:${secret}`))
      .then((buffer) =>
        Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

    const projectUrl =
      Deno.env.get("SUPABASE_URL") ?? "https://[YOUR_PROJECT_REF].supabase.co";
    const confirmLink = `${projectUrl}/functions/v1/confirm-scheduling?patient_id=${id}&token=${token}`;

    // 2. Determine Recipients (Test Mode Support)
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const toEmail = adminEmail || email;

    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const toPhone = adminPhone || phone;

    console.log(
      `Sending Notifications -> Email: ${toEmail}, WhatsApp: ${toPhone}`,
    );

    // 3. Send Email (Resend)
    const emailPromise = resend.emails.send({
      from: "Atendimento <onboarding@resend.dev>",
      to: [toEmail],
      subject: `Bem-vindo(a), ${name}! Confirme seu horário.`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Olá, ${name}!</h1>
          <p>Seja bem-vindo(a) ao Psimanager.</p>
          <p>Para confirmar seu agendamento, clique no botão abaixo:</p>
          <a href="${confirmLink}" style="background-color: #2C7E20; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirmar Presença</a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Link: ${confirmLink}
          </p>
          <hr />
          <p style="font-size: 10px; color: #999;">
            Enviado para: ${email}
          </p>
        </div>
      `,
    });

    // 4. Send WhatsApp Notification
    const twilioSender = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

    // Normalize phone (Brazil +55)
    let cleanPhone = toPhone.replace(/\D/g, "");
    if (cleanPhone.length === 11 || cleanPhone.length === 10) {
      cleanPhone = "55" + cleanPhone;
    } else if (!cleanPhone.startsWith("55") && cleanPhone.length > 0) {
      cleanPhone = "55" + cleanPhone;
    }
    const formattedToPhone = `whatsapp:+${cleanPhone}`;

    const results: any = { email: null, whatsapp: null };

    console.log(`[Function] Sending Email to ${toEmail}`);
    console.log(`[Link] Generated: ${confirmLink}`);

    try {
      results.email = await emailPromise;
      console.log("Email sent successfully");
    } catch (e) {
      console.error("Email failed:", e);
      results.email = { status: "rejected", reason: e.message };
    }

    console.log(`[Function] Sending WhatsApp to ${formattedToPhone}`);
    try {
      results.whatsapp = await twilioClient.messages.create({
        body: `Olá ${name}! Bem-vindo(a) ao Psimanager. 📝\n\nPor favor, confirme seu agendamento clicando aqui:\n${confirmLink}`,
        from: twilioSender,
        to: formattedToPhone,
      });
      console.log("WhatsApp sent successfully SID:", results.whatsapp.sid);
    } catch (e) {
      console.error("WhatsApp failed:", e);
      results.whatsapp = { status: "rejected", reason: e.message };
    }

    console.log("Notification Results:", results);

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
