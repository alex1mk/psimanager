-- Renomear coluna type para expense_type na tabela expenses
-- Isso evita conflitos com palavras reservadas do SQL e resolve erros de cache do Supabase

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.expenses RENAME COLUMN "type" TO "expense_type";
    END IF;
END $$;
