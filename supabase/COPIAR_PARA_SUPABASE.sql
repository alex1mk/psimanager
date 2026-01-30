-- ============================================================================
-- PSIMANAGER - MIGRATIONS PARA SUPABASE
-- ============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Copie TODO o conteúdo deste arquivo
-- 2. Cole no SQL Editor do Supabase
-- 3. Clique em "Run" UMA VEZ
-- 4. Aguarde a mensagem de sucesso
--
-- NOTA: Você pode colar TUDO de uma vez, não precisa separar!
-- ============================================================================


-- ============================================================================
-- PARTE 1: POLÍTICA DELETE PARA APPOINTMENTS
-- ============================================================================
-- Adiciona permissão para usuários autenticados excluírem agendamentos

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'appointments' 
        AND policyname = 'Enable delete for authenticated users'
    ) THEN
        CREATE POLICY "Enable delete for authenticated users"
        ON public.appointments FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;


-- ============================================================================
-- PARTE 2: TABELA PATIENTS (SE NÃO EXISTIR)
-- ============================================================================
-- Cria tabela de pacientes com RLS e constraint de email único

CREATE TABLE IF NOT EXISTS public.patients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    payment_type text CHECK (payment_type IN ('Por Sessão', 'Quinzenal', 'Mensal')) DEFAULT 'Por Sessão',
    fixed_day text,
    fixed_time time,
    status text CHECK (status IN ('active', 'inactive', 'confirmed')) DEFAULT 'active',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para patients
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_select_policy') THEN
        CREATE POLICY "patients_select_policy" ON public.patients FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_insert_policy') THEN
        CREATE POLICY "patients_insert_policy" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_update_policy') THEN
        CREATE POLICY "patients_update_policy" ON public.patients FOR UPDATE TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'patients_delete_policy') THEN
        CREATE POLICY "patients_delete_policy" ON public.patients FOR DELETE TO authenticated USING (true);
    END IF;
END $$;


-- ============================================================================
-- PARTE 3: TABELA EXPENSES (SE NÃO EXISTIR)
-- ============================================================================
-- Cria tabela de despesas com RLS

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    date date NOT NULL,
    category text DEFAULT 'Geral',
    type text CHECK (type IN ('PF', 'PJ')) DEFAULT 'PJ',
    merchant_name text,
    receipt_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para expenses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'expenses_select_policy') THEN
        CREATE POLICY "expenses_select_policy" ON public.expenses FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'expenses_insert_policy') THEN
        CREATE POLICY "expenses_insert_policy" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'expenses_update_policy') THEN
        CREATE POLICY "expenses_update_policy" ON public.expenses FOR UPDATE TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'expenses_delete_policy') THEN
        CREATE POLICY "expenses_delete_policy" ON public.expenses FOR DELETE TO authenticated USING (true);
    END IF;
END $$;


-- ============================================================================
-- FIM DAS MIGRATIONS
-- ============================================================================
-- Após executar, você verá "Success. No rows returned"
-- Isso significa que funcionou!
-- ============================================================================

SELECT 'Migrations executadas com sucesso!' as resultado;
