-- ========================================
-- ADICIONAR CAMPOS DE PAGAMENTO (Idempotent)
-- ========================================

DO $$
BEGIN
    -- 1. Payment Method
    BEGIN
        ALTER TABLE public.patients ADD COLUMN payment_method text;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    -- 2. Payment Due Day
    BEGIN
        ALTER TABLE public.patients ADD COLUMN payment_due_day integer;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    -- 3. Additional Emails
    BEGIN
        ALTER TABLE public.patients ADD COLUMN additional_emails text[];
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    -- 4. Additional Phones
    BEGIN
        ALTER TABLE public.patients ADD COLUMN additional_phones text[];
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Atualizar Constraints de forma segura (Drop & Add)
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_payment_method_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_payment_method_check CHECK (payment_method IN ('card', 'pix', 'cash'));

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_payment_due_day_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_payment_due_day_check CHECK (payment_due_day IN (5, 20));

-- Comentários (sempre seguro re-executar)
COMMENT ON COLUMN public.patients.payment_method IS 'Forma de pagamento preferida: card (cartão), pix, cash (dinheiro)';
COMMENT ON COLUMN public.patients.payment_due_day IS 'Dia de vencimento do pagamento: 5 ou 20';
COMMENT ON COLUMN public.patients.additional_emails IS 'Emails adicionais para envio de confirmações';
COMMENT ON COLUMN public.patients.additional_phones IS 'Telefones adicionais para envio de confirmações';

-- Índices (IF NOT EXISTS já suportado)
CREATE INDEX IF NOT EXISTS idx_patients_payment_due_day ON public.patients(payment_due_day);
