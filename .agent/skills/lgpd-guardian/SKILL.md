---
name: lgpd-guardian
description: Garante conformidade com LGPD em todas as operações envolvendo dados pessoais e sensíveis de pacientes, aplicando princípios de minimização, finalidade, consentimento e segurança da informação
---

# LGPD Guardian

## Purpose

Atuar como guardião da conformidade com a Lei Geral de Proteção de Dados (LGPD) no sistema de gestão de clínica psicológica, garantindo que todos os dados pessoais e dados sensíveis de saúde sejam coletados, armazenados, processados e compartilhados de acordo com os requisitos legais brasileiros. Esta skill previne vazamentos de dados, acessos não autorizados e violações de privacidade que podem resultar em multas de até 2% do faturamento ou R$ 50 milhões.

## When to use this skill

- Ao criar, modificar ou excluir tabelas que armazenam dados pessoais ou de saúde
- Ao implementar formulários de cadastro ou coleta de informações de pacientes
- Ao desenvolver funcionalidades de relatórios, exportação ou compartilhamento de dados
- Ao configurar autenticação, autorização e controles de acesso
- Ao implementar logs, auditoria ou sistemas de backup
- Ao integrar serviços de terceiros (pagamentos, email, analytics)
- Ao criar políticas de retenção ou exclusão de dados
- Ao desenvolver funcionalidades de consentimento e termos de uso

## Responsibilities

1. **Classificar dados corretamente:**
   - Dados pessoais: nome, CPF, email, telefone, endereço
   - Dados sensíveis de saúde: diagnósticos, anotações clínicas, histórico de sessões
   - Dados financeiros: informações de pagamento, valores de honorários

2. **Garantir minimização de dados:**
   - Coletar apenas dados estritamente necessários para a finalidade declarada
   - Questionar toda solicitação de campo "adicional" em formulários

3. **Validar bases legais:**
   - Consentimento explícito para tratamento de dados sensíveis de saúde
   - Execução de contrato para dados administrativos e financeiros
   - Obrigação legal para retenção fiscal de documentos

4. **Assegurar direitos dos titulares:**
   - Implementar funcionalidades de acesso, correção, exclusão e portabilidade
   - Garantir que pacientes possam revogar consentimento
   - Implementar anonimização após término do prazo de retenção

5. **Aplicar segurança técnica:**
   - Criptografia em trânsito (HTTPS) e em repouso (database encryption)
   - Row Level Security (RLS) em todas as tabelas sensíveis
   - Logs de auditoria para todas as operações críticas

## Rules and Constraints

### ✅ PERMITIDO

- Coletar CPF apenas se necessário para emissão de recibos fiscais
- Armazenar anotações clínicas criptografadas com acesso restrito ao psicólogo responsável
- Implementar soft delete (marcação lógica) para preservar integridade de histórico financeiro
- Usar tokens de sessão com expiração automática
- Implementar MFA (autenticação multi-fator) para acesso administrativo

### ❌ PROIBIDO

- Armazenar senhas em texto plano ou com hashing reversível
- Compartilhar dados de pacientes com terceiros sem consentimento explícito documentado
- Usar dados de saúde para finalidades não declaradas (ex: marketing, analytics de comportamento)
- Implementar `SELECT *` sem RLS em tabelas com dados sensíveis
- Criar logs que contenham dados pessoais identificáveis sem necessidade
- Manter dados de pacientes indefinidamente sem política de retenção
- Expor service_role_key ou credenciais no código frontend
- Implementar exportação de dados em massa sem controle de acesso

## Validation Checklist

Antes de considerar qualquer funcionalidade relacionada a dados pessoais como concluída, valide:

- [ ] A coleta de dados tem base legal identificada e documentada?
- [ ] Há consentimento explícito documentado para dados sensíveis de saúde?
- [ ] A finalidade da coleta está clara e comunicada ao usuário?
- [ ] Apenas dados minimamente necessários estão sendo solicitados?
- [ ] Existe RLS configurado na tabela com políticas testadas?
- [ ] Dados sensíveis estão acessíveis apenas ao psicólogo responsável pelo paciente?
- [ ] Há logs de auditoria para operações de leitura/escrita de dados sensíveis?
- [ ] Credenciais e tokens estão armazenados de forma segura (variáveis de ambiente)?
- [ ] Existe funcionalidade para o paciente acessar, corrigir ou solicitar exclusão de seus dados?
- [ ] Há política de retenção definida e automatizada para dados após término do tratamento?
- [ ] Integrações com terceiros foram avaliadas quanto a compartilhamento de dados?
- [ ] Mensagens de erro não expõem informações sensíveis ou estrutura do banco?