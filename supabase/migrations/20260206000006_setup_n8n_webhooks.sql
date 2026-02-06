-- Migration: Setup Webhooks for n8n CRM Integration
-- Uses pg_net extension to send async HTTP requests to n8n

-- 1. Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Create Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_n8n_webhook()
RETURNS trigger AS $$
DECLARE
    n8n_url text := 'https://your-n8n-instance.com/webhook/psimanager-events'; -- REPLACE WITH REAL URL
    payload jsonb;
BEGIN
    -- Build Payload
    payload := jsonb_build_object(
        'event', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'data', row_to_json(NEW),
        'timestamp', now()
    );

    -- Send Async Request
    PERFORM net.http_post(
        url := n8n_url,
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Triggers (Idempotent)

-- Trigger for Patients (New Signups / Updates)
DROP TRIGGER IF EXISTS tr_n8n_patients ON public.patients;
CREATE TRIGGER tr_n8n_patients
    AFTER INSERT OR UPDATE ON public.patients
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_n8n_webhook();

-- Trigger for Appointments (Confirmations)
DROP TRIGGER IF EXISTS tr_n8n_appointments ON public.appointments;
CREATE TRIGGER tr_n8n_appointments
    AFTER INSERT OR UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_n8n_webhook();
