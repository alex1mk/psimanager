import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { supabase, corsHeaders } from "@shared/supabaseClient.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const appUrl = "https://psimanager-bay.vercel.app";
    const secret = Deno.env.get("CONFIRMATION_SECRET") || "your-secret-key-here";

    // Gerar HMAC para compatibilidade legada ou fallback
    const hmacToken = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`${id}:${secret}`))
      .then((buffer) =>
        Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

    // 1. Resolver Link de Confirmação (Prioridade: UUID Token)
    let confirmLink = `${appUrl}/confirmar?patient_id=${id}&token=${hmacToken}`;

    try {
      // Tentar buscar se já existe um token para este agendamento (caso o agendamento tenha sido criado segundos antes)
      const { data: tokenData } = await supabase
        .from("confirmation_tokens")
        .select("token")
        .eq("patient_id", id) // Assumindo que temos patient_id ou podemos buscar via appointment
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenData?.token) {
        confirmLink = `${appUrl}/confirmar?token=${tokenData.token}`;
        console.log(`[send-welcome-email] Usando Token UUID real: ${tokenData.token}`);
      }
    } catch (e) {
      console.warn("[send-welcome-email] Falha ao buscar UUID token real, usando fallback HMAC.");
    }

    // 2. Determine Recipients (Test Mode Support)
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const toEmail = adminEmail || email;

    console.log(`[Function] Sending Email to ${toEmail}`);
    console.log(`[Link] Final Pattern: ${confirmLink}`);

    // 3. Send Email (Resend)
    const results: any = { email: null, whatsapp: null };

    try {
      results.email = await resend.emails.send({
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
      console.log("Email sent successfully");
    } catch (e) {
      console.error("Email failed:", e);
      results.email = { status: "rejected", reason: e.message };
    }

    // 4. WhatsApp Placeholder (n8n integration pending)
    // TODO: Implementar via n8n webhook quando configurado
    console.log(`[WhatsApp] 📋 Notificação pendente para: ${phone}`);
    console.log("[WhatsApp] ⏳ Aguardando configuração do webhook n8n...");
    results.whatsapp = {
      status: "pending",
      message: "WhatsApp via n8n não configurado"
    };

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
