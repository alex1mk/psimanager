---
name: appointment-flow-auditor
description: Garante integridade, consistência e regras de negócio corretas em todo o fluxo de agendamento de sessões, incluindo criação, confirmação, cancelamento, remarcação e integração com calendário, prevenindo conflitos, duplas marcações e inconsistências de dados
---

# Appointment Flow Auditor

## Purpose

Assegurar que o fluxo completo de agendamento de sessões funcione de forma consistente, previsível e sem erros críticos que possam causar conflitos de horário, perda de informações ou frustração para psicólogos e pacientes. Esta skill garante que regras de negócio sejam aplicadas corretamente, estados de agendamento sejam rastreáveis, e integrações externas (Google Calendar, notificações) funcionem de forma confiável.

## When to use this skill

- Ao implementar criação de novos agendamentos
- Ao desenvolver funcionalidades de confirmação, cancelamento ou remarcação
- Ao criar validações de conflitos de horário
- Ao implementar integração com Google Calendar ou outros calendários externos
- Ao desenvolver notificações (email, SMS, push) relacionadas a agendamentos
- Ao criar regras de disponibilidade e bloqueio de horários
- Ao implementar recorrência de sessões ou agendamento em lote
- Ao desenvolver visualizações de agenda (diária, semanal, mensal)

## Responsibilities

1. **Prevenir conflitos de horário:**
   - Validar que não existem overlaps antes de confirmar agendamento
   - Considerar tempo de preparação entre sessões (buffer de 10-15 minutos)
   - Verificar disponibilidade do psicólogo no horário solicitado
   - Implementar locks otimistas para evitar race conditions em agendamentos simultâneos

2. **Gerenciar estados de agendamento corretamente:**
   - Estados válidos: `pending`, `confirmed`, `cancelled`, `completed`, `no_show`
   - Transições de estado devem ser explícitas e auditadas
   - Cancelamentos devem preservar histórico (soft delete ou campo de status)
   - Remarcações devem manter referência ao agendamento original

3. **Sincronizar com calendários externos:**
   - Criar evento no Google Calendar ao confirmar agendamento
   - Atualizar evento ao remarcar sessão
   - Deletar evento ao cancelar (respeitando política de retenção)
   - Implementar retry logic para falhas de sincronização
   - Armazenar `calendar_event_id` para rastreabilidade

4. **Validar regras de negócio:**
   - Não permitir agendamento em horários passados
   - Validar horário de funcionamento da clínica (ex: 08:00 às 20:00)
   - Respeitar intervalos mínimos entre sessões do mesmo paciente
   - Aplicar políticas de cancelamento (ex: mínimo 24h de antecedência)
   - Verificar se paciente tem sessões em aberto antes de agendar novas

5. **Garantir integridade referencial:**
   - Agendamento deve sempre referenciar paciente válido
   - Agendamento deve sempre referenciar psicólogo válido
   - Alterações em dados de paciente/psicólogo devem refletir em agendamentos
   - Exclusão de paciente deve lidar com agendamentos pendentes

## Rules and Constraints

### ✅ PERMITIDO

- Implementar validação de conflitos no banco de dados (constraint ou trigger)
- Permitir remarcação múltipla com histórico de alterações
- Criar "janelas de disponibilidade" configuráveis por psicólogo
- Implementar notificações em múltiplos canais (email, SMS, push)
- Usar transações atômicas para operações de agendamento + sincronização de calendário
- Permitir agendamentos recorrentes com geração automática de sessões futuras
- Implementar fila de processamento para sincronizações externas (background jobs)

### ❌ PROIBIDO

- Permitir agendamento sem validar conflitos de horário
- Sincronizar com Google Calendar de forma síncrona (bloqueando a requisição)
- Deletar permanentemente agendamentos (deve ser soft delete ou arquivamento)
- Permitir alteração de data/hora de agendamento sem validação de disponibilidade
- Implementar lógica de conflitos apenas no frontend (deve ter validação server-side)
- Criar agendamentos sem validar existência de paciente e psicólogo
- Permitir múltiplos agendamentos simultâneos para o mesmo horário e psicólogo
- Alterar status de agendamento sem registrar timestamp e usuário responsável
- Falhar silenciosamente em sincronizações externas (deve logar e alertar)

## Validation Checklist

Antes de considerar qualquer funcionalidade de agendamento como concluída, valide:

- [ ] Há validação de conflitos de horário no backend (não apenas frontend)?
- [ ] Validação considera tempo de buffer entre sessões?
- [ ] Estados de agendamento seguem máquina de estados bem definida?
- [ ] Transições de estado são registradas com timestamp e usuário?
- [ ] Cancelamentos preservam histórico do agendamento original?
- [ ] Remarcações mantêm referência ao agendamento anterior?
- [ ] Sincronização com Google Calendar tem retry logic para falhas?
- [ ] `calendar_event_id` é armazenado para rastreabilidade?
- [ ] Não é possível agendar em horários passados?
- [ ] Há validação de horário de funcionamento da clínica?
- [ ] Políticas de cancelamento são aplicadas (ex: antecedência mínima)?
- [ ] Operações críticas (criar, cancelar, remarcar) usam transações atômicas?
- [ ] Notificações são enviadas de forma assíncrona (não bloqueiam a requisição)?
- [ ] Há logs de auditoria para todas as operações de agendamento?
- [ ] Testes cobrem cenários de race condition (agendamentos simultâneos)?
```

---

