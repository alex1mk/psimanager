# ⚠️ AMBIENTE DE DESENVOLVIMENTO — PSI MANAGER

> **Documento Normativo:** Este arquivo define as regras obrigatórias de ambiente para evitar conflitos de sistema.

---

## 🌐 URLs do Projeto

| Ambiente | URL |
|----------|-----|
| **Produção** | https://psimanager-bay.vercel.app/ |
| **Repositório** | https://github.com/alex1mk/psimanager |
| **Supabase Dashboard** | https://supabase.com/dashboard |

---

## ✅ PERMITIDO (Obrigatório seguir)

| Ação | Ferramenta | Onde Executar |
|------|------------|---------------|
| Desenvolvimento | Terminal Antigravity | Google Cloud (Bash/Linux) |
| Build/Dev Server | `npm run dev` | Antigravity Terminal |
| Deploy Frontend | `git push` | GitHub → Vercel (automático) |
| Deploy Edge Functions | `supabase functions deploy` | Antigravity Terminal ou Supabase Dashboard |
| Edição de Código | Editor Web | Antigravity ou GitHub Codespaces |
| Queries SQL | SQL Editor | Supabase Dashboard |
| Debug | Chrome DevTools | Browser |

---

## ❌ PROIBIDO (Causa conflitos graves)

| Ação Proibida | Motivo |
|---------------|--------|
| Desenvolver em `F:\Trabalho\Projetosativos\psimanager` | Ambiente Windows causa conflitos PowerShell vs Bash |
| Rodar comandos no PowerShell nativo | Sintaxe incompatível com scripts Linux |
| Executar Edge Functions localmente | Deno não está instalado no Windows; funções rodam APENAS no Supabase Cloud |
| Instalar Postgres local | Conflito com Supabase remoto |
| Usar Docker neste projeto | Arquitetura é 100% serverless |
| Misturar ambientes (Cloud + Local) | Gera erros imprevisíveis e quebra de funcionalidades |

---

## 🚀 Fluxo de Deploy

```mermaid
graph LR
    A[Código no Antigravity] --> B[git add + commit]
    B --> C[git push origin main]
    C --> D[Vercel detecta push]
    D --> E[Build automático]
    E --> F[Deploy em Produção]
```

### Frontend (Vercel)
1. Realize alterações no Antigravity Terminal
2. `git add .` + `git commit -m "feat: descrição"`
3. `git push origin main`
4. Vercel detecta o push e faz deploy automático

### Edge Functions (Supabase)
1. Edite o código em `supabase/functions/<nome>/`
2. No Antigravity Terminal: `supabase functions deploy <nome>`
3. Ou via Supabase Dashboard: Functions → Deploy

---

## 📋 Checklist de Validação do Ambiente

Antes de iniciar qualquer desenvolvimento, confirme:

- [ ] Estou no **Antigravity Terminal** (NÃO no PowerShell do Windows)
- [ ] O comando `node -v` retorna versão válida
- [ ] O comando `npm -v` retorna versão válida
- [ ] O repositório está clonado em `~/projects/psimanager`
- [ ] Arquivo `.env` existe com variáveis do Supabase
- [ ] `npm run build` executa sem erros

---

## 🆘 Em Caso de Necessidade Absoluta de Edição Local

Se precisar editar localmente por algum motivo crítico:

1. **Preferido:** Use **GitHub Codespaces** (VS Code cloud-based)
2. **Alternativa:** Use **WSL2** (Windows Subsystem for Linux) — **NÃO** PowerShell nativo
3. **Último recurso:** Configure ambiente Linux completo via WSL2 com Deno + Supabase CLI

---

*Última atualização: 2026-02-06*
*Este documento é normativo e deve ser seguido para garantir a estabilidade do projeto.*
