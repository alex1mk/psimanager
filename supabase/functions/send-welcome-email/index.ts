// ─── MODIFICAÇÃO: Removida dependência do Twilio ───────────────────────────
// Motivo: Limpeza de código obsoleto - Twilio descontinuado
// Impacto: Apenas email é enviado; WhatsApp será via n8n no futuro
// Data: 2026-02-06
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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

    // 1. Generate Link for the new Public Confirmation Portal (Vercel)
    const appUrl = "https://psimanager-bay.vercel.app"; // URL principal do app

    // Validar se já existe um token para este agendamento/paciente
    // Nota: O trigger vem do INSERT do patient, mas o agendamento pode ainda não existir
    // ou ser criado simultaneamente pelo frontend.

    const secret = Deno.env.get("CONFIRMATION_SECRET") || "your-secret-key-here";
    // Gerar HMAC para compatibilidade legada ou fallback
    const hmacToken = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`${id}:${secret}`))
      .then((buffer) =>
        Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

    // Link oficial apontando para o PORTAL (Frontend) e não mais para a Edge Function direta
    const confirmLink = `${appUrl}/confirmar?token=${hmacToken}&patient_id=${id}`;

    // 2. Determine Recipients (Test Mode Support)
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const toEmail = adminEmail || email;

    console.log(`[Function] Sending Email to ${toEmail}`);
    console.log(`[Link] Generated (Portal): ${confirmLink}`);

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
