-- ========================================
-- FUNÇÕES DE LEMBRETE
-- ========================================

-- Função: Encontrar agendamentos que precisam lembrete 24h antes
CREATE OR REPLACE FUNCTION get_appointments_needing_24h_reminder()
RETURNS TABLE (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_email text,
  patient_phone text,
  additional_emails text[],
  additional_phones text[],
  scheduled_date date,
  scheduled_time time,
  reminder_24h_sent boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    p.id AS patient_id,
    p.name AS patient_name,
    p.email AS patient_email,
    p.phone AS patient_phone,
    p.additional_emails,
    p.additional_phones,
    a.scheduled_date,
    a.scheduled_time,
    a.reminder_24h_sent
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  WHERE 
    a.status = 'confirmed'
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' -- Amanhã
    AND (a.reminder_24h_sent IS NULL OR a.reminder_24h_sent = false);
END;
$$;

-- Função: Encontrar agendamentos que precisam lembrete 30min antes
CREATE OR REPLACE FUNCTION get_appointments_needing_30min_reminder()
RETURNS TABLE (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_email text,
  patient_phone text,
  additional_emails text[],
  additional_phones text[],
  scheduled_date date,
  scheduled_time time,
  reminder_30min_sent boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    p.id AS patient_id,
    p.name AS patient_name,
    p.email AS patient_email,
    p.phone AS patient_phone,
    p.additional_emails,
    p.additional_phones,
    a.scheduled_date,
    a.scheduled_time,
    a.reminder_30min_sent
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  WHERE 
    a.status = 'confirmed'
    AND a.scheduled_date = CURRENT_DATE -- Hoje
    AND a.scheduled_time BETWEEN (CURRENT_TIME + INTERVAL '25 minutes') 
                             AND (CURRENT_TIME + INTERVAL '35 minutes')
    AND (a.reminder_30min_sent IS NULL OR a.reminder_30min_sent = false);
END;
$$;

-- Adicionar colunas de controle de envio
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_30min_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_30min_sent_at timestamptz;
