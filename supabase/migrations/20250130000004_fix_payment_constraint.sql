-- Fix payment_type check constraint to match PT-BR application values
ALTER TABLE public.patients 
DROP CONSTRAINT IF EXISTS patients_payment_type_check;

ALTER TABLE public.patients
ADD CONSTRAINT patients_payment_type_check 
CHECK (payment_type IN ('Sessão', 'Quinzenal', 'Mensal'));
