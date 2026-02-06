-- Migration: Add user_id and enforce Multi-tenancy RLS
-- Target Tables: patients, appointments, expenses

-- 1. ADD COLUMNS
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. REFACTOR RLS POLICIES (PATIENTS)
-- 2. REFACTOR RLS POLICIES (PATIENTS)
-- Drop old policies (cleaning up legacy)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.patients;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.patients;

-- Drop new policies (idempotency check)
DROP POLICY IF EXISTS "Users can only see their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can only insert their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can only update their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can only delete their own patients" ON public.patients;

CREATE POLICY "Users can only see their own patients" ON public.patients
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own patients" ON public.patients
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own patients" ON public.patients
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own patients" ON public.patients
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. REFACTOR RLS POLICIES (APPOINTMENTS)
-- Drop old policies (cleaning up legacy)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.appointments;
DROP POLICY IF EXISTS "Enable insert for authenticated users and service role" ON public.appointments;
DROP POLICY IF EXISTS "Enable update for authenticated users and service role" ON public.appointments;

-- Drop new policies (idempotency check)
DROP POLICY IF EXISTS "Users can only see their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can only insert their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can only update their own appointments" ON public.appointments;

CREATE POLICY "Users can only see their own appointments" ON public.appointments
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own appointments" ON public.appointments
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own appointments" ON public.appointments
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. REFACTOR RLS POLICIES (EXPENSES)
-- Drop old policies (cleaning up legacy)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.expenses;

-- Drop new policies (idempotency check)
DROP POLICY IF EXISTS "Users can only see their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can only insert their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can only update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can only delete their own expenses" ON public.expenses;

CREATE POLICY "Users can only see their own expenses" ON public.expenses
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own expenses" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own expenses" ON public.expenses
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own expenses" ON public.expenses
FOR DELETE TO authenticated USING (auth.uid() = user_id);
