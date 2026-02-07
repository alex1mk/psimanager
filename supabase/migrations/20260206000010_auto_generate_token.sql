-- ========================================
-- Migration: Auto Generate Confirmation Token
-- Date: 2026-02-07
-- Purpose: Automatically generate a secure confirmation token when an appointment is created
-- ========================================

-- 1. Create Function to Generate Token
CREATE OR REPLACE FUNCTION public.handle_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_token text;
BEGIN
    -- Only generate token if status is 'pending_confirmation'
    IF NEW.status = 'pending_confirmation' THEN
        -- Generate a secure random token (using pgcrypto or simply random md5/uuid for now)
        -- Using uuid + random string for uniqueness and security
        new_token := encode(digest(gen_random_uuid()::text || NEW.id::text || now()::text, 'sha256'), 'hex');

        -- Insert into confirmation_tokens
        INSERT INTO public.confirmation_tokens (
            appointment_id,
            token,
            expires_at
        ) VALUES (
            NEW.id,
            new_token,
            now() + interval '30 days' -- Token valid for 30 days
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;

CREATE TRIGGER on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_appointment();

-- 3. Ensure pgcrypto extension is enabled for digest function
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
