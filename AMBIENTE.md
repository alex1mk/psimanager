# ⚠️ AMBIENTE DE DESENVOLVIMENTO (PSI MANAGER)

## ✅ CORRETO: Antigravity (Google Cloud)
- **Desenvolvimento:** Terminal Antigravity (Bash/Linux).
- **Build & Dev:** `npm run dev`.
- **Deploy:** `git push` -> Deploy automático via Vercel.

## ❌ INCORRETO: Windows Local (F:\)
- **NÃO** desenvolver localmente via PowerShell.
- **NÃO** rodar comandos de infraestrutura diretamente no Windows.
- **MOTIVO:** Conflitos de runtime (PowerShell vs Bash), ausência de Deno nativo e Postgres local.

## 🚀 Fluxo de Deploy
1. Realize as alterações no Antigravity.
2. Commit e Push para o GitHub.
3. A Vercel detectará o push e atualizará o Frontend.
4. Edge Functions devem ser deployadas via Supabase CLI no ambiente Cloud.

---
*Este documento é normativo e deve ser seguido para garantir a estabilidade do projeto.*
