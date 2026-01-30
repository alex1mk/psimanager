-- Create patients table if it doesn't exist
-- Includes RLS policies for CRUD operations and unique email constraint

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

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (with idempotent creation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.patients FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'Enable insert for authenticated users') THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'Enable update for authenticated users') THEN
        CREATE POLICY "Enable update for authenticated users" ON public.patients FOR UPDATE TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patients' AND policyname = 'Enable delete for authenticated users') THEN
        CREATE POLICY "Enable delete for authenticated users" ON public.patients FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- Unique constraint for deduplication (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'patients_email_unique' AND conrelid = 'public.patients'::regclass
    ) THEN
        ALTER TABLE public.patients ADD CONSTRAINT patients_email_unique UNIQUE (email);
    END IF;
END $$;
