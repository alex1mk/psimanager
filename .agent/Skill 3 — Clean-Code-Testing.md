---
name: Skill-Clean-Code-Testing
description: Saúde do código do PsiManager. Define TypeScript strict, estrutura de pastas rígida, interfaces tipadas para todas as tabelas do Supabase, critérios de linting e padrões de testes que funcionam no ambiente web do Antigravity sem travar o build.
---

# Skill-Clean-Code-Testing

## Purpose

Manter o código do PsiManager saudável, tipado e predizível. Erros de tipo devem ser capturados em tempo de desenvolvimento, não em produção. A estrutura de pastas deve ser tão óbvia que qualquer agente ou developed entenda onde cada peça vive sem perguntar.

## When to use this skill

- Ao criar qualquer arquivo TypeScript
- Ao definir interfaces ou tipos
- Ao criar componentes ou serviços
- Ao configurar ou modificar tsconfig, eslint ou prettier
- Ao escrever ou revisar código de qualquer módulo

---

## 1. TypeScript — Configuração Estrita

### tsconfig.json

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

```json
// tsconfig.app.json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    // ✅ STRICT — OBRIGATÓRIO. Nunca desabilitar.
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Módulos
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Regras inegociáveis:**
```
❌ PROIBIDO: "strict": false
❌ PROIBIDO: usar `any` — usar `unknown` e refinar com type guards
❌ PROIBIDO: ignorar erros com // @ts-ignore
❌ PROIBIDO: tipos inline repetidos — sempre extrair para interface

✅ OBRIGATÓRIO: strict: true
✅ OBRIGATÓRIO: todas as funções exportadas têm retorno tipado explícito
✅ OBRIGATÓRIO: props de componentes usam interface nomeada
✅ OBRIGATÓRIO: dados do banco usam interfaces geradas ou manually tipadas
```

---

## 2. Estrutura de Pastas — Separação Rígida

```
src/
├── components/
│   ├── ui/                    ← Componentes PUROS. Sem lógica de negócio.
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Toast.tsx
│   │   ├── ToastProvider.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Skeleton.tsx
│   │   └── PageLayout.tsx
│   │
│   └── features/              ← Componentes com LÓGICA DE NEGÓCIO
│       ├── patients/
│       │   ├── PatientForm.tsx
│       │   ├── PatientList.tsx
│       │   ├── PatientCard.tsx
│       │   └── usePatients.ts
│       ├── appointments/
│       │   ├── AppointmentForm.tsx
│       │   ├── AgendaView.tsx
│       │   ├── AppointmentCard.tsx
│       │   └── useAppointments.ts
│       ├── expenses/
│       │   ├── ExpenseForm.tsx
│       │   ├── ExpenseList.tsx
│       │   └── useExpenses.ts
│       └── receipts/
│           ├── ReceiptView.tsx
│           ├── ReceiptList.tsx
│           └── useReceipts.ts
│
├── hooks/                     ← Hooks globais reutilizáveis
│   ├── useAuth.ts
│   ├── useToast.ts
│   └── useDebounce.ts
│
├── lib/                       ← Utilitários, configurações e clientes
│   ├── supabase.ts            ← Cliente Supabase (único ponto de criação)
│   ├── audit.ts               ← Funções de log de auditoria
│   ├── money.ts               ← Classe Money para cálculos financeiros
│   ├── utils.ts               ← cn() e utilitários genéricos
│   └── design-tokens.ts       ← Tokens de design
│
├── services/                  ← Funções de comunicação com Supabase
│   ├── patientService.ts
│   ├── appointmentService.ts
│   ├── expenseService.ts
│   └── receiptService.ts
│
├── types/                     ← TODAS as interfaces do projeto
│   ├── database.ts            ← Tipos de tabelas do Supabase
│   ├── api.ts                 ← Contratos de request/response
│   └── index.ts               ← Re-export de todos os tipos
│
├── views/                     ← Páginas da aplicação
│   ├── Dashboard.tsx
│   ├── Patients.tsx
│   ├── Agenda.tsx
│   ├── Expenses.tsx
│   ├── Receipts.tsx
│   └── Login.tsx
│
├── App.tsx
├── main.tsx
├── index.css
└── index.html
```

### Regras de separação

```
src/components/ui/
  ├── ✅ Recebe dados via props
  ├── ✅ Não faz chamadas ao Supabase
  ├── ✅ Não conhece tipos de negócio (Patient, Appointment)
  └── ✅ Pode ser usado em qualquer projeto

src/components/features/
  ├── ✅ Usa hooks para buscar dados
  ├── ✅ Conhece tipos de negócio
  ├── ✅ Contém lógica de validação específica do domínio
  └── ✅ Cada pasta = um módulo do sistema
```

---

## 3. Interfaces — Todas as Tabelas Tipadas

```typescript
// src/types/database.ts

// ─── AUTH ─────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// ─── PATIENTS ─────────────────────────────────────
export interface Patient {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;       // ISO date string
  notes: string | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

export type PatientStatus = 'active' | 'inactive' | 'archived';

export type CreatePatientDTO = Omit<Patient, 'id' | 'created_at' | 'updated_at'>;
export type UpdatePatientDTO = Partial<Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ─── APPOINTMENTS ─────────────────────────────────
export interface Appointment {
  id: string;
  user_id: string;
  patient_id: string;
  start_time: string;             // ISO 8601 com timezone
  end_time: string;               // ISO 8601 com timezone
  status: AppointmentStatus;
  notes: string | null;
  recurrence_group_id: string | null;  // Para sessões recorrentes
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type CreateAppointmentDTO = Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
export type UpdateAppointmentDTO = Partial<Omit<Appointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ─── EXPENSES ─────────────────────────────────────
export interface Expense {
  id: string;
  user_id: string;
  patient_id: string;
  appointment_id: string | null;
  session_value: number;
  discount_amount: number;
  final_value: number;            // session_value - discount_amount
  irrf_amount: number;
  iss_amount: number;
  inss_amount: number;
  net_value: number;              // final_value - impostos
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'transferencia';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export type CreateExpenseDTO = Omit<Expense, 'id' | 'final_value' | 'net_value' | 'created_at' | 'updated_at'>;
export type UpdateExpenseDTO = Partial<Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ─── RECEIPTS ─────────────────────────────────────
export interface Receipt {
  id: string;
  user_id: string;
  expense_id: string;
  patient_id: string;
  receipt_number: string;         // Formato: YYYY-NNNNN
  issue_date: string;             // ISO date
  gross_value: number;
  net_value: number;
  created_at: string;
}

export type CreateReceiptDTO = Omit<Receipt, 'id' | 'created_at'>;

// ─── AUDIT LOG ────────────────────────────────────
export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  resource_type: AuditResource;
  resource_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditResource = 'patient' | 'appointment' | 'expense' | 'receipt';

// ─── RESPOSTAS DE API (Edge Functions) ────────────
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Type guard para verificar sucesso
export function isSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}
```

```typescript
// src/types/index.ts — Re-export centralizado
export type {
  User,
  Patient, PatientStatus, CreatePatientDTO, UpdatePatientDTO,
  Appointment, AppointmentStatus, CreateAppointmentDTO, UpdateAppointmentDTO,
  Expense, PaymentMethod, PaymentStatus, CreateExpenseDTO, UpdateExpenseDTO,
  Receipt, CreateReceiptDTO,
  AuditLog, AuditAction, AuditResource,
  ApiResponse, ApiSuccessResponse, ApiErrorResponse
} from './database';

export { isSuccess } from './database';
```

---

## 4. Serviços — Padrão de Comunicação com Supabase

```typescript
// src/services/patientService.ts
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import type { Patient, CreatePatientDTO, UpdatePatientDTO } from '@/types';

export async function getPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) throw error;

  // Log de auditoria para leitura de dados sensíveis
  data.forEach(p => logAudit({ action: 'READ', resource_type: 'patient', resource_id: p.id }));

  return data;
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  await logAudit({ action: 'READ', resource_type: 'patient', resource_id: id });
  return data;
}

export async function createPatient(dto: CreatePatientDTO): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .insert(dto)
    .select()
    .single();

  if (error) throw error;

  await logAudit({ action: 'CREATE', resource_type: 'patient', resource_id: data.id });
  return data;
}

export async function updatePatient(id: string, dto: UpdatePatientDTO): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit({ action: 'UPDATE', resource_type: 'patient', resource_id: id, details: dto });
  return data;
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAudit({ action: 'DELETE', resource_type: 'patient', resource_id: id });
}
```

---

## 5. Linting — Prettier e ESLint no Antigravity

### .prettierrc

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### eslint.config.js

```javascript
// eslint.config.js — formato flat (ESLint 9+)
// Compatível com ambiente web do Antigravity
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',           // Proibir any
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off', // Permitido quando inferência é clara
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React
      'react/jsx-uses-react': 'off',                           // React 17+ não precisa import
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',                  // Hooks só no nível superior
      'react-hooks/exhaustive-deps': 'warn',                   // Deps de useEffect

      // Qualidade
      'no-console': 'warn',                                    // Usar apenas para debug
      'no-debugger': 'error',
      'no-alert': 'error',                                     // Usar Toast, não alert()
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error'                                       // Sempre === nunca ==
    }
  },
  {
    // Ignorar arquivos gerados
    ignores: ['node_modules/**', 'dist/**', '*.config.js']
  }
];
```

### Regras anti-travamento no Antigravity

```
✅ REGRA: Erros de lint NUNCA devem bloquear o build do Vite
✅ REGRA: ESLint rodar como processo separado, não como plugin do Vite
✅ REGRA: Use apenas regras que não dependem de projeto local (sem type-checking rules)
✅ REGRA: Prettier formata no save, não bloqueia compilação

❌ PROIBIDO: eslint-plugin-import com resolver de path (quebra no web)
❌ PROIBIDO: regras que requerem tsconfig no ESLint (parserProject)
❌ PROIBIDO: prettier --check no build pipeline
```

### vite.config.ts — sem plugins de lint

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // ✅ Sem plugin de ESLint aqui — lint é separado
  server: {
    port: 3000,
    open: true
  }
});
```

---

## 6. Padrão de Hooks — Comunicação entre Componente e Serviço

```typescript
// src/components/features/patients/usePatients.ts
import { useState, useEffect, useCallback } from 'react';
import type { Patient, CreatePatientDTO } from '@/types';
import * as patientService from '@/services/patientService';

interface UsePatientReturn {
  patients: Patient[];
  loading: boolean;
  error: string | null;
  createPatient: (dto: CreatePatientDTO) => Promise<Patient>;
  refresh: () => Promise<void>;
}

export function usePatients(): UsePatientReturn {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getPatients();
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const createPatient = useCallback(async (dto: CreatePatientDTO): Promise<Patient> => {
    const created = await patientService.createPatient(dto);
    setPatients(prev => [...prev, created]);
    return created;
  }, []);

  return {
    patients,
    loading,
    error,
    createPatient,
    refresh: fetchPatients
  };
}
```

---

## 7. Testes — Estratégia Leve para Ambiente Web

No ambiente web do Antigravity, testes unitários pesados não são viáveis. Adotar estratégia de **validação em tempo de desenvolvimento**:

### 7.1 Type Safety como primeira linha de defesa

```typescript
// ✅ Se compilar, o tipo está correto
// Exemplo: tentar criar paciente sem campo obrigatório gera erro no editor

const paciente: CreatePatientDTO = {
  user_id: 'uuid',
  name: 'João',
  // ❌ Erro: 'status' é obrigatório
};
```

### 7.2 Funções de validação testáveis por design

```typescript
// src/lib/validators.ts
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit > 9) digit = 0;
  if (digit !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit > 9) digit = 0;

  return digit === parseInt(cleaned[10]);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

// Testes inline — executáveis no próprio arquivo para validação rápida
if (import.meta.env.DEV) {
  console.assert(isValidCPF('529.982.247-89') === true,  'CPF válido deve retornar true');
  console.assert(isValidCPF('000.000.000-00') === false, 'CPF todos zeros deve retornar false');
  console.assert(isValidCPF('123.456.789-00') === false, 'CPF inválido deve retornar false');
  console.assert(isValidEmail('teste@email.com') === true);
  console.assert(isValidEmail('invalido') === false);
}
```

### 7.3 Checklist de verificação manual

```
Antes de considerar um módulo completo:

□ Compilação sem erros? (Vite não mostra erros vermelho)
□ Todas as interfaces são usadas? (sem dead types)
□ Nenhum `any` no código?
□ Funções exportadas retornam tipos explícitos?
□ Hooks seguem regras do React? (não condicional, não em loop)
□ Serviços sempre logam auditoria para dados sensíveis?
□ Componentes ui/ não importam de services/ ou types de negócio?
```

---

## Validation Checklist

- [ ] `strict: true` no tsconfig e nunca foi desabilitado?
- [ ] Todas as tabelas têm interface correspondente em `src/types/database.ts`?
- [ ] DTOs (Create/Update) são derivados automaticamente via Omit/Partial?
- [ ] Não existe `any` em nenhum arquivo `.ts` ou `.tsx`?
- [ ] Separação ui/ vs features/ está sendo respeitada?
- [ ] Serviços chamam `logAudit` para operações em dados sensíveis?
- [ ] ESLint não bloqueia o build do Vite?
- [ ] Prettier está configurado e formata no save?
- [ ] Hooks seguem o padrão loading/error/data?
- [ ] Validadores têm assertions inline para verificação rápida em DEV?