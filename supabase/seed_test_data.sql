-- ========================================================
-- SETUP COMPLETO E TESTE v2: Fluxo de Confirmação (PsiManager)
-- Este script: 
-- 1. Instala a Função e o Trigger (Se não existirem ou atualiza)
-- 2. Limpa dados de teste anteriores para evitar erros de duplicidade
-- 3. Cria novos dados de teste e verifica o Trigger
-- ========================================================

-- PARTE 1: INSTALAÇÃO DA LÓGICA (Idempotente)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_token text;
BEGIN
    -- Gera token apenas se for agendamento para confirmar
    IF NEW.status = 'pending_confirmation' THEN
        new_token := encode(digest(gen_random_uuid()::text || NEW.id::text || now()::text, 'sha256'), 'hex');
        INSERT INTO public.confirmation_tokens (
            appointment_id,
            token,
            expires_at
        ) VALUES (
            NEW.id,
            new_token,
            now() + interval '7 days'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
CREATE TRIGGER on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_appointment();

-- PARTE 2: LIMPEZA E CRIAÇÃO DE DADOS (Avoid Duplicate Email)
DO $$
DECLARE
    v_patient_id uuid;
    v_appointment_id uuid;
    v_user_id uuid;
    v_test_email text := 'teste.antigravity@exemplo.com';
BEGIN
    -- Pegar o primeiro usuário disponível para ser o "dono" do agendamento
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- Limpar teste anterior para permitir re-execução
    DELETE FROM public.patients WHERE email = v_test_email;

    -- Criar novo Paciente de Teste
    INSERT INTO public.patients (name, email, phone, user_id)
    VALUES ('Paciente Teste Antigravity', v_test_email, '11999999999', v_user_id)
    RETURNING id INTO v_patient_id;

    -- Criar Agendamento (DEVE disparar o trigger configurado na Parte 1)
    INSERT INTO public.appointments (
        patient_id, scheduled_date, scheduled_time, status, user_id, source
    )
    VALUES (
        v_patient_id, CURRENT_DATE + interval '1 day', '10:00', 'pending_confirmation', v_user_id, 'internal'
    )
    RETURNING id INTO v_appointment_id;

    RAISE NOTICE 'Trigger instalado, dados limpos e novo teste criado!';
END $$;

-- PARTE 3: VERIFICAÇÃO FINAL
SELECT 
    a.id as app_id, 
    p.name as patient, 
    t.token, 
    t.expires_at,
    CASE WHEN t.token IS NOT NULL THEN '✅ SUCESSO: Trigger funcionando e Token Gerado!' 
         ELSE '❌ FALHA: Trigger não gerou o token' END as status_final
FROM public.appointments a
JOIN public.patients p ON a.patient_id = p.id
LEFT JOIN public.confirmation_tokens t ON a.id = t.appointment_id
WHERE p.email = 'teste.antigravity@exemplo.com'
ORDER BY a.created_at DESC
LIMIT 1;
