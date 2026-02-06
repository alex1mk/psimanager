-- ========================================
-- CONFIGURAR CRON JOBS
-- ========================================

-- Habilitar extensão pg_cron (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Enviar lembretes 24h antes (todos os dias às 9h)
SELECT cron.schedule(
  'send-24h-reminders',
  '0 9 * * *', -- Todo dia às 9h
  $$
  SELECT net.http_post(
    url := 'https://[SEU-PROJETO].supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"type": "24h"}'::jsonb
  );
  $$
);

-- Job 2: Enviar lembretes 30min antes (a cada 10 minutos durante horário comercial)
SELECT cron.schedule(
  'send-30min-reminders',
  '*/10 8-20 * * *', -- A cada 10min das 8h às 20h
  $$
  SELECT net.http_post(
    url := 'https://[SEU-PROJETO].supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"type": "30min"}'::jsonb
  );
  $$
);

-- Verificar jobs criados:
SELECT * FROM cron.job;
