# ⚠️ AMBIENTE DE DESENVOLVIMENTO — PSI MANAGER

> **Regra de Ouro:** Este projeto é 100% Cloud-Native. O ambiente local (Windows/PowerShell) deve ser usado apenas para sincronização inicial.

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
| Deploy Edge Functions | `supabase functions deploy` | Antigravity Terminal |
| Edição de Código | Editor Web | Antigravity ou GitHub Codespaces |

---

## ❌ PROIBIDO (Causa conflitos graves)

| Ação Proibida | Motivo |
|---------------|--------|
| Desenvolver em `F:\Trabalho\Projetosativos\psimanager` | Conflitos PowerShell vs Bash e dependências Deno/Postgres |
| Rodar comandos no PowerShell nativo | Sintaxe incompatível e quebra de scripts |
| Executar Edge Functions localmente | Deno não instalado; funções rodam APENAS no Supabase Cloud |
| Instalar Postgres local | Conflito com banco Supabase remoto |

---

## 🚀 Fluxo de Deploy

### 1. Frontend (Vercel)
- `git add .` + `git commit`
- `git push origin main`
- Vercel faz o build e deploy automático.

### 2. Edge Functions (Supabase)
- `supabase functions deploy <function-name> --no-verify-jwt`
- Use o log de deploy no Antigravity para confirmar sucesso.

---

## 📋 Checklist de Validação do Ambiente

- [ ] Estou no **Antigravity Terminal**
- [ ] O repositório está clonado em `~/projects/psimanager`
- [ ] Arquivo `.env` possui as variáveis necessárias
- [ ] `npm run build` executa sem erros

---

## 🆘 Em caso de necessidade absoluta de edição local
1. Usar **GitHub Codespaces** (Cloud VS Code)
2. Usar **WSL2** (Linux no Windows) - NUNCA PowerShell puro.

---

*Este documento certifica a migração para soberania Cloud-Native em 2026-02-06.*
