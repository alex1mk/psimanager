---
name: Skill-Architecture-Security
description: Cérebro do PsiManager. Define governança de segurança RLS no Supabase, isolamento de dados por psicólogo, conformidade LGPD, logs de auditoria e padrões de Edge Functions. Toda decisão de arquitetura passa por estas regras.
---

# Skill-Architecture-Security

## Purpose

Ser a camada de governança central do PsiManager. Toda operação que toca banco de dados, autenticação ou comunicação com serviços externos deve seguir os padrões definidos aqui. Esta skill garante que nenhum dado de um psicólogo seja acessível por outro, que logs de auditoria sejam imutáveis e que Edge Functions retornem respostas padronizadas.

## When to use this skill

- Ao criar ou modificar qualquer tabela no Supabase
- Ao escrever políticas RLS
- Ao criar Edge Functions
- Ao implementar qualquer operação que leia ou escreva dados de pacientes
- Ao configurar autenticação ou sessões
- Ao integrar serviços externos (Google Calendar, WhatsApp, n8n)

---

## 1. RLS — Row Level Security

### Princípio fundamental

Cada psicólogo é um universo isolado. Nenhuma query deve retornar dados de outro profissional. O campo `user_id` em todas as tabelas referencia `auth.users(id)` e é o pivot de toda política.

### Schema base com user_id obrigatório

```sql
-- Todas as tabelas seguem este padrão
CREATE TABLE public.patients (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT,
  phone       TEXT,
  cpf         TEXT,
  birth_date  DATE,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.appointments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id  UUID        NOT NULL REFERENCES public.patients(id),
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id  UUID        REFERENCES public.appointments(id),
  session_value   NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  final_value     NUMERIC(10,2) NOT NULL,
  payment_method  TEXT        NOT NULL,
  payment_status  TEXT        NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.receipts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id      UUID        NOT NULL REFERENCES public.expenses(id),
  patient_id      UUID        NOT NULL REFERENCES public.patients(id),
  receipt_number  TEXT        NOT NULL UNIQUE,
  issue_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  gross_value     NUMERIC(10,2) NOT NULL,
  net_value       NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Políticas RLS — Isolamento completo

```sql
-- =====================================================
-- PATIENTS
-- =====================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psicólogo vê apenas seus pacientes"
ON public.patients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Psicólogo insere apenas seus pacientes"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo atualiza apenas seus pacientes"
ON public.patients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo deleta apenas seus pacientes"
ON public.patients
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- APPOINTMENTS
-- =====================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psicólogo vê apenas seus agendamentos"
ON public.appointments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Psicólogo insere apenas seus agendamentos"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo atualiza apenas seus agendamentos"
ON public.appointments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo deleta apenas seus agendamentos"
ON public.appointments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- EXPENSES
-- =====================================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psicólogo vê apenas suas despesas"
ON public.expenses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Psicólogo insere apenas suas despesas"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo atualiza apenas suas despesas"
ON public.expenses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo deleta apenas suas despesas"
ON public.expenses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- RECEIPTS
-- =====================================================
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psicólogo vê apenas seus recibos"
ON public.receipts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Psicólogo insere apenas seus recibos"
ON public.receipts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo atualiza apenas seus recibos"
ON public.receipts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Psicólogo deleta apenas seus recibos"
ON public.receipts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

### Política de prevenção de conflito de horário

```sql
-- Índice para bloquear agendamentos sobrepostos
CREATE UNIQUE INDEX idx_no_appointment_overlap
ON public.appointments (user_id, start_time, end_time)
WHERE status NOT IN ('cancelled');

-- Função de validação
CREATE OR REPLACE FUNCTION public.check_appointment_conflict(
  p_user_id   UUID,
  p_start     TIMESTAMPTZ,
  p_end       TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE user_id = p_user_id
      AND status NOT IN ('cancelled')
      AND id != COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND start_time < p_end
      AND end_time > p_start
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. LGPD — Dados Sensíveis e Auditoria

### Classificação de dados

| Categoria | Campos | Isolamento |
|-----------|--------|------------|
| Dados pessoais | name, email, phone, cpf | RLS + user_id |
| Dados sensíveis (saúde) | notes (paciente), notas clínicas | RLS + user_id + log obrigatório |
| Dados financeiros | session_value, cpf (recibo) | RLS + user_id + log obrigatório |

### Tabela de log de auditoria (imutável)

```sql
CREATE TABLE public.audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  action        TEXT        NOT NULL, -- 'READ', 'CREATE', 'UPDATE', 'DELETE'
  resource_type TEXT        NOT NULL, -- 'patient', 'appointment', 'expense', 'receipt'
  resource_id   UUID        NOT NULL,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas INSERT permitido — nunca UPDATE ou DELETE
CREATE POLICY "Usuário insere logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário lê apenas seus logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Proibição explícita de alteração
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs são imutáveis';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();
```

### Função cliente para registrar auditoria

```typescript
// src/lib/audit.ts
import { supabase } from './supabase';

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditResource = 'patient' | 'appointment' | 'expense' | 'receipt';

interface AuditEntry {
  action: AuditAction;
  resource_type: AuditResource;
  resource_id: string;
  details?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      details: entry.details ?? null
    });

  if (error) {
    console.error('[AUDIT FAIL]', error);
  }
}

// Uso obrigatório ao acessar dados sensíveis
// await logAudit({ action: 'READ', resource_type: 'patient', resource_id: patientId });
```

---

## 3. Edge Functions — Padrão de Retorno e Secrets

### Padrão de resposta JSON

Todas as Edge Functions retornam o mesmo contrato:

```typescript
// Resposta de sucesso
{
  "success": true,
  "data": { /* payload */ },
  "message": "Operação concluída"
}

// Resposta de erro
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",  // ou NOT_FOUND, UNAUTHORIZED, INTERNAL
    "message": "Mensagem legível"
  }
}
```

### Template base de Edge Function

```typescript
// supabase/functions/create-receipt/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Secrets lidos via Deno.env.get — NUNCA hardcode
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Contrato de resposta padronizado
function successResponse(data: unknown, message = "OK") {
  return new Response(
    JSON.stringify({ success: true, data, message }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
}

function errorResponse(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code, message }
    }),
    { headers: { "Content-Type": "application/json" }, status }
  );
}

serve(async (req: Request) => {
  try {
    // 1. Autenticação obrigatória
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Token de autenticação ausente", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("UNAUTHORIZED", "Token inválido ou expirado", 401);
    }

    // 2. Parse do body
    const body = await req.json();

    // 3. Validação
    if (!body.expense_id) {
      return errorResponse("VALIDATION_ERROR", "expense_id é obrigatório");
    }

    // 4. Lógica de negócio
    const { data: expense } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", body.expense_id)
      .eq("user_id", user.id) // Garante isolamento
      .single();

    if (!expense) {
      return errorResponse("NOT_FOUND", "Despesa não encontrada", 404);
    }

    // 5. Criar recibo
    const receiptNumber = await generateReceiptNumber(user.id);

    const { data: receipt } = await supabase
      .from("receipts")
      .insert({
        user_id: user.id,
        expense_id: expense.id,
        patient_id: expense.patient_id,
        receipt_number: receiptNumber,
        gross_value: expense.session_value,
        net_value: expense.final_value
      })
      .select()
      .single();

    return successResponse(receipt, "Recibo criado com sucesso");

  } catch (err) {
    console.error("[Edge Function Error]", err);
    return errorResponse("INTERNAL", "Erro interno no servidor", 500);
  }
});

async function generateReceiptNumber(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("receipts")
    .select("receipt_number")
    .eq("user_id", userId)
    .like("receipt_number", `${year}-%`)
    .order("receipt_number", { ascending: false })
    .limit(1);

  const lastNumber = data?.[0]
    ? parseInt(data[0].receipt_number.split("-")[1])
    : 0;

  return `${year}-${String(lastNumber + 1).padStart(5, "0")}`;
}
```

### Lista de Edge Functions planejadas

| Function | Propósito | Método |
|----------|-----------|--------|
| `create-receipt` | Gerar recibo a partir de expense | POST |
| `check-conflict` | Verificar conflito de horário | POST |
| `send-notification` | Enviar notificação via webhook | POST |
| `calculate-taxes` | Calcular IRPF/ISS/INSS | POST |
| `sync-calendar` | Sincronizar com Google Calendar | POST |

---

## Validation Checklist

- [ ] Todas as tabelas têm campo `user_id` com FK para `auth.users(id)`?
- [ ] RLS está ATIVO em todas as tabelas?
- [ ] Cada tabela tem 4 políticas (SELECT, INSERT, UPDATE, DELETE)?
- [ ] Logs de auditoria são inseridos antes de retornar dados sensíveis?
- [ ] Edge Functions leem secrets via `Deno.env.get`?
- [ ] Edge Functions retornam JSON no padrão success/error?
- [ ] Conflitos de horário são validados antes de inserir agendamento?
- [ ] `service_role_key` NUNCA aparece no código do frontend?