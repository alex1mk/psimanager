# ❓ FAQ - PsiManager

## Perguntas Frequentes

### 1. Como gero um link de confirmação?

**R:** Acesse a **Agenda** → Clique em **"Novo Pré-Agendamento"** → Preencha os campos → O link aparecerá na tela de sucesso.

---

### 2. O paciente não recebeu o email. O que fazer?

**Possíveis causas:**

1. **Email na caixa de spam**
   - Pedir ao paciente para verificar lixeira/spam
   - Marcar como "não é spam" para futuros emails

2. **Domínio não verificado no Resend**
   - Acessar: resend.com/domains
   - Verificar se status = "Verified"
   - Se não: adicionar DNS records

3. **Resend não configurado**
   - Verificar: `supabase secrets list | grep RESEND`
   - Se não aparecer: configurar API key

**Solução alternativa:**
Copiar link manualmente e enviar via WhatsApp.

---

### 3. Google Calendar não sincroniza. Como corrigir?

**Diagnóstico:**
```bash
curl https://[seu-projeto].supabase.co/functions/v1/google-calendar-health
```

**Se retornar `"configured": false`:**

1. **Verificar Service Account:**
```bash
   supabase secrets list | grep GOOGLE_SERVICE_ACCOUNT_KEY
```
   Se não aparecer: configurar conforme README

2. **Verificar compartilhamento de calendário:**
   - Google Calendar → Settings
   - Buscar email do Service Account
   - Se não estiver: compartilhar com permissão "Make changes to events"

3. **Testar manualmente:**
   - Criar um agendamento
   - Verificar logs: `supabase functions logs google-calendar-create`
   - Procurar por erros específicos

---

### 4. Posso usar sem Google Calendar?

**R:** Sim! O Google Calendar é **opcional**.

Se não configurado:
- Sistema funciona 100% normalmente
- Apenas não sincroniza com calendário externo
- Todos os agendamentos ficam no calendário interno

---

### 5. Como funciona a recorrência?

**R:** Ao confirmar agendamento, selecione:

- **Sessão única** → Evento único
- **Semanal** → Todo [dia da semana]
- **Quinzenal** → A cada 2 [dias da semana]
- **Mensal** → Todo dia [X] do mês

**Data final:**
- **Em branco** → Recorrência contínua
- **Com data** → Recorrência até aquela data

---

### 6. Paciente pode remarcar pela página de confirmação?

**R:** Não diretamente.

Fluxo de remarcação:
1. Psicóloga cancela agendamento antigo
2. Cria novo pré-agendamento
3. Envia novo link ao paciente

---

### 7. Token expirou. Como gerar um novo?

**R:** 
1. No sistema, encontrar o agendamento
2. Gerar novo pré-agendamento (mesmo paciente, mesma data/hora)
3. Enviar novo link

---

## 🐛 Troubleshooting

### Erro: "Cannot read property 'name' of undefined"

**Causa:** Query SQL retornou vazio.

**Solução:**
```sql
-- Verificar se paciente existe:
SELECT * FROM patients WHERE id = '[ID_DO_ERRO]';

-- Se não existir: banco inconsistente
-- Recriar agendamento com paciente válido
```

---

### Erro: "Token inválido"

**Causas possíveis:**

1. **Token expirou (>24h)**
2. **Token já usado**
3. **Secret mudou**

**Solução:** Gerar novo link.

---

### Erro: "Horário já está ocupado"

**Esperado:** Sistema está funcionando corretamente.

**Ação do paciente:**
Escolher outro horário disponível.

---

### Erro: "CORS policy: No 'Access-Control-Allow-Origin'"

**Causa:** Edge Function não autoriza origem.

**Solução:**
Garantir que TODAS as respostas (incluindo erros) incluam os `corsHeaders`.

---

### Erro: "Service Account JSON inválido"

**Causa:** Formato do JSON incorreto ou aspas faltando.

**Solução:**
1. Baixar JSON novamente do Google Cloud
2. Setar secret usando aspas simples para envolver o JSON completo:
```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":...}'
```

---

**Última atualização:** {{CURRENT_DATE}}
