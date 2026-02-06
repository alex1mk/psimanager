# 🧠 PsiManager - Sistema de Gestão para Consultório de Psicologia

Sistema completo de agendamento, gestão financeira e administrativo para consultórios de psicologia.

## 🎯 Características Principais

- ✅ **Agendamento Inteligente** - Dois fluxos (paciente e psicóloga)
- ✅ **Sincronização Google Calendar** - Automática e bidirecional
- ✅ **Links de Confirmação** - Seguros e com expiração
- ✅ **Recorrência Flexível** - Semanal, quinzenal e mensal
- ✅ **Validação de Conflitos** - Impossível agendar horário ocupado
- ✅ **Email Automático** - Confirmações via Resend
- ✅ **Dashboard Financeiro** - Receitas e despesas
- ✅ **Gestão de Pacientes** - CRUD completo

---

## 🏗️ Arquitetura

### Stack Tecnológica
```
Frontend:
├── React 18 + TypeScript
├── Vite (build tool)
├── TailwindCSS (styling)
├── React Big Calendar (agenda visual)
├── date-fns (manipulação de datas)
└── Lucide Icons

Backend:
├── Supabase (Postgres + RLS)
├── Edge Functions (Deno runtime)
├── Real-time subscriptions
└── Row Level Security

Integrações:
├── Google Calendar API (sincronização)
├── Resend (emails transacionais)
└── Manual WhatsApp (via copiar/colar)
```

### Fluxo de Dados
```
┌─────────────────────────────────────────────────┐
│         FLUXO A: Paciente Inicia                │
├─────────────────────────────────────────────────┤
│ 1. Psicóloga gera link manualmente             │
│ 2. Envia via WhatsApp (humano)                 │
│ 3. Paciente preenche data/hora                 │
│ 4. Sistema valida conflitos                    │
│ 5. Confirma e sincroniza Google Calendar       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         FLUXO B: Psicóloga Inicia               │
├─────────────────────────────────────────────────┤
│ 1. Psicóloga pré-agenda no sistema             │
│ 2. Sistema gera link automaticamente           │
│ 3. Email enviado (Resend)                      │
│ 4. Mensagem WhatsApp gerada (copiar)           │
│ 5. Paciente apenas revisa e confirma           │
│ 6. Sincroniza Google Calendar                  │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Setup e Instalação

### Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase (free tier funciona)
- Conta no Resend (opcional, para emails)
- Google Cloud Project (opcional, para calendário)

### 1. Clonar Repositório
```bash
git clone https://github.com/alex1mk/psimanager.git
cd psimanager
npm install
```

### 2. Configurar Supabase
```bash
# Criar projeto em: supabase.com/dashboard

# Copiar variáveis:
cp .env.example .env

# Editar .env:
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Rodar Migrações
```bash
# Acessar Supabase SQL Editor e executar em ordem:

1. supabase/migrations/20260201000001_create_confirmation_tokens.sql
2. supabase/migrations/20260201000002_update_appointments_for_new_flow.sql
```

### 4. Deploy de Edge Functions
```bash
# Instalar Supabase CLI:
npm install -g supabase

# Login:
supabase login

# Link ao projeto:
supabase link --project-ref xyz

# Deploy de todas as functions:
supabase functions deploy get-appointment-by-token
supabase functions deploy confirm-appointment
supabase functions deploy send-confirmation-email
supabase functions deploy google-calendar-create
supabase functions deploy google-calendar-update
supabase functions deploy google-calendar-cancel
supabase functions deploy google-calendar-health
```

### 5. Configurar Secrets
```bash
# Secret para validação de tokens:
supabase secrets set CONFIRMATION_SECRET=$(openssl rand -hex 32)

# Resend (email):
supabase secrets set RESEND_API_KEY=re_...

# Google Calendar (opcional):
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
supabase secrets set GOOGLE_CALENDAR_ID=primary
```

### 6. Rodar Localmente
```bash
npm run dev
```

Acessar: http://localhost:5173

---

## 🔧 Configuração do Google Calendar (Opcional)

### Passo 1: Criar Service Account

1. Acessar: https://console.cloud.google.com
2. Criar novo projeto: "PsiManager"
3. Ativar API: **Google Calendar API**
4. Credentials → Create Service Account
   - Nome: `psimanager-calendar`
   - Role: `Editor`
5. Keys → Add Key → JSON
6. Baixar arquivo JSON

### Passo 2: Compartilhar Calendário

1. Abrir Google Calendar
2. Settings → Calendário desejado
3. Share with specific people
4. Adicionar email do Service Account (está no JSON)
5. Permission: **Make changes to events**

### Passo 3: Configurar no Supabase
```bash
# Copiar TODO o conteúdo do JSON:
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'

# ID do calendário (geralmente "primary"):
supabase secrets set GOOGLE_CALENDAR_ID=primary
```

### Passo 4: Testar
```bash
curl https://xyz.supabase.co/functions/v1/google-calendar-health

# Resposta esperada:
{
  "configured": true,
  "calendar_id": "primary",
  "service_account": "psimanager@projeto.iam.gserviceaccount.com"
}
```

---

## 📧 Configuração do Resend (Opcional)

### Passo 1: Criar Conta

1. Acessar: https://resend.com
2. Sign up (free tier: 100 emails/dia)

### Passo 2: Verificar Domínio

1. Dashboard → Domains → Add Domain
2. Adicionar DNS records no seu provedor:
```
   TXT  @  "resend-verify=abc123..."
```
3. Aguardar verificação (~10min)

### Passo 3: Gerar API Key

1. API Keys → Create
2. Name: `PsiManager Production`
3. Copiar key

### Passo 4: Configurar no Supabase
```bash
supabase secrets set RESEND_API_KEY=re_abc123xyz...
```

### Passo 5: Testar

Criar um pré-agendamento e verificar inbox do paciente.

---

## 🗂️ Estrutura de Pastas
```
psimanager/
├── src/
│   ├── components/
│   │   └── appointments/
│   │       └── PreScheduleModal.tsx       # Modal de pré-agendamento
│   ├── hooks/
│   │   └── useAppointmentSync.ts          # Sincronização em tempo real
│   ├── services/
│   │   ├── features/
│   │   │   └── appointments/
│   │   │       └── appointment-engine.service.ts  # Motor central
│   │   └── integrations/
│   │       └── google-calendar.service.ts  # Wrapper Google API
│   ├── views/
│   │   ├── Agenda.tsx                     # Calendário principal
│   │   └── PublicConfirmation.tsx         # Página pública /confirmar
│   └── App.tsx
├── supabase/
│   ├── functions/
│   │   ├── get-appointment-by-token/
│   │   ├── confirm-appointment/
│   │   ├── send-confirmation-email/
│   │   ├── google-calendar-create/
│   │   ├── google-calendar-update/
│   │   ├── google-calendar-cancel/
│   │   └── google-calendar-health/
│   └── migrations/
│       ├── 20260201000001_create_confirmation_tokens.sql
│       └── 20260201000002_update_appointments_for_new_flow.sql
├── docs/
│   ├── TESTES_FLUXO_A.md
│   ├── TESTES_FLUXO_B.md
│   └── ARQUITETURA.md
└── README.md
```

---

## 🧪 Testes
```bash
# Testes manuais detalhados:
Ver docs/TESTES_FLUXO_A.md
Ver docs/TESTES_FLUXO_B.md

# Checklist completo de validação
```

---

## 🔐 Segurança

### Implementado

✅ **Row Level Security (RLS)** - Dados isolados por usuário
✅ **Tokens HMAC** - Links de confirmação criptografados
✅ **Expiração de Token** - 24h de validade
✅ **Uso Único** - Token não pode ser reutilizado
✅ **Validação de Conflitos** - Backend valida horários
✅ **CORS Restrito** - Edge Functions protegidas

### Boas Práticas

- Secrets nunca commitados no Git
- Service Account com menor privilégio possível
- Validação client-side + server-side
- Logs detalhados (sem dados sensíveis)

---

## 📊 Monitoramento

### Logs do Supabase
```bash
# Ver logs em tempo real:
supabase functions logs confirm-appointment --tail

# Buscar erros específicos:
supabase functions logs confirm-appointment --grep "error"
```

### Health Checks
```bash
# Google Calendar:
curl https://xyz.supabase.co/functions/v1/google-calendar-health

# Resend (verificar dashboard diretamente)
```

---

## 🐛 Troubleshooting

### Problema: "Token inválido"

**Causas possíveis:**
1. Token expirou (>24h)
2. Token já foi usado
3. Secret `CONFIRMATION_SECRET` mudou

**Solução:**
- Gerar novo link
- Verificar secret: `supabase secrets list`

### Problema: Google Calendar não sincroniza

**Causas possíveis:**
1. Service Account não configurado
2. Calendário não compartilhado
3. Credenciais inválidas

**Solução:**
```bash
# Testar configuração:
curl https://xyz.supabase.co/functions/v1/google-calendar-health

# Se retornar "configured": false, revisar setup
```

### Problema: Email não chega

**Causas possíveis:**
1. Domínio não verificado no Resend
2. API Key inválida
3. Email na caixa de spam

**Solução:**
- Verificar dashboard do Resend
- Testar com email pessoal
- Conferir secret: `supabase secrets list | grep RESEND`

---

## 🚀 Deploy em Produção

### Vercel (Frontend)
```bash
# Instalar Vercel CLI:
npm install -g vercel

# Deploy:
vercel --prod

# Configurar variáveis de ambiente no dashboard:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_URL=https://psimanager.vercel.app
```

### Supabase (Backend)

Edge Functions já estão em produção após deploy via CLI.

### Checklist Pré-Deploy

- [ ] Todas migrações aplicadas
- [ ] Edge Functions deployadas
- [ ] Secrets configurados
- [ ] Google Calendar testado
- [ ] Resend testado
- [ ] RLS policies ativas
- [ ] Domínio customizado configurado
- [ ] SSL ativo

---

## 📝 Changelog

### v2.0.0 - Novo Fluxo de Agendamento (2026-02-01)

**🎉 Mudanças Principais:**
- ✅ Removido Twilio/WhatsApp API (custo eliminado)
- ✅ Implementado motor central de agendamento
- ✅ Dois fluxos convergentes (paciente + psicóloga)
- ✅ Links de confirmação seguros
- ✅ Sincronização automática Google Calendar
- ✅ Suporte completo a recorrência
- ✅ Validação robusta de conflitos
- ✅ Email transacional via Resend

**🔧 Correções:**
- Navegação de calendários corrigida
- Importação Excel normalizada
- Dashboard com estado vazio
- Timezone correto (America/Sao_Paulo)

**🗑️ Removido:**
- Dependências Twilio
- Webhooks WhatsApp
- Código legado de SMS

---

## 👥 Contribuindo

Este é um projeto single-tenant (uso privado), mas sugestões são bem-vindas:

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📄 Licença

Uso privado - Todos os direitos reservados.

---

## 📞 Suporte

Para dúvidas ou problemas:
- Abrir issue no GitHub
- Email: alex1mk@example.com

---

**Desenvolvido com ❤️ para otimizar a gestão de consultórios de psicologia.**
