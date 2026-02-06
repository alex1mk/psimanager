# 🧪 TESTES - FLUXO B: PSICÓLOGA INICIA PELO SAAS

## Objetivo
Validar que a psicóloga consegue criar pré-agendamento direto no sistema.

---

## TESTE 1: Criar Pré-Agendamento com Sucesso

### Passos:
1. Login no sistema como psicóloga
2. Ir para **Agenda**
3. Clicar em **"Novo Pré-Agendamento"**
4. Preencher formulário:
```
   Paciente: Maria Silva
   Data: 05/02/2026
   Horário: 10:00
   Recorrência: Quinzenal
   Observações: Primeira consulta de acompanhamento
```
5. Clicar em **"Criar Pré-Agendamento"**

### Resultado Esperado:
✅ Modal muda para tela de sucesso
✅ Exibe:
   - Checkmark verde
   - Link de confirmação
   - Mensagem formatada para WhatsApp:
```
   Olá Maria Silva! 😊

   Gostaria de confirmar seu agendamento:
   📅 05 de fevereiro às 10:00

   Por favor, confirme sua presença clicando no link abaixo:
   https://psimanager.vercel.app/confirmar?token=...

   Aguardo sua confirmação! 💚
```

✅ No banco de dados:
```sql
SELECT * FROM appointments 
WHERE patient_id = '[ID_MARIA]' 
AND status = 'pending_confirmation';
-- Deve retornar 1 registro

SELECT * FROM confirmation_tokens 
ORDER BY created_at DESC LIMIT 1;
-- Token criado
```

✅ E-mail automático enviado (se configurado):
- Verificar inbox da Maria Silva
- Assunto: "Confirme seu Agendamento - PsiManager"
- Conteúdo: Data, hora, botão de confirmação

---

## TESTE 2: Copiar Mensagem para WhatsApp

### Passos:
1. Na tela de sucesso, clicar em **"Copiar Mensagem Completa"**
2. Abrir WhatsApp Web
3. Encontrar contato da Maria Silva
4. Colar mensagem (Ctrl+V)

### Resultado Esperado:
✅ Mensagem completa colada com formatação
✅ Link clicável
✅ Emojis preservados
✅ Quebras de linha mantidas

---

## TESTE 3: Validação de Campos Obrigatórios

### Passos:
1. Abrir modal de pré-agendamento
2. Deixar **Paciente** em branco
3. Tentar criar

### Resultado Esperado:
❌ Formulário não submete
❌ Erro exibido: "Selecione um paciente"
❌ Campo marcado em vermelho

### Repetir para:
- Campo **Data** vazio → "Selecione uma data"
- Campo **Horário** vazio → "Selecione um horário"

---

## TESTE 4: Validação de Data no Passado

### Passos:
1. Selecionar data de ontem
2. Tentar criar

### Resultado Esperado:
❌ Erro: "Data não pode ser no passado"
❌ Campo Data em vermelho

---

## TESTE 5: Validação de Recorrência

### Passos:
1. Selecionar recorrência: **"Mensal"**
2. Definir data final: 1 dia antes da data inicial
3. Tentar criar

### Resultado Esperado:
❌ Erro: "Data final deve ser posterior à data inicial"
❌ Campo Data Final em vermelho

---

## TESTE 6: Recorrência Contínua (Sem Data Final)

### Passos:
1. Criar pré-agendamento
2. Recorrência: **"Semanal"**
3. **Deixar Data Final em branco**
4. Criar

### Resultado Esperado:
✅ Criado com sucesso
✅ No banco:
```sql
SELECT recurrence_type, recurrence_end_date 
FROM appointments WHERE id = '[ID]';

-- recurrence_type = 'weekly'
-- recurrence_end_date = NULL
```

✅ Google Calendar: RRULE sem UNTIL

---

## TESTE 7: Conflito de Horário na Criação

### Passos:
1. Criar primeiro agendamento:
   - Data: 10/02/2026
   - Horário: 15:00
   - Confirmar
2. Tentar criar segundo agendamento:
   - **MESMA** data e hora
   - Paciente diferente

### Resultado Esperado:
❌ Erro exibido:
```
"Horário já possui agendamento"
```

✅ Validação ocorre no **backend** (não apenas frontend)
✅ Nenhum registro criado no banco
✅ Token NÃO gerado

---

## TESTE 8: Email Automático (Resend)

### Pré-requisito:
```bash
# Verificar secret configurado:
supabase secrets list | grep RESEND_API_KEY
```

### Passos:
1. Criar pré-agendamento para paciente com **email válido**
2. Aguardar 10-30 segundos

### Resultado Esperado:
✅ Email recebido na caixa de entrada do paciente
✅ Assunto: "Confirme seu Agendamento - PsiManager"
✅ Corpo do email contém:
   - Nome do paciente
   - Data formatada (DD/MM/YYYY)
   - Horário
   - Botão verde "Confirmar Agendamento"
   - Link alternativo (caso botão não funcione)

---

## TESTE 9: Sincronização com Google Calendar

### Pré-requisito:
```bash
# Verificar secrets:
supabase secrets list | grep GOOGLE
```

### Passos:
1. Criar pré-agendamento
2. Paciente confirma via link
3. Abrir **Google Calendar**

### Resultado Esperado:
✅ Evento aparece no calendário:
   - Título: "Consulta - [Nome do Paciente]"
   - Data e hora corretos
   - Duração: 1 hora
   - Cor: Verde (#2 Sage)

---

## TESTE 10: Atualização de Agendamento

### Passos:
1. Criar e confirmar agendamento
2. No sistema, editar a data/hora do agendamento
3. Verificar Google Calendar

### Resultado Esperado:
✅ Hook `useAppointmentSync` detecta mudança
✅ Edge Function `google-calendar-update` é chamada
✅ Evento no Google Calendar atualiza automaticamente

---

## TESTE 11: Cancelamento de Agendamento

### Passos:
1. Criar e confirmar agendamento
2. Marcar status como "cancelled" no sistema
3. Verificar Google Calendar

### Resultado Esperado:
✅ Hook detecta mudança de status
✅ Edge Function `google-calendar-cancel` é chamada
✅ Evento **removido** do Google Calendar

---

## TESTE 12: Recorrência Quinzenal no Google Calendar

### Passos:
1. Criar pré-agendamento
2. Recorrência: **"Quinzenal"**
3. Data final: 3 meses no futuro
4. Confirmar

### Resultado Esperado:
✅ Google Calendar cria evento com RRULE:
```
RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20260501T235959Z
```

---

## ✅ CHECKLIST FINAL - FLUXO B

- [ ] Modal abre corretamente
- [ ] Validações de campo funcionam
- [ ] Conflito de horário detectado
- [ ] Mensagem WhatsApp formatada
- [ ] Email automático enviado
- [ ] Google Calendar sincroniza na confirmação
- [ ] Recorrências funcionam (semanal, quinzenal, mensal)
- [ ] Atualização sincroniza
- [ ] Cancelamento sincroniza

---

## 🔧 TROUBLESHOOTING AVANÇADO

### Problema: Hook não dispara
**Causa:** Subscription não conectada
**Solução:** Verificar RLS na tabela `appointments` e se o usuário está autenticado.

### Problema: Recorrência não funciona no Google
**Causa:** RRULE mal formatado
**Solução:** Validar formato UNTIL (sem hífens, com T e Z).

---

## 🎯 CENÁRIOS EDGE CASE

### Cenário 1: Múltiplos Tabs Abertos
1. Abrir link de confirmação em 3 tabs
2. Confirmar em uma delas
3. Esperado: Tab 2 e 3 exibem "Token já utilizado"

### Cenário 2: Paciente sem Email
1. Gerar pré-agendamento sem email
2. Esperado: Fluxo continua normalmente, apenas email é ignorado.

### Cenário 3: Google Calendar Offline
1. Remover secrets do Google
2. Confirmar agendamento
3. Esperado: Agendamento confirma no Banco, erro logado no Google.
