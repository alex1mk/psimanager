// ─── SENIOR EDGE FUNCTION: SEND CONFIRMATION EMAIL ──────────────────────────
// Rigor Técnico: Padrões de Clean Code, Otimização e Segurança.
// Propósito: Disparo de e-mail de confirmação via Resend API.
// Versão: 2.0.0 (Skill-Hard-Senior)
// ────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, date, time, link } = await req.json();

    // 1. Validação Crítica de Payload
    if (!email || !name || !date || !time || !link) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios ausentes no payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validação de Segurança: Environment Variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("[CRITICAL] Resend API Key não configurada no ambiente Supabase");
      return new Response(
        JSON.stringify({ error: "Serviço de e-mail temporariamente indisponível (Secret missing)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Formatação Robusta de Data
    // Assume-se formato YYYY-MM-DD vindo do input type="date"
    const [year, month, day] = date.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    console.log(`[Senior-Log] Iniciando disparo para: ${email} (Agendamento: ${formattedDate} ${time})`);

    // 4. Envio via Fetch (Otimizado: Evita dependências pesadas de SDK se não necessário)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "PsiManager <onboarding@resend.dev>", // Usando onboarding para sandbox, alterar em prod real
        to: [email],
        subject: `✨ Confirmação de Agendamento: ${name}`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
      background-color: #f4f7f6;
    }
    .main-container {
      background: #ffffff;
      border-radius: 12px;
      margin: 40px auto;
      padding: 32px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border: 1px solid #e5e7eb;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      color: #166534;
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      color: #6b7280;
      margin: 0;
      font-size: 16px;
    }
    .appointment-box {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 24px;
      margin: 32px 0;
      border-radius: 8px;
    }
    .appointment-box p {
      margin: 12px 0;
      font-size: 16px;
      color: #374151;
    }
    .appointment-box strong {
      color: #166534;
    }
    .cta-button {
      display: block;
      background-color: #10b981;
      color: #ffffff !important;
      text-align: center;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 16px;
      margin: 32px 0;
      transition: background 0.3s ease;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #f1f5f9;
      color: #94a3b8;
      font-size: 13px;
    }
    .link-fallback {
      font-size: 11px;
      color: #94a3b8;
      word-break: break-all;
      margin-top: 24px;
      text-align: center;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <div class="main-container">
    <div class="header">
      <h1>✨ Confirme seu Agendamento</h1>
      <p>Olá, <strong>${name}</strong>!</p>
    </div>
    
    <p style="text-align: center;">Recebemos uma solicitação de agendamento para você. Por favor, valide os detalhes abaixo:</p>
    
    <div class="appointment-box">
      <p><strong>📅 Data:</strong> ${formattedDate}</p>
      <p><strong>🕐 Horário:</strong> ${time}</p>
    </div>
    
    <p style="text-align: center; font-weight: 500;">Para garantir seu horário, clique no botão abaixo:</p>
    
    <a href="${link}" class="cta-button">
      Confirmar Minha Presença
    </a>
    
    <div class="footer">
      <p>Sistema PsiManager - Cuidado e Acolhimento</p>
      <p>Se você não reconhece este agendamento, por favor ignore este e-mail.</p>
    </div>
    
    <div class="link-fallback">
      Caso o botão não funcione, utilize o link: ${link}
    </div>
  </div>
</body>
</html>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[ERROR] Falha na API Resend:", errorData);
      throw new Error(errorData.message || "Erro de comunicação com provedor de e-mail");
    }

    const data = await response.json();
    console.log("✅ [Senior-Log] E-mail enviado com sucesso. ID:", data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ [EXCEPTION] send-confirmation-email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro crítico interno ao processar e-mail",
        context: "Edge Function Runtime"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
