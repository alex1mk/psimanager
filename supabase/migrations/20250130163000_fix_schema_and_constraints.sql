-- Force add date column to expenses if missing
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE;

-- Force fix payment_type constraint on patients
ALTER TABLE public.patients 
DROP CONSTRAINT IF EXISTS patients_payment_type_check;

ALTER TABLE public.patients
ADD CONSTRAINT patients_payment_type_check 
CHECK (payment_type IN ('Sessão', 'Quinzenal', 'Mensal'));

-- Make sure RLS is enabled on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
