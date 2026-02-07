import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl: string = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey: string = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseKey) {
    console.error("[@shared/supabaseClient] ERRO: Variáveis de ambiente do Supabase não configuradas.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
