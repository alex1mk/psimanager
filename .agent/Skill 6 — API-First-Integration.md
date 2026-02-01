---
name: Skill-API-First-Integration.md
description: Camada de integração externa do PsiManager. Webhooks genéricos (agnóstico para n8n, WhatsApp ou qualquer orquestrador), Google Calendar sync, retry automático e contrato de eventos. Todo contato com sistemas fora do PsiManager passa por estas regras.
---

# Skill-API-First-Integration

## Purpose

Padronizar como o PsiManager fala com o mundo externo. Nenhuma integração deve ser ad-hoc. Todas seguem o mesmo contrato: eventos tipados, retry com backoff exponencial, webhook genérico de entrada e saída, e logs de audit para cada chamada externa.

## When to use this skill

- Ao implementar qualquer integração com sistema externo
- Ao criar webhooks de entrada (recebendo eventos externos)
- Ao criar webhooks de saída (notificando sistemas externos)
- Ao integrar Google Calendar
- Ao conectar n8n, WhatsApp ou qualquer orquestrador
- Ao implementar retry ou tratamento de falhas em chamadas externas

---

## 1. Contrato de Eventos — Formato Universal

Todo evento que sai ou entra no PsiManager segue este formato:
```typescript
// src/types/events.ts

// ─── Tipos de eventos suportados ───────────────────
export type EventType =
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'appointment.cancelled'
  | 'appointment.completed'
  | 'appointment.no_show'
  | 'payment.paid'
  | 'payment.overdue'
  | 'patient.created'
  | 'booking.token_generated';

// ─── Envelope universal de evento ──────────────────
export interface PsiEvent {
  id: string;                  // UUID único do evento
  type: EventType;             // Tipo do evento
  tenant_id: string;           // user_id do psicólogo (isolamento)
  payload: Record<string, unknown>; // Dados específicos do evento
  created_at: string;          // ISO 8601
  version: '1.0';              // Versão do contrato
}

// ─── Payloads específicos por tipo ─────────────────
export interface AppointmentEventPayload {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  start_time: string;          // ISO 8601
  end_time: string;            // ISO 8601
  status: string;
  psychologist_name: string;
}

export interface PaymentEventPayload {
  expense_id: string;
  patient_id: string;
  patient_name: string;
  amount: number;
  payment_status: string;
  due_date: string;            // ISO 8601
  session_date: string;        // ISO 8601
}

export interface PatientEventPayload {
  patient_id: string;
  patient_name: string;
  email: string | null;
  phone: string | null;
}

export interface BookingTokenEventPayload {
  token: string;
  booking_url: string;         // URL completa do link de agendamento
  expires_at: string;          // ISO 8601
  patient_id: string | null;
}
```

---

## 2. Webhook de Saída — Notificando Sistemas Externos

O PsiManager **empurra** eventos para sistemas externos (n8n, WhatsApp via API, email, etc.). A camada de saída é agnóstica — não sabe nem se importa com o que está do outro lado.

### Serviço de webhook de saída
```typescript
// src/services/webhookOutService.ts
import { supabase } from '@/lib/supabase';
import type { PsiEvent } from '@/types/events';

// ─── Configuração de webhook por tenant ────────────
export interface WebhookConfig {
  id: string;
  user_id: string;             // Tenant (psicólogo)
  url: string;                 // URL externa que recebe os eventos
  secret: string;              // Secret para assinatura HMAC
  active: boolean;
  created_at: string;
}

// ─── Buscar webhooks ativos do tenant ──────────────
async function getActiveWebhooks(tenantId: string): Promise<WebhookConfig[]> {
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('*')
    .eq('user_id', tenantId)
    .eq('active', true);

  if (error) return [];
  return data;
}

// ─── Gerar assinatura HMAC ─────────────────────────
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'SHA-256',
    key,
    encoder.encode(payload)
  );

  return 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ─── Enviar evento para um webhook específico ──────
async function sendToWebhook(
  config: WebhookConfig,
  event: PsiEvent
): Promise<{ success: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(event);
  const signature = await generateHmacSignature(body, config.secret);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PsiManager-Signature': signature,
        'X-PsiManager-Event': event.type,
        'X-PsiManager-Version': event.version
      },
      body
    });

    return { success: response.ok, status: response.status };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Dispatcher principal — envia para todos os webhooks do tenant ─
export async function dispatchEvent(event: PsiEvent): Promise<void> {
  const webhooks = await getActiveWebhooks(event.tenant_id);

  for (const webhook of webhooks) {
    const result = await sendToWebhook(webhook, event);

    // Registrar resultado no log
    await supabase
      .from('webhook_logs')
      .insert({
        webhook_config_id: webhook.id,
        event_id: event.id,
        event_type: event.type,
        status: result.success ? 'delivered' : 'failed',
        http_status: result.status || null,
        error: result.error || null,
        created_at: new Date().toISOString()
      });

    // Se falhou, agenda retry (ver seção 4)
    if (!result.success) {
      await scheduleRetry(webhook.id, event);
    }
  }
}
```

### SQL — Tabelas de webhook
```sql
-- Configuração de webhooks por tenant
CREATE TABLE public.webhook_configs (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id),
  url       TEXT        NOT NULL,
  secret    TEXT        NOT NULL,
  active    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant vê apenas seus webhooks"
ON public.webhook_configs FOR ALL TO authenticated
USING (auth.uid() = user_id);

-- Log de entregas
CREATE TABLE public.webhook_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id   UUID        NOT NULL REFERENCES public.webhook_configs(id),
  event_id            TEXT        NOT NULL,
  event_type          TEXT        NOT NULL,
  status              TEXT        NOT NULL CHECK (status IN ('delivered', 'failed', 'retrying')),
  http_status         INTEGER,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila de retry
CREATE TABLE public.webhook_retries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id   UUID        NOT NULL REFERENCES public.webhook_configs(id),
  event_payload       JSONB       NOT NULL,
  attempt             INTEGER     NOT NULL DEFAULT 1,
  next_retry_at       TIMESTAMPTZ NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'exhausted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Webhook de Entrada — Recebendo Eventos Externos

Sistemas externos (n8n, WhatsApp Business API, etc.) enviam eventos para o PsiManager via POST.

### Edge Function — recebedor
```typescript
// supabase/functions/webhook-receiver/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/errors.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ─── Eventos que o sistema aceita receber ──────────
type InboundEventType =
  | 'whatsapp.message_received'
  | 'payment.confirmed_external'
  | 'calendar.event_updated';

interface InboundEvent {
  type: InboundEventType;
  tenant_id: string;           // Qual psicólogo esse evento pertence
  payload: Record<string, unknown>;
  source: string;              // Identificador do sistema de origem
}

// ─── Verificar assinatura HMAC do remetente ────────
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC' },
    false,
    ['sign']
  );

  const computed = await crypto.subtle.sign(
    'SHA-256',
    key,
    encoder.encode(body)
  );

  const computedHex = 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(computed)));
  return computedHex === signature;
}

// ─── Processar evento por tipo ─────────────────────
async function processInboundEvent(event: InboundEvent): Promise<{ handled: boolean; reason?: string }> {
  switch (event.type) {
    case 'whatsapp.message_received': {
      // Registrar mensagem recebida para o tenant
      await supabase
        .from('inbound_messages')
        .insert({
          user_id: event.tenant_id,
          source: event.source,
          content: event.payload.text as string,
          sender: event.payload.phone_number as string,
          created_at: new Date().toISOString()
        });
      return { handled: true };
    }

    case 'payment.confirmed_external': {
      // Marcar expense como pago via sistema externo
      const expenseId = event.payload.expense_id as string;
      await supabase
        .from('expenses')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          paid_via: event.source
        })
        .eq('id', expenseId)
        .eq('user_id', event.tenant_id); // Isolamento por tenant

      return { handled: true };
    }

    case 'calendar.event_updated': {
      // Atualizar agendamento com dados do Google Calendar
      const appointmentId = event.payload.appointment_id as string;
      await supabase
        .from('appointments')
        .update({
          google_event_id: event.payload.google_event_id as string,
          synced_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .eq('user_id', event.tenant_id);

      return { handled: true };
    }

    default:
      return { handled: false, reason: `Tipo de evento não suportado: ${event.type}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido', 405);
  }

  const body = await req.text();

  // Verificar assinatura se presente
  const signature = req.headers.get('X-Webhook-Signature');
  if (signature) {
    // Buscar secret do tenant baseado no evento
    // Na prática, o tenant_id pode vir via header ou URL parameter
    const tenantId = req.headers.get('X-Tenant-Id');
    if (tenantId) {
      const { data: config } = await supabase
        .from('webhook_configs')
        .select('secret')
        .eq('user_id', tenantId)
        .single();

      if (config) {
        const valid = await verifySignature(body, signature, config.secret);
        if (!valid) return errorResponse('Assinatura inválida', 401);
      }
    }
  }

  let event: InboundEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return errorResponse('Payload inválido');
  }

  // Registrar evento recebido no log
  await supabase
    .from('inbound_event_logs')
    .insert({
      tenant_id: event.tenant_id,
      event_type: event.type,
      source: event.source,
      payload: event.payload,
      created_at: new Date().toISOString()
    });

  const result = await processInboundEvent(event);

  if (!result.handled) {
    return errorResponse(result.reason || 'Evento não processado', 422);
  }

  return successResponse({ received: true, event_type: event.type });
});
```

### SQL — Log de eventos de entrada
```sql
CREATE TABLE public.inbound_event_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES auth.users(id),
  event_type  TEXT        NOT NULL,
  source      TEXT        NOT NULL,
  payload     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inbound_event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant vê apenas seus eventos"
ON public.inbound_event_logs FOR ALL TO authenticated
USING (auth.uid() = tenant_id);

CREATE TABLE public.inbound_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  source      TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  sender      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant vê apenas suas mensagens"
ON public.inbound_messages FOR ALL TO authenticated
USING (auth.uid() = user_id);
```

---

## 4. Retry — Backoff Exponencial

Qualquer chamada externa que falhe entra na fila de retry. Máximo 5 tentativas com backoff exponencial.

### Configuração
```typescript
// src/lib/retry.ts

export interface RetryConfig {
  maxAttempts: number;         // Padrão: 5
  baseDelayMs: number;         // Padrão: 1000 (1s)
  maxDelayMs: number;          // Padrão: 300000 (5 min)
  backoffMultiplier: number;   // Padrão: 2
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  backoffMultiplier: 2
};

// ─── Calcular delay para tentativa N ───────────────
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Adicionar jitter (±25%) para evitar thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

// ─── Retry genérico para qualquer chamada assíncrona ─
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (attempt < config.maxAttempts) {
        const delay = calculateDelay(attempt, config);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Agenda de retry via Edge Function
```typescript
// supabase/functions/process-retries/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/errors.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ─── Agendar retry no banco ────────────────────────
export async function scheduleRetry(webhookConfigId: string, event: Record<string, unknown>): Promise<void> {
  // Contar tentativas anteriores
  const { data: existing } = await supabase
    .from('webhook_retries')
    .select('attempt')
    .eq('webhook_config_id', webhookConfigId)
    .eq('event_payload->id', event.id as string)
    .order('attempt', { ascending: false })
    .limit(1);

  const currentAttempt = (existing?.[0]?.attempt || 0) + 1;

  // Máximo 5 tentativas
  if (currentAttempt > 5) {
    // Marcar como exhausted no log
    await supabase
      .from('webhook_retries')
      .update({ status: 'exhausted' })
      .eq('webhook_config_id', webhookConfigId)
      .eq('event_payload->id', event.id as string);
    return;
  }

  // Calcular próximo retry com backoff
  const delayMs = 1000 * Math.pow(2, currentAttempt - 1);
  const nextRetryAt = new Date(Date.now() + delayMs);

  await supabase
    .from('webhook_retries')
    .insert({
      webhook_config_id: webhookConfigId,
      event_payload: event,
      attempt: currentAttempt,
      next_retry_at: nextRetryAt.toISOString(),
      status: 'pending'
    });
}

// ─── Processar fila de retries (chamado por cron) ──
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const now = new Date();

  // Buscar retries pendentes cujo next_retry_at já passouou
  const { data: pending } = await supabase
    .from('webhook_retries')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', now.toISOString());

  let processed = 0;

  for (const retry of pending || []) {
    // Buscar configuração do webhook
    const { data: config } = await supabase
      .from('webhook_configs')
      .select('url, secret')
      .eq('id', retry.webhook_config_id)
      .single();

    if (!config) continue;

    // Tentar enviar novamente
    try {
      const body = JSON.stringify(retry.event_payload);
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (response.ok) {
        await supabase
          .from('webhook_retries')
          .update({ status: 'delivered' })
          .eq('id', retry.id);
        processed++;
      } else {
        // Falhou novamente — agendar novo retry ou marcar exhausted
        await scheduleRetry(retry.webhook_config_id, retry.event_payload);
      }
    } catch {
      await scheduleRetry(retry.webhook_config_id, retry.event_payload);
    }
  }

  return successResponse({ processed, checked: pending?.length || 0 });
});
```

---

## 5. Google Calendar — Integração Direta

### Mapeamento de estados

| Status PsiManager | Status Google Calendar |
|---|---|
| `pending` | `tentative` |
| `confirmed` | `confirmed` |
| `cancelled` | `cancelled` |
| `completed` | `confirmed` (mantém) |
| `no_show` | `confirmed` (mantém) |

### Serviço de sincronização
```typescript
// src/services/calendarSyncService.ts
import type { Appointment } from '@/types';

const TIMEZONE = 'America/Sao_Paulo';

// ─── Mapear status interno para Google ─────────────
function mapStatusToGoogle(status: string): 'confirmed' | 'tentative' | 'cancelled' {
  const map: Record<string, 'confirmed' | 'tentative' | 'cancelled'> = {
    pending: 'tentative',
    confirmed: 'confirmed',
    cancelled: 'cancelled',
    completed: 'confirmed',
    no_show: 'confirmed'
  };
  return map[status] ?? 'tentative';
}

// ─── Construir payload do evento Google ────────────
function buildGoogleEvent(appointment: Appointment) {
  return {
    summary: `Sessão — ${appointment.patient_name}`,
    description: appointment.notes || undefined,
    start: { dateTime: appointment.start_time, timeZone: TIMEZONE },
    end: { dateTime: appointment.end_time, timeZone: TIMEZONE },
    status: mapStatusToGoogle(appointment.status)
  };
}

// ─── Criar ou atualizar evento ─────────────────────
export async function syncToGoogleCalendar(
  appointment: Appointment,
  accessToken: string
): Promise<{ google_event_id: string; success: boolean; error?: string }> {
  const payload = buildGoogleEvent(appointment);
  const isUpdate = !!appointment.google_event_id;

  const url = isUpdate
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.google_event_id}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  try {
    const response = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      return { google_event_id: '', success: false, error: `Google API ${response.status}: ${err}` };
    }

    const created = await response.json();
    return { google_event_id: created.id, success: true };
  } catch (err) {
    return { google_event_id: '', success: false, error: (err as Error).message };
  }
}

// ─── Cancelar evento no Google ─────────────────────
export async function cancelGoogleEvent(
  googleEventId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
```

### Edge Function — sincronização server-side
```typescript
// supabase/functions/sync-google-calendar/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { extractUserId } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/errors.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const TIMEZONE = 'America/Sao_Paulo';

function mapStatusToGoogle(status: string): string {
  const map: Record<string, string> = {
    pending: 'tentative',
    confirmed: 'confirmed',
    cancelled: 'cancelled',
    completed: 'confirmed',
    no_show: 'confirmed'
  };
  return map[status] ?? 'tentative';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const userId = await extractUserId(req);
  if (!userId) return errorResponse('Não autorizado', 401);

  const { appointment_id, google_access_token } = await req.json();
  if (!appointment_id || !google_access_token) {
    return errorResponse('appointment_id e google_access_token são obrigatórios');
  }

  // Buscar agendamento
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointment_id)
    .eq('user_id', userId)
    .single();

  if (!appointment) return errorResponse('Agendamento não encontrado', 404);

  // Buscar nome do paciente
  const { data: patient } = await supabase
    .from('patients')
    .select('name')
    .eq('id', appointment.patient_id)
    .single();

  const payload = {
    summary: `Sessão — ${patient?.name || 'Paciente'}`,
    description: appointment.notes || undefined,
    start: { dateTime: appointment.start_time, timeZone: TIMEZONE },
    end: { dateTime: appointment.end_time, timeZone: TIMEZONE },
    status: mapStatusToGoogle(appointment.status)
  };

  const isUpdate = !!appointment.google_event_id;
  const url = isUpdate
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.google_event_id}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const response = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${google_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    return errorResponse(`Google Calendar: ${err}`, response.status);
  }

  const result = await response.json();

  // Persistir google_event_id
  await supabase
    .from('appointments')
    .update({
      google_event_id: result.id,
      synced_at: new Date().toISOString()
    })
    .eq('id', appointment_id);

  return successResponse({ google_event_id: result.id, synced: true });
});
```

---

## 6. Regras Transversais de Integração
```
1. Toda chamada externa usa fetch() — nunca axios ou outras bibliotecas
2. Timeout padrão: 10 segundos para qualquer chamada externa
3. Todas as respostas de erro externas são logadas em webhook_logs
4. Secrets de integração (tokens OAuth, API keys) vivem apenas em Edge Functions via Deno.env
5. O cliente (React) nunca chama APIs externas diretamente — sempre via Edge Functions
6. Isolamento por tenant é enforced em cada camada: webhook configs, logs, eventos
7. HMAC SHA-256 é o padrão de assinatura para webhooks de saída e verificação de entrada
```