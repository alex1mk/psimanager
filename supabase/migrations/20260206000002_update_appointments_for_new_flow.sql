-- ========================================
-- Migration: Update appointments table for new scheduling flow
-- Date: 2026-02-06
-- Purpose: Add Google Calendar integration and recurrence support
-- ========================================

-- Add new columns for enhanced scheduling
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_event_id text,
ADD COLUMN IF NOT EXISTS recurrence_type text CHECK (recurrence_type IN ('single', 'weekly', 'biweekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- Update status constraint to support new workflow
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'cancelled'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON public.appointments(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON public.appointments(google_event_id);

-- Documentation comments
COMMENT ON COLUMN public.appointments.google_event_id IS 'ID do evento no Google Calendar';
COMMENT ON COLUMN public.appointments.recurrence_type IS 'Tipo de recorrência: single, weekly, biweekly, monthly';
COMMENT ON COLUMN public.appointments.recurrence_end_date IS 'Data final da recorrência (null = infinito ou até cancelar)';
