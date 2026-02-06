#!/bin/bash

echo "🧹 Iniciando limpeza de código Twilio/WhatsApp..."

# 1. Remover arquivos de serviço
echo "Removendo arquivos de serviço..."
rm -f services/twilio.ts
rm -f services/whatsapp.ts
rm -f services/sms.ts

# 2. Remover Edge Functions relacionadas
echo "Removendo Edge Functions obsoletas..."
rm -rf supabase/functions/send-whatsapp
rm -rf supabase/functions/twilio-webhook

# 3. Buscar e listar referências restantes
echo "🔍 Buscando referências a Twilio no código..."
grep -r "TWILIO" . --exclude-dir=node_modules --exclude-dir=.git || echo "✅ Nenhuma referência a TWILIO encontrada"
grep -r "twilio" . --exclude-dir=node_modules --exclude-dir=.git || echo "✅ Nenhuma referência a twilio encontrada"
grep -r "whatsapp" . --exclude-dir=node_modules --exclude-dir=.git || echo "⚠️ Verificar referências a whatsapp"

echo "✅ Limpeza concluída!"
