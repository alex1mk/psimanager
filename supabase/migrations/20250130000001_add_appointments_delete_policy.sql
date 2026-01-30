-- Add DELETE policy for appointments table
-- This policy allows authenticated users to delete appointments

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
