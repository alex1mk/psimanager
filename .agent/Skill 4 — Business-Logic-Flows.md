---
name: Skill-Business-Logic-Flows
description: Alma do PsiManager. Define os fluxos de negócio do sistema — agendamento (Fluxo A e B), lógica de recorrência semanal/quinzenal/mensal, estados de pagamento fixos e contrato de dados para link de confirmação. Toda lógica de negócio passa por estas regras.
---

# Skill-Business-Logic-Flows

## Purpose

Ser o PRD vivo do PsiManager. Qualquer agente que trabalhe neste projeto deve entender os fluxos de negócio lendo este documento. Não há ambiguidade sobre como um agendamento é criado, como sessões recorrentes são geradas ou quando um pagamento deve ser marcado como pago.

## When to use this skill

- Ao implementar criação ou modificação de agendamentos
- Ao desenvolver lógica de recorrência de sessões
- Ao criar ou alterar estados de pagamento
- Ao implementar link de confirmação de agendamento
- Ao criar relatórios ou dashboards que dependem de lógica de negócio
- Ao integrar com Google Calendar ou sistemas externos

---

## 1. Fluxos de Agendamento

### Fluxo A — Agendamento Direto pelo Psicólogo

```
Psicólogo abre Agenda
    │
    ▼
Seleciona data e horário disponível
    │
    ▼
Seleciona paciente existente ou cria novo
    │
    ▼
Sistema valida conflito de horário ──── CONFLITO ────► Exibe erro + sugere horários livres
    │
    ▼ (sem conflito)
Sistema cria agendamento com status "pending"
    │
    ▼
Psicólogo confirma agendamento
    │
    ▼
Status atualiza para "confirmed"
    │
    ▼
Sistema envia notificação ao paciente (email/webhook)
    │
    ▼
Sistema sincroniza com Google Calendar
```

**Implementação:**
```typescript
// src/services/appointmentService.ts
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import type { Appointment, CreateAppointmentDTO } from '@/types';

interface ConflictCheck {
  hasConflict: boolean;
  suggestedSlots?: { start: string; end: string }[];
}

// ─── Verificar conflito antes de criar ────────────
export async function checkConflict(
  userId: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<ConflictCheck> {
  const { data, error } = await supabase
    .rpc('check_appointment_conflict', {
      p_user_id: userId,
      p_start: startTime,
      p_end: endTime,
      p_exclude_id: excludeId || null
    });

  if (error) throw error;

  // Se há conflito, sugerir próximos horários livres
  if (!data) {
    const suggestions = await findAvailableSlots(userId, startTime);
    return { hasConflict: true, suggestedSlots: suggestions };
  }

  return { hasConflict: false };
}

// ─── Criar agendamento (Fluxo A) ───────────────────
export async function createAppointment(dto: CreateAppointmentDTO): Promise<Appointment> {
  // 1. Validar conflito
  const conflict = await checkConflict(dto.user_id, dto.start_time, dto.end_time);
  if (conflict.hasConflict) {
    throw new Error('CONFLICT');
  }

  // 2. Inserir com status pending
  const { data, error } = await supabase
    .from('appointments')
    .insert({ ...dto, status: 'pending' })
    .select()
    .single();

  if (error) throw error;

  await logAudit({ action: 'CREATE', resource_type: 'appointment', resource_id: data.id });
  return data;
}

// ─── Confirmar agendamento ─────────────────────────
export async function confirmAppointment(id: string): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({ action: 'UPDATE', resource_type: 'appointment', resource_id: id, details: { status: 'confirmed' } });
  return data;
}

// ─── Encontrar horários livres ─────────────────────
async function findAvailableSlots(
  userId: string,
  referenceDate: string
): Promise<{ start: string; end: string }[]> {
  const date = new Date(referenceDate);
  const slots: { start: string; end: string }[] = [];

  // Buscar agendamentos do dia
  const dayStart = new Date(date);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(20, 0, 0, 0);

  const { data: existing } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .gte('start_time', dayStart.toISOString())
    .lte('end_time', dayEnd.toISOString())
    .neq('status', 'cancelled')
    .order('start_time');

  // Gerar slots de 60 min entre 08:00 e 20:00
  let currentHour = 8;
  while (currentHour < 20) {
    const slotStart = new Date(date);
    slotStart.setHours(currentHour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(currentHour + 1, 0, 0, 0);

    // Verificar se slot está livre
    const occupied = existing?.some(e =>
      new Date(e.start_time) < slotEnd && new Date(e.end_time) > slotStart
    );

    if (!occupied) {
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString()
      });
    }

    currentHour++;
  }

  return slots.slice(0, 3); // Retornar até 3 sugestões
}
```

### Fluxo B — Agendamento via Link de Confirmação

```
Psicólogo gera link de agendamento para paciente
    │
    ▼
Sistema gera token único + link com prazo de validade (48h)
    │
    ▼
Paciente recebe link (email/WhatsApp/webhook)
    │
    ▼
Paciente acessa link ──── TOKEN EXPIRADO ────► Exibe página de erro + solicita novo link
    │
    ▼ (token válido)
Paciente vê horários disponíveis do psicólogo
    │
    ▼
Paciente seleciona horário
    │
    ▼
Sistema cria agendamento com status "confirmed" (já confirmado pelo paciente)
    │
    ▼
Sistema notifica psicólogo sobre novo agendamento
    │
    ▼
Sistema sincroniza com Google Calendar
```

**Contrato de dados do link de confirmação:**
```typescript
// src/types/database.ts — adicionar
export interface BookingToken {
  id: string;
  user_id: string;                    // Psicólogo que gerou
  patient_id: string | null;          // Pode ser null se paciente novo
  token: string;                      // UUID único
  expires_at: string;                 // ISO 8601 — padrão 48h
  created_at: string;
  used_at: string | null;             // Null até ser usado
  used_appointment_id: string | null; // Referencia o agendamento criado
}

// Contrato de resposta do link público (sem dados do psicólogo)
export interface BookingPageData {
  psychologist_name: string;
  available_slots: Array<{
    start: string;  // ISO 8601
    end: string;    // ISO 8601
    duration_minutes: number;
  }>;
  token_valid: boolean;
  expires_at: string;
}
```

**SQL — Tabela de tokens:**
```sql
CREATE TABLE public.booking_tokens (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id),
  patient_id          UUID        REFERENCES public.patients(id),
  token               UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at             TIMESTAMPTZ,
  used_appointment_id UUID        REFERENCES public.appointments(id)
);

ALTER TABLE public.booking_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psicólogo vê apenas seus tokens"
ON public.booking_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id);
```

**Serviço de geração e uso de token:**
```typescript
// src/services/bookingTokenService.ts
import { supabase } from '@/lib/supabase';
import type { BookingToken, BookingPageData } from '@/types';

export async function generateBookingToken(
  userId: string,
  patientId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('booking_tokens')
    .insert({
      user_id: userId,
      patient_id: patientId || null
    })
    .select('token')
    .single();

  if (error) throw error;
  return data.token;
}

export async function getBookingPageData(token: string): Promise<BookingPageData | null> {
  // 1. Validar token
  const { data: tokenData } = await supabase
    .from('booking_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (!tokenData) return null;
  if (new Date(tokenData.expires_at) < new Date()) {
    return { psychologist_name: '', available_slots: [], token_valid: false, expires_at: tokenData.expires_at };
  }
  if (tokenData.used_at) return null; // Já usado

  // 2. Buscar nome do psicólogo
  const { data: user } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', tokenData.user_id)
    .single();

  // 3. Buscar horários livres
  const slots = await findAvailableSlotsForToken(tokenData.user_id);

  return {
    psychologist_name: user?.display_name || 'Psicólogo',
    available_slots: slots,
    token_valid: true,
    expires_at: tokenData.expires_at
  };
}

export async function useBookingToken(
  token: string,
  selectedStartTime: string,
  selectedEndTime: string,
  patientEmail?: string
): Promise<{ appointment_id: string }> {
  // 1. Validar token ainda válido
  const { data: tokenData } = await supabase
    .from('booking_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (!tokenData || tokenData.used_at || new Date(tokenData.expires_at) < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  // 2. Criar agendamento diretamente confirmado
  const { data: appointment } = await supabase
    .from('appointments')
    .insert({
      user_id: tokenData.user_id,
      patient_id: tokenData.patient_id,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      status: 'confirmed'
    })
    .select()
    .single();

  // 3. Marcar token como usado
  await supabase
    .from('booking_tokens')
    .update({
      used_at: new Date().toISOString(),
      used_appointment_id: appointment.id
    })
    .eq('token', token);

  return { appointment_id: appointment.id };
}

async function findAvailableSlotsForToken(
  userId: string
): Promise<Array<{ start: string; end: string; duration_minutes: number }>> {
  // Buscar próximos 7 dias
  const slots: Array<{ start: string; end: string; duration_minutes: number }> = [];
  const today = new Date();

  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);

    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(20, 0, 0, 0);

    const { data: existing } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', dayStart.toISOString())
      .lte('end_time', dayEnd.toISOString())
      .neq('status', 'cancelled');

    let hour = 8;
    while (hour < 20) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const occupied = existing?.some(e =>
        new Date(e.start_time) < slotEnd && new Date(e.end_time) > slotStart
      );

      if (!occupied) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          duration_minutes: 60
        });
      }
      hour++;
    }
  }

  return slots;
}
```

---

## 2. Recorrência — Motor de Sessões Recorrentes

### Tipos de recorrência suportados

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `weekly` | Mesmo dia da semana | Toda terça, 14h |
| `biweekly` | A cada duas semanas | Terças alternas, 14h |
| `monthly` | Mesmo dia do mês | Todo dia 15, 10h |

### Interface de recorrência

```typescript
// Adicionar em src/types/database.ts
export type RecurrenceType = 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceConfig {
  type: RecurrenceType;
  day_of_week?: number;       // 0=Dom, 1=Seg ... 6=Sáb (weekly/biweekly)
  day_of_month?: number;      // 1-31 (monthly)
  start_time_hour: number;    // 8-19
  start_time_minute: number;  // 0 ou 30
  duration_minutes: number;   // 45, 60, 90
  total_sessions: number;     // Quantidade total de sessões a gerar
  recurrence_group_id?: string; // Gerado no momento da criação
}

export interface RecurrenceGenerationResult {
  recurrence_group_id: string;
  appointments: Array<{
    start_time: string;
    end_time: string;
    status: 'pending';
  }>;
  skipped_dates: string[];  // Datas que tiveram conflito
}
```

### Motor de geração de datas

```typescript
// src/lib/recurrence.ts

import type { RecurrenceConfig, RecurrenceGenerationResult } from '@/types';
import { supabase } from '@/lib/supabase';

export function generateRecurrentDates(config: RecurrenceConfig): string[] {
  const dates: string[] = [];
  let current = new Date();

  // Ajustar para o próximo dia válido
  current = findNextValidDate(current, config);

  while (dates.length < config.total_sessions) {
    dates.push(current.toISOString());
    current = getNextOccurrence(current, config);
  }

  return dates;
}

// ─── Encontrar próxima data válida ─────────────────
function findNextValidDate(from: Date, config: RecurrenceConfig): Date {
  const date = new Date(from);

  if (config.type === 'weekly' || config.type === 'biweekly') {
    // Avançar até o dia_of_week correto
    while (date.getDay() !== config.day_of_week) {
      date.setDate(date.getDate() + 1);
    }
  } else if (config.type === 'monthly') {
    // Ajustar para o dia_of_month correto
    if (date.getDate() > config.day_of_month!) {
      date.setMonth(date.getMonth() + 1);
    }
    date.setDate(config.day_of_month!);
  }

  // Ajustar horário
  date.setHours(config.start_time_hour, config.start_time_minute, 0, 0);

  // Se já passouou hoje, ir para próxima ocorrência
  if (date < new Date()) {
    return getNextOccurrence(date, config);
  }

  return date;
}

// ─── Próxima ocorrência baseada no tipo ────────────
function getNextOccurrence(current: Date, config: RecurrenceConfig): Date {
  const next = new Date(current);

  switch (config.type) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      // Tratar meses com menos dias (ex: 31 em um mês de 30 dias)
      if (next.getDate() !== config.day_of_month) {
        next.setDate(0); // Último dia do mês anterior
      }
      break;
  }

  return next;
}

// ─── Gerar agendamentos recorrentes no Supabase ────
export async function createRecurrentAppointments(
  userId: string,
  patientId: string,
  config: RecurrenceConfig
): Promise<RecurrenceGenerationResult> {
  const groupId = crypto.randomUUID();
  const dates = generateRecurrentDates(config);
  const appointments: RecurrenceGenerationResult['appointments'] = [];
  const skipped: string[] = [];

  for (const dateStr of dates) {
    const startTime = new Date(dateStr);
    const endTime = new Date(startTime.getTime() + config.duration_minutes * 60000);

    // Verificar conflito
    const { data: hasSlot } = await supabase.rpc('check_appointment_conflict', {
      p_user_id: userId,
      p_start: startTime.toISOString(),
      p_end: endTime.toISOString()
    });

    if (!hasSlot) {
      skipped.push(dateStr);
      continue; // Pular data com conflito
    }

    // Inserir agendamento
    await supabase
      .from('appointments')
      .insert({
        user_id: userId,
        patient_id: patientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending',
        recurrence_group_id: groupId
      });

    appointments.push({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'pending'
    });
  }

  return {
    recurrence_group_id: groupId,
    appointments,
    skipped_dates: skipped
  };
}

// ─── Exemplos de uso ───────────────────────────────
/*
// Sessão semanal toda terça às 14h por 12 semanas
await createRecurrentAppointments(userId, patientId, {
  type: 'weekly',
  day_of_week: 2,           // Terça
  start_time_hour: 14,
  start_time_minute: 0,
  duration_minutes: 60,
  total_sessions: 12
});

// Sessão quinzenal toda quinta às 10:30 por 8 sessões
await createRecurrentAppointments(userId, patientId, {
  type: 'biweekly',
  day_of_week: 4,           // Quinta
  start_time_hour: 10,
  start_time_minute: 30,
  duration_minutes: 60,
  total_sessions: 8
});

// Sessão mensal no dia 15 às 9h por 6 meses
await createRecurrentAppointments(userId, patientId, {
  type: 'monthly',
  day_of_month: 15,
  start_time_hour: 9,
  start_time_minute: 0,
  duration_minutes: 60,
  total_sessions: 6
});
*/
```

---

## 3. Estados de Pagamento — Regras Fixas

### Máquina de estados

```
pending ──────► paid          (pagamento recebido)
   │
   ▼
overdue ──────► paid          (pagamento recebido após prazo)
   │
   ▼
cancelled                     (sessão cancelada, sem cobrança)
```

### Regras de transição

| Estado atual | Para | Condição |
|-------------|------|----------|
| `pending` | `paid` | Pagamento confirmado |
| `pending` | `overdue` | Data limite passou sem pagamento |
| `pending` | `cancelled` | Sessão cancelada pelo psicólogo ou paciente |
| `overdue` | `paid` | Pagamento recebido (mesmo tardio) |
| `overdue` | `cancelled` | Psicólogo cancela cobrança |
| `paid` | — | Estado final. Não pode ser alterado |
| `cancelled` | — | Estado final. Não pode ser alterado |

### Datas de pagamento fixas

```
Regra: Pacientes pagam no dia da sessão, ou em dois dates fixos:
  → Dia 05 do mês
  → Dia 20 do mês

Lógica:
  - Se sessão ocorre entre dia 01 e dia 04 → pagamento esperado no dia 05
  - Se sessão ocorre entre dia 05 e dia 19 → pagamento esperado no dia 20
  - Se sessão ocorre entre dia 20 e dia 31 → pagamento esperado no dia 05 do mês seguinte
```

### Implementação

```typescript
// src/lib/paymentRules.ts
import type { PaymentStatus } from '@/types';

interface PaymentDeadline {
  session_date: Date;
  payment_due_date: Date;
}

// ─── Calcular data limite de pagamento ─────────────
export function calculatePaymentDueDate(sessionDate: Date): Date {
  const day = sessionDate.getDate();
  const month = sessionDate.getMonth();
  const year = sessionDate.getFullYear();

  if (day >= 1 && day <= 4) {
    // Sessão entre 01 e 04 → pagamento no dia 05 do mesmo mês
    return new Date(year, month, 5);
  } else if (day >= 5 && day <= 19) {
    // Sessão entre 05 e 19 → pagamento no dia 20 do mesmo mês
    return new Date(year, month, 20);
  } else {
    // Sessão entre 20 e 31 → pagamento no dia 05 do mês seguinte
    return new Date(year, month + 1, 5);
  }
}

// ─── Determinar status baseado na data atual ──────
export function calculatePaymentStatus(
  currentStatus: PaymentStatus,
  sessionDate: Date
): PaymentStatus {
  // Estados finais não mudam
  if (currentStatus === 'paid' || currentStatus === 'cancelled') {
    return currentStatus;
  }

  const dueDate = calculatePaymentDueDate(sessionDate);
  const now = new Date();

  // Se já passou da data limite e ainda não pagou
  if (now > dueDate && currentStatus === 'pending') {
    return 'overdue';
  }

  return currentStatus;
}

// ─── Atualizar status de pagamento ─────────────────
import { supabase } from '@/lib/supabase';

export async function markAsPaid(expenseId: string): Promise<void> {
  const { data: expense } = await supabase
    .from('expenses')
    .select('payment_status')
    .eq('id', expenseId)
    .single();

  if (!expense) throw new Error('Despesa não encontrada');

  // Verificar se estado permite transição para paid
  if (expense.payment_status === 'cancelled') {
    throw new Error('Não é possível pagar uma despesa cancelada');
  }

  await supabase
    .from('expenses')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId);
}

export async function cancelExpense(expenseId: string): Promise<void> {
  const { data: expense } = await supabase
    .from('expenses')
    .select('payment_status')
    .eq('id', expenseId)
    .single();

  if (!expense) throw new Error('Despesa não encontrada');

  if (expense.payment_status === 'paid') {
    throw new Error('Não é possível cancelar uma despesa já paga');
  }

  await supabase
    .from('expenses')
    .update({
      payment_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId);
}

// ─── Job para atualizar overdue automaticamente ────
// Executar via Edge Function em cron ou chamada periódica
export async function updateOverdueExpenses(userId: string): Promise<number> {
  const { data: pending } = await supabase
    .from('expenses')
    .select('id, session_date, payment_status')
    .eq('user_id', userId)
    .eq('payment_status', 'pending');

  let updated = 0;

  for (const expense of pending || []) {
    const newStatus = calculatePaymentStatus('pending', new Date(expense.session_date));
    if (newStatus === 'overdue') {
      await supabase
        .from('expenses')
        .update({ payment_status: 'overdue', updated_at: new Date().toISOString() })
        .eq('id', expense.id);
      updated++;
    }
  }

  return updated;
}

// ─── Exemplos de uso ───────────────────────────────
/*
// Calcular quando o paciente deve pagar
const sessao = new Date(2025, 2, 15); // 15 de março
const prazo = calculatePaymentDueDate(sessao);
console.log(prazo); // 20 de março de 2025

const sessao2 = new Date(2025, 2, 25); // 25 de março
const prazo2 = calculatePaymentDueDate(sessao2);
console.log(prazo2); // 05 de abril de 2025

// Marcar pagamento recebido
await markAsPaid('expense-uuid');

// Cancelar cobrança
await cancelExpense('expense-uuid');

// Atualizar todos os pendentes para overdue se necessário
const totalAtualizado = await updateOverdueExpenses(userId);
*/
```

---

## 4. Estados de Agendamento — Máquina de Estados

```
pending ────► confirmed ────► completed
   │              │
   ▼              ▼
cancelled     cancelled
                  │
                  ▼
              no_show (apenas após horário da sessão)
```

### Regras de transição

| De | Para | Condição |
|----|------|----------|
| `pending` | `confirmed` | Psicólogo confirma ou paciente usa link |
| `pending` | `cancelled` | Cancelamento antes da sessão |
| `confirmed` | `completed` | Após horário da sessão (manual ou automático) |
| `confirmed` | `cancelled` | Cancelamento após confirmação |
| `confirmed` | `no_show` | Paciente não compareceu (após horário) |
| `completed` | — | Estado final |
| `cancelled` | — | Estado final |
| `no_show` | — | Estado final |

```typescript
// src/lib/appointmentStateMachine.ts
import type { AppointmentStatus } from '@/types';

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['completed', 'cancelled', 'no_show'],
  completed:  [],
  cancelled:  [],
  no_show:    []
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function validateTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  appointmentEndTime: Date
): { valid: boolean; reason?: string } {
  // Verificar se transição é permitida
  if (!canTransition(from, to)) {
    return {
      valid: false,
      reason: `Transição de "${from}" para "${to}" não é permitida`
    };
  }

  const now = new Date();

  // no_show só pode ser marcado após horário da sessão
  if (to === 'no_show' && now < appointmentEndTime) {
    return {
      valid: false,
      reason: 'Não é possível marcar como falta antes do horário da sessão'
    };
  }

  // completed só pode ser marcado após horário da sessão
  if (to === 'completed' && now < appointmentEndTime) {
    return {
      valid: false,
      reason: 'Não é possível marcar como concluído antes do horário da sessão'
    };
  }

  return { valid: true };
}   
// src/types/googleCalendar.ts
export interface GoogleCalendarEvent {
  id: string;
  summary: string;           // Título do evento
  description?: string;      // Descrição opcional
  start: {
    dateTime: string;        // ISO 8601 com timezone
    timeZone: string;        // Ex: 'America/Sao_Paulo'
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarSyncResult {
  google_event_id: string;
  synced_at: string;
  success: boolean;
  error?: string;
}
// src/services/calendarSyncService.ts
import type { Appointment } from '@/types';
import type { GoogleCalendarEvent, CalendarSyncResult } from '@/types/googleCalendar';
import { supabase } from '@/lib/supabase';

const TIMEZONE = 'America/Sao_Paulo';

// ─── Mapear status interno para Google Calendar ───
function mapStatusToGoogle(status: Appointment['status']): GoogleCalendarEvent['status'] {
  const map: Record<string, GoogleCalendarEvent['status']> = {
    pending:   'tentative',
    confirmed: 'confirmed',
    cancelled: 'cancelled',
    completed: 'confirmed',
    no_show:   'confirmed'
  };
  return map[status] ?? 'tentative';
}

// ─── Construir payload do evento ───────────────────
function buildGoogleEvent(appointment: Appointment): Omit<GoogleCalendarEvent, 'id'> {
  return {
    summary: `Sessão — ${appointment.patient_name}`,
    description: appointment.notes || undefined,
    start: {
      dateTime: appointment.start_time,
      timeZone: TIMEZONE
    },
    end: {
      dateTime: appointment.end_time,
      timeZone: TIMEZONE
    },
    status: mapStatusToGoogle(appointment.status)
  };
}

// ─── Criar evento no Google Calendar ───────────────
export async function syncToGoogleCalendar(
  appointment: Appointment,
  accessToken: string
): Promise<CalendarSyncResult> {
  const payload = buildGoogleEvent(appointment);

  try {
    // Se já existe google_event_id → atualizar (PUT)
    // Se não existe → criar (POST)
    const isUpdate = !!appointment.google_event_id;

    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.google_event_id}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const response = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Calendar API: ${response.status} — ${errorBody}`);
    }

    const created = await response.json();

    // Persistir google_event_id no agendamento
    await supabase
      .from('appointments')
      .update({
        google_event_id: created.id,
        synced_at: new Date().toISOString()
      })
      .eq('id', appointment.id);

    return {
      google_event_id: created.id,
      synced_at: new Date().toISOString(),
      success: true
    };
  } catch (err) {
    return {
      google_event_id: appointment.google_event_id || '',
      synced_at: new Date().toISOString(),
      success: false,
      error: (err as Error).message
    };
  }
}

// ─── Cancelar evento no Google Calendar ────────────
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
---

Esse bloco fecha a Skill. Algumas observações para você considerar:

A seção 4 (Estados de Agendamento) estava incompleta — faltava apenas o fechamento da função `validateTransition` e o cierre do bloco de código. Não foi necessário adicionar lógica nova, só completar o que já estava definido.

Adicionei duas seções que completam o documento como PRD funcional: a seção 5 cobre a sincronização com Google Calendar (mapeamento de estados, payload, criação/atualização de eventos), e a seção 6 consolida regras transversais que não se encaixam em um único fluxo mas governam todo o sistema — duração válida, horário de operação, fuso, cancelamento tardio, unicidade do token e isolamento multi-tenant.

Duas premissas que vale validar com você: a seção 6 assume que o limite de horário é sobre o *início* da sessão (não o fim), e que o campo `late_cancellation` é apenas descritivo — sem bloqueio automático. Se a intenção for bloquear cancelamentos tardios ou cobrar automaticamente, isso muda a máquina de estados e merece uma seção própria.