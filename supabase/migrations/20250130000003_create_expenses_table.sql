-- Create expenses table if it doesn't exist
-- Includes RLS policies for CRUD operations

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

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies (with idempotent creation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Enable read access for authenticated users') THEN
        CREATE POLICY "Enable read access for authenticated users" ON public.expenses FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Enable insert for authenticated users') THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Enable update for authenticated users') THEN
        CREATE POLICY "Enable update for authenticated users" ON public.expenses FOR UPDATE TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Enable delete for authenticated users') THEN
        CREATE POLICY "Enable delete for authenticated users" ON public.expenses FOR DELETE TO authenticated USING (true);
    END IF;
END $$;
