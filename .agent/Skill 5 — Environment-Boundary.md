---
name: Skill-Environment-Boundary.md
description: Regras do ambiente de desenvolvimento web do PsiManager. Proibições explícitas, capabilities do ambiente Google Antigravity, conexão com Supabase cloud e Edge Functions. Qualquer agente que trabalhe neste projeto deve respeitar estas fronteiras sem exceção.
---

# Skill-Environment-Boundary

## Purpose

Definir o perímetro do ambiente de desenvolvimento. O PsiManager é desenvolvido 100% em ambiente web (Google Antigravity) — sem VS Code local, sem terminal local, sem sistema de arquivos persistente fora da nuvem. Este documento define o que é possível, o que é proibido e como conectar cada peça.

## When to use this skill

- Antes de propor qualquer solução técnica
- Quando um agente tenta usar ferramenta ou abordagem fora do ambiente
- Ao configurar conexões com Supabase, Edge Functions ou serviços externos
- Ao estruturar deploy ou CI/CD
- Quando há dúvida sobre o que o ambiente suporta

---

## 1. Perímetro do Ambiente

### O que existe

| Componente | Disponível | Detalhes |
|---|---|---|
| Editor web | ✅ | Google Antigravity — edição direta no navegador |
| Runtime | ✅ | Node.js via Vite dev server (em nuvem) |
| Supabase cloud | ✅ | Banco, Auth, Storage, Edge Functions, Realtime |
| Deploy automático | ✅ | Cada commit reflete no ambiente instantaneamente |
| Variáveis de ambiente | ✅ | Configuradas no painel do projeto |
| Terminal local | ❌ | Não existe |
| VS Code desktop | ❌ | Não existe |
| Sistema de arquivos local | ❌ | Não existe |
| Docker | ❌ | Não existe |
| SSH | ❌ | Não existe |

### O que é proibido
```
❌ Instalar pacotes via npm install no terminal
❌ Executar scripts locais (node script.js)
❌ Usar ferramentas CLI que dependam de terminal persistente
❌ Criar arquivos fora da estrutura do projeto no editor
❌ Dependir de sistema de arquivos local para cache ou estado
❌ Usar SQLite ou banco local — tudo vai para Supabase
❌ Hardcoder credentials ou secrets no código fonte
❌ Assumir que o ambiente tem acesso à rede interna corporativa
```

### O que é permitido
```
✅ Editar código diretamente no editor web
✅ Adicionar dependências via package.json (resolve no deploy)
✅ Criar Edge Functions no Supabase para lógica server-side
✅ Usar variáveis de ambiente via .env (não commitadas)
✅ Chamar APIs externas via fetch() no cliente ou Edge Functions
✅ Usar Supabase Realtime para atualização em tempo real
✅ Estruturar código em pastas conforme Skill-Clean-Code-Testing
```

---

## 2. Conexão com Supabase

### Configuração do cliente
```typescript
// src/lib/supabase.ts
import { createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase'; // Gerado via Supabase CLI types

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variáveis de ambiente Supabase não configuradas');
}

export const supabase = createSupabaseClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
```

### Variáveis de ambiente obrigatórias
```env
# .env — NUNCA comitar este arquivo
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_SERVICE_KEY=eyJ...   # Apenas para Edge Functions (server-side)
```

### Regras de uso do cliente
```
1. Queries no cliente sempre filtram por user_id (RLS enforce no banco)
2. Service Key nunca é exposta no cliente — só Edge Functions
3. Realtime subscriptions são criadas no mount e cleanupadas no unmount
4. Erros de conexão são tratados com retry automático (ver Skill 6)
```

---

## 3. Edge Functions — Lógica Server-Side

Edge Functions são o único lugar para executar lógica que não pode ir ao cliente: secrets, chamadas para APIs com autenticação server-side, jobs agendados.

### Estrutura
```
supabase/
  functions/
    update-overdue/
      index.ts          # Job: atualiza expenses overdue
    sync-google-calendar/
      index.ts          # Sincroniza agendamento com Google Calendar
    send-notification/
      index.ts          # Envia notificação via webhook genérico
    _shared/
      cors.ts           # Headers CORS padrão
      auth.ts           # Verificar token do usuário
      errors.ts         # Respostas de erro padronizadas
```

### Template base — Edge Function
```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
```
```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}
```
```typescript
// supabase/functions/_shared/errors.ts
import { corsHeaders } from './cors';

export function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

export function successResponse(data: unknown, status: number = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Edge Function — update-overdue
```typescript
// supabase/functions/update-overdue/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { extractUserId } from '../_shared/auth.ts';
import { errorResponse, successResponse } from '../_shared/errors.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ─── Calcular data limite (replica da lógica do cliente) ─
function calculatePaymentDueDate(sessionDate: Date): Date {
  const day = sessionDate.getDate();
  const month = sessionDate.getMonth();
  const year = sessionDate.getFullYear();

  if (day >= 1 && day <= 4) return new Date(year, month, 5);
  if (day >= 5 && day <= 19) return new Date(year, month, 20);
  return new Date(year, month + 1, 5);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const userId = await extractUserId(req);
  if (!userId) return errorResponse('Não autorizado', 401);

  // Buscar expenses pendentes do usuário
  const { data: pending, error } = await supabase
    .from('expenses')
    .select('id, session_date')
    .eq('user_id', userId)
    .eq('payment_status', 'pending');

  if (error) return errorResponse('Erro ao buscar despesas');

  let updated = 0;
  const now = new Date();

  for (const expense of pending || []) {
    const dueDate = calculatePaymentDueDate(new Date(expense.session_date));

    if (now > dueDate) {
      await supabase
        .from('expenses')
        .update({ payment_status: 'overdue', updated_at: now.toISOString() })
        .eq('id', expense.id);
      updated++;
    }
  }

  return successResponse({ updated, checked: pending?.length || 0 });
});
```

---

## 4. Deploy e Ambiente

### Fluxo de deploy
```
Edição no editor web (Google Antigravity)
    │
    ▼
Commit automático no repositório
    │
    ▼
Vite build (resolve dependências do package.json)
    │
    ▼
Deploy automático do frontend
    │
    ▼
Edge Functions deploy separado (supabase functions deploy)
```

### Checklist pré-deploy
```
✅ Todas as variáveis de ambiente estão configuradas no painel
✅ Nenhum secret hardcoded no código
✅ Edge Functions usam SUPABASE_SERVICE_ROLE_KEY (não ANON_KEY)
✅ CORS configurado nas Edge Functions
✅ Types do Supabase estão atualizados
✅ Não há dependência de sistema de arquivos local
```