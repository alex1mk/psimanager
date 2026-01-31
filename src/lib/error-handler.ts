interface SupabaseError {
    code: string;
    message: string;
    details?: string;
    hint?: string;
}

interface UserFriendlyError {
    title: string;
    message: string;
    action?: string;
}

/**
 * Converte erros técnicos do Supabase em mensagens amigáveis
 */
export function parseSupabaseError(error: SupabaseError): UserFriendlyError {
    // Erros de constraint
    if (error.code === '23505') {
        // Duplicate key
        if (error.message.includes('patients_email_key') || error.message.includes('patients_email_unique')) {
            return {
                title: 'Email já cadastrado',
                message: 'Já existe um paciente com este endereço de email.',
                action: 'Tente outro email ou edite o paciente existente.'
            };
        }

        return {
            title: 'Registro duplicado',
            message: 'Este registro já existe no sistema.',
            action: 'Verifique os dados e tente novamente.'
        };
    }

    if (error.code === '23503') {
        // Foreign key violation
        return {
            title: 'Registros relacionados',
            message: 'Não é possível excluir este registro pois existem outros dados vinculados a ele.',
            action: 'Exclua primeiro os registros relacionados.'
        };
    }

    if (error.code === '23514') {
        // Check constraint violation
        const match = error.message.match(/violates check constraint "(.+)"/);
        const constraint = match ? match[1] : '';

        if (constraint.includes('payment_type')) {
            return {
                title: 'Tipo de pagamento inválido',
                message: 'O tipo de pagamento deve ser: Sessão, Quinzenal ou Mensal.',
                action: 'Verifique a planilha de importação.'
            };
        }

        return {
            title: 'Dados inválidos',
            message: error.message,
            action: 'Verifique os dados e tente novamente.'
        };
    }

    // Erros de autenticação
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
        return {
            title: 'Sessão expirada',
            message: 'Sua sessão expirou.',
            action: 'Faça login novamente.'
        };
    }

    // Erro genérico
    return {
        title: 'Erro ao processar',
        message: error.message || 'Ocorreu um erro inesperado.',
        action: 'Tente novamente. Se o problema persistir, entre em contato com o suporte.'
    };
}

/**
 * Exibe toast de erro
 */
export function showErrorToast(error: SupabaseError | Error | string) {
    let parsedError: UserFriendlyError;

    if (typeof error === 'string') {
        parsedError = {
            title: 'Erro',
            message: error
        };
    } else if (error && typeof error === 'object' && 'code' in error) {
        parsedError = parseSupabaseError(error as SupabaseError);
    } else {
        parsedError = {
            title: 'Erro inesperado',
            message: (error as Error).message || 'Erro desconhecido'
        };
    }

    // Integrar com alert do sistema (ou toast library se disponível)
    console.error('[Error Handler]', parsedError);

    // Mensagem consolidada para o alert
    const fullMessage = [
        parsedError.title,
        '',
        parsedError.message,
        parsedError.action ? `\nSugestão: ${parsedError.action}` : ''
    ].join('\n');

    alert(fullMessage);
}
