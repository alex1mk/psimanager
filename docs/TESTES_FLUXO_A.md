# 🧪 TESTES - FLUXO A: PACIENTE INICIA VIA LINK

## Objetivo
Validar que o paciente consegue confirmar agendamento via link enviado manualmente.

---

## PRÉ-REQUISITOS

- [ ] Sistema rodando (dev ou produção)
- [ ] Banco de dados com pelo menos 1 paciente cadastrado
- [ ] Google Calendar configurado (opcional mas recomendado)
- [ ] Resend configurado para e-mails (opcional)

---

## TESTE 1: Gerar Link de Confirmação

### Passos:
1. Acesse a tela de **Agenda**
2. Clique em **"Novo Pré-Agendamento"**
3. Preencha:
   - Paciente: Selecione qualquer
   - Data: Amanhã
   - Horário: 14:00
   - Recorrência: Sessão única
4. Clique em **"Criar Pré-Agendamento"**

### Resultado Esperado:
✅ Modal exibe:
- Link de confirmação copiável
- Mensagem formatada para WhatsApp
- Botão "Copiar Mensagem Completa"

✅ No banco de dados:
```sql
-- Verificar no Supabase SQL Editor:
SELECT * FROM appointments 
WHERE status = 'pending_confirmation' 
ORDER BY created_at DESC LIMIT 1;

-- Deve retornar 1 registro com status = 'pending_confirmation'

SELECT * FROM confirmation_tokens 
ORDER BY created_at DESC LIMIT 1;

-- Deve retornar 1 token com expires_at = now() + 24h
-- E used_at = null
```

### Em caso de falha:
- Verificar logs do navegador (F12 > Console)
- Verificar se Edge Function `get-appointment-by-token` está ativa
- Verificar variável `CONFIRMATION_SECRET` no Supabase

---

## TESTE 2: Abrir Link de Confirmação

### Passos:
1. Copie o link gerado no teste anterior
2. Abra em uma **nova aba anônima** (simular paciente)
3. Cole o link na barra de endereços

### Resultado Esperado:
✅ Página de confirmação carrega
✅ Exibe nome do paciente
✅ Data e horário vêm pré-preenchidos
✅ Dropdown de recorrência está disponível

### Em caso de falha:
**Erro: "Token inválido"**
- Token pode ter expirado (>24h)
- Token pode estar incorreto (conferir na URL)
- Edge Function `get-appointment-by-token` com problema

**Página em branco:**
- Verificar rota `/confirmar` existe no router
- Verificar `PublicConfirmation.tsx` está importado corretamente

---

## TESTE 3: Confirmar Agendamento (Cenário de Sucesso)

### Passos:
1. Na página de confirmação, **mantenha** data e hora sugeridas
2. Selecione recorrência: **"Semanal"**
3. Clique em **"Confirmar Agendamento"**

### Resultado Esperado:
✅ Loading aparece
✅ Após 2-5 segundos, página de sucesso:
   - Checkmark verde
   - "Agendamento Confirmado!"
   - Data e hora exibidas corretamente
   - "Recorrência: Semanal"

✅ No banco de dados:
```sql
-- Status deve mudar para 'confirmed'
SELECT status, recurrence_type FROM appointments 
WHERE id = '[ID_DO_AGENDAMENTO]';

-- Token deve estar marcado como usado
SELECT used_at FROM confirmation_tokens 
WHERE token = '[TOKEN_DA_URL]';
-- used_at deve ter timestamp
```

✅ Google Calendar (se configurado):
- Abrir Google Calendar
- Verificar evento "Consulta - [Nome do Paciente]"
- Verificar recorrência semanal configurada

✅ E-mail (se configurado):
- Paciente deve receber e-mail de confirmação

---

## TESTE 4: Confirmar com Conflito de Horário

### Passos:
1. Crie um NOVO pré-agendamento para o **mesmo paciente**
2. Use **mesma data e hora** do teste anterior
3. Copie o link
4. Abra em aba anônima
5. Tente confirmar

### Resultado Esperado:
❌ Erro exibido:
```
"Horário já está ocupado. Por favor, escolha outro."
```

✅ Status continua `pending_confirmation`
✅ Token NÃO é marcado como usado

### Ação do Paciente:
1. Escolher nova data ou horário
2. Confirmar novamente
3. Deve funcionar normalmente

---

## TESTE 5: Token Expirado (24h)

### Passos:
1. No banco de dados, force expiração:
```sql
UPDATE confirmation_tokens 
SET expires_at = now() - interval '1 hour'
WHERE token = '[TOKEN_DE_TESTE]';
```

2. Tente abrir o link

### Resultado Esperado:
❌ Página de erro:
```
"Token expirado"
```

✅ Botão de ação não aparece
✅ Instruções para solicitar novo link

---

## TESTE 6: Token Já Usado

### Passos:
1. Use um link que já foi confirmado anteriormente
2. Tente acessar novamente

### Resultado Esperado:
❌ Página de erro:
```
"Token já utilizado"
```

✅ Mensagem: "Presença Já Confirmada"
✅ Data do agendamento anterior exibida

---

## TESTE 7: Recorrência Mensal

### Passos:
1. Crie novo pré-agendamento
2. Confirme com recorrência: **"Mensal"**

### Resultado Esperado:
✅ Google Calendar cria evento com RRULE:
```
RRULE:FREQ=MONTHLY
```

✅ No banco:
```sql
SELECT recurrence_type FROM appointments WHERE id = '[ID]';
-- Deve retornar 'monthly'
```

---

## ✅ CHECKLIST FINAL - FLUXO A

- [ ] Link gerado corretamente
- [ ] Token válido por 24h
- [ ] Página de confirmação carrega
- [ ] Campos pré-preenchidos funcionam
- [ ] Conflito de horário detectado
- [ ] Status muda para 'confirmed'
- [ ] Token marcado como usado
- [ ] Google Calendar sincroniza
- [ ] E-mail enviado
- [ ] Recorrência funciona (semanal, quinzenal, mensal)
- [ ] Token expirado retorna erro
- [ ] Token reutilizado retorna erro

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema: "Cannot read property 'name' of undefined"
**Causa:** Paciente não carregou do banco
**Solução:** Verificar query no `get-appointment-by-token`

### Problema: Google Calendar não sincroniza
**Causa:** Credenciais não configuradas
**Solução:** 
```bash
# Verificar variáveis:
supabase secrets list

# Deve ter:
GOOGLE_SERVICE_ACCOUNT_KEY
GOOGLE_CALENDAR_ID
```

### Problema: E-mail não envia
**Causa:** Resend não configurado
**Solução:**
```bash
# Adicionar:
supabase secrets set RESEND_API_KEY='re_...'
```

### Problema: CORS error ao chamar Edge Function
**Causa:** Domínio não autorizado
**Solução:** Verificar `corsHeaders` na Edge Function
