-- ========================================
-- Migration: Create confirmation_tokens table
-- Date: 2026-02-06
-- Purpose: Secure token storage for appointment confirmations
-- ========================================

CREATE TABLE IF NOT EXISTS public.confirmation_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
    token text UNIQUE NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now(),
    
    -- Constraint: expiration must be after creation
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tokens_token ON public.confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_appointment ON public.confirmation_tokens(appointment_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON public.confirmation_tokens(expires_at);

-- Enable RLS (only service role can manipulate)
ALTER TABLE public.confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only access
CREATE POLICY "Service role only"
    ON public.confirmation_tokens
    FOR ALL
    USING (auth.role() = 'service_role');

-- Function to cleanup expired tokens (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.confirmation_tokens
    WHERE expires_at < now() - interval '7 days';
END;
$$;

-- Comment for documentation
COMMENT ON TABLE public.confirmation_tokens IS 'Stores secure HMAC tokens for appointment confirmation links';
COMMENT ON COLUMN public.confirmation_tokens.token IS 'HMAC-SHA256 token generated from patient_id + secret';
COMMENT ON COLUMN public.confirmation_tokens.expires_at IS 'Token expiration timestamp (typically 7 days from creation)';
COMMENT ON COLUMN public.confirmation_tokens.used_at IS 'Timestamp when token was used (null if unused)';
