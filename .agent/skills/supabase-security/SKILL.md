---
name: supabase-security
description: Garante configuração segura de autenticação, Row Level Security, políticas de acesso, storage e funções serverless no Supabase, prevenindo vazamentos de dados, acessos não autorizados e vulnerabilidades comuns em aplicações SaaS multiusuário
---

# Supabase Security

## Purpose

Assegurar que toda a infraestrutura Supabase (Auth, Database, Storage, Edge Functions) esteja configurada seguindo princípios de segurança zero-trust, onde cada acesso é validado, cada operação é auditada, e dados sensíveis de saúde estão protegidos por múltiplas camadas de controle. Esta skill previne as vulnerabilidades mais comuns em aplicações SaaS: acesso horizontal (usuário A vê dados de usuário B), escalação de privilégios e exposição de credenciais.

## When to use this skill

- Ao criar ou modificar tabelas no banco de dados
- Ao configurar políticas de Row Level Security (RLS)
- Ao implementar autenticação e gerenciamento de sessões
- Ao desenvolver funcionalidades de upload/download de arquivos
- Ao criar Edge Functions ou Database Functions
- Ao configurar variáveis de ambiente e credenciais
- Ao implementar integrações com APIs externas
- Ao desenvolver funcionalidades administrativas ou multi-tenant

## Responsibilities

1. **Implementar Row Level Security (RLS) em todas as tabelas:**
   - Ativar RLS antes de qualquer inserção de dados
   - Criar políticas granulares por operação (SELECT, INSERT, UPDATE, DELETE)
   - Validar que usuário autenticado só acessa seus próprios dados
   - Testar políticas com múltiplos usuários antes de deploy

2. **Gerenciar credenciais de forma segura:**
   - Usar `anon_key` apenas no frontend
   - Manter `service_role_key` exclusivamente em ambiente servidor (Edge Functions, CI/CD)
   - Nunca commitar credenciais em repositório Git
   - Rotacionar chaves periodicamente (a cada 6 meses)

3. **Configurar autenticação robusta:**
   - Implementar confirmação de email obrigatória
   - Configurar políticas de senha forte (mínimo 12 caracteres, complexidade)
   - Ativar MFA para usuários administrativos
   - Implementar rate limiting em endpoints de autenticação
   - Configurar sessões com tempo de expiração adequado (24h para web, 7 dias para mobile com refresh)

4. **Proteger storage de arquivos:**
   - Ativar RLS em buckets de storage
   - Validar tipo e tamanho de arquivos antes de upload
   - Implementar políticas de acesso granulares (apenas dono do arquivo pode acessar)
   - Usar signed URLs com expiração para compartilhamento temporário

5. **Auditar acessos e operações críticas:**
   - Implementar triggers para log de alterações em tabelas sensíveis
   - Registrar tentativas de acesso negadas
   - Monitorar queries lentas ou suspeitas
   - Criar alertas para padrões anômalos de uso

## Rules and Constraints

### ✅ PERMITIDO

- Usar `supabase.auth.getUser()` para validar usuário autenticado em queries
- Implementar políticas RLS que referenciem `auth.uid()` para isolamento de dados
- Criar Database Functions para lógica complexa que não deve ser exposta no frontend
- Usar `SECURITY DEFINER` em functions administrativas com validação rigorosa de permissões
- Implementar soft delete com RLS para preservar histórico auditável
- Usar `gen_random_uuid()` para IDs primários ao invés de seriais sequenciais

### ❌ PROIBIDO

- Desabilitar RLS mesmo que temporariamente ("vou ativar depois")
- Usar `service_role_key` em código frontend ou aplicativos mobile
- Criar políticas RLS que usam `true` sem validação de usuário
- Implementar lógica de negócio crítica exclusivamente no frontend
- Armazenar senhas, tokens ou chaves em campos de texto plano
- Usar `SELECT *` sem RLS ou sem filtro de `user_id`
- Expor `service_role_key` em variáveis de ambiente de build público (Vercel, Netlify)
- Implementar autenticação customizada sem usar Supabase Auth
- Permitir queries diretas ao banco sem passar por camada de validação

## Validation Checklist

Antes de considerar qualquer funcionalidade relacionada a Supabase como concluída, valide:

- [ ] RLS está ativo em TODAS as tabelas que contêm dados de usuários?
- [ ] Políticas RLS foram testadas com pelo menos 2 usuários diferentes?
- [ ] Há política RLS específica para cada operação (SELECT, INSERT, UPDATE, DELETE)?
- [ ] `auth.uid()` é usado consistentemente para filtrar dados do usuário autenticado?
- [ ] `service_role_key` está armazenado APENAS em variáveis de ambiente servidor?
- [ ] `anon_key` não está hardcoded no código (está em `.env`)?
- [ ] Edge Functions validam autenticação antes de processar requisições?
- [ ] Storage buckets têm RLS ativo com políticas testadas?
- [ ] Há validação de tipo e tamanho de arquivo antes de aceitar uploads?
- [ ] Logs de auditoria registram operações críticas (criação, alteração, exclusão)?
- [ ] Sessões têm tempo de expiração configurado?
- [ ] Não há queries que retornam dados sem filtro de `user_id` ou validação de acesso?
- [ ] Triggers de auditoria estão implementados em tabelas sensíveis (patients, appointments)?