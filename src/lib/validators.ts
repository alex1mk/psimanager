/**
 * Common system validations
 */

// Email
export function isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// CPF
export function isValidCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    // Validação do primeiro dígito
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf.charAt(9))) return false;

    // Validação do segundo dígito
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;

    return digit === parseInt(cpf.charAt(10));
}

// Telefone BR
export function isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    // Aceita: 11 dígitos (cel) ou 10 (fixo)
    return cleaned.length === 11 || cleaned.length === 10;
}

// Valor monetário
export function isValidCurrency(value: string | number): boolean {
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    return !isNaN(num) && num >= 0;
}

/**
 * Formatting masks
 */

export function formatCPF(cpf: string): string {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.substring(0, 11);
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatPhone(phone: string): string {
    phone = phone.replace(/\D/g, '');

    if (phone.length === 11) {
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 10) {
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    return phone;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

export function parseCurrency(value: string): number {
    // Normaliza para o formato JS (ponto como decimal)
    const normalized = value
        .replace(/[^\d,.-]/g, '') // Mantém apenas dígitos, vírgula, ponto e sinal
        .replace(/\./g, '')       // Remove separadores de milhar
        .replace(',', '.');      // Troca vírgula decimal por ponto
    return parseFloat(normalized) || 0;
}
