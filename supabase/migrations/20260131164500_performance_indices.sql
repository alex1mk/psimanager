-- 1. ÍNDICES DE PERFORMANCE
-- Melhora a velocidade do Dashboard e das buscas por paciente

CREATE INDEX IF NOT EXISTS idx_appointments_user_date 
ON public.appointments(user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_appointments_patient 
ON public.appointments(patient_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date 
ON public.expenses(user_id, date);

CREATE INDEX IF NOT EXISTS idx_patients_user_id 
ON public.patients(user_id);


-- 2. AUTOMAÇÃO DE UPDATED_AT
-- Cria uma função para atualizar o campo updated_at automaticamente

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar o gatilho (Trigger) nas tabelas principais
-- (Nota: Supõe-se que as tabelas já tenham a coluna updated_at, se não, adicionamos)

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS tr_patients_updated_at ON public.patients;
CREATE TRIGGER tr_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_apps_updated_at ON public.appointments;
CREATE TRIGGER tr_apps_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_expenses_updated_at ON public.expenses;
CREATE TRIGGER tr_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
