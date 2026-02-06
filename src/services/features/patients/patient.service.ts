import { BaseService } from '../../core/base.service'
import { Patient, PaymentType } from '../../../types'

export class PatientService extends BaseService {
    constructor() {
        super('patients')
    }

    async getAll(): Promise<Patient[]> {
        const user = await this.ensureAuthenticated()

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('user_id', user.id) // ✅ FILTRAR POR USER_ID
            .order('name')

        if (error) this.handleError(error)

        return data.map(this.mapToEntity)
    }

    async create(patient: Patient): Promise<Patient> {
        await this.ensureAuthenticated()

        // Pegar user_id do usuário autenticado
        const { data: { user } } = await this.supabase.auth.getUser()
        if (!user) throw new Error('Usuário não autenticado')

        // Normalizar antes de inserir
        const dbPaymentType = this.normalizePaymentType(patient.paymentType);

        // Validação pré-insert
        if (!['Sessão', 'Quinzenal', 'Mensal'].includes(dbPaymentType)) {
            const error = `Tipo de pagamento inválido: "${patient.paymentType}" → "${dbPaymentType}"`;
            console.error('[Patient Create]', error, 'Patient:', patient.name);
            throw new Error(error);
        }

        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert({
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                payment_type: dbPaymentType,
                fixed_day: patient.fixedDay,
                fixed_time: patient.fixedTime,
                user_id: user.id,
            })
            .select()
            .single()

        if (error) {
            console.error('[DB Error] Details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
                patient: patient.name,
                attempted_payment_type: dbPaymentType
            });
            this.handleError(error);
        }

        return this.mapToEntity(data)
    }


    async update(patient: Patient): Promise<Patient> {
        const user = await this.ensureAuthenticated()

        const dbPaymentType = this.normalizePaymentType(patient.paymentType);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                payment_type: dbPaymentType,
                fixed_day: patient.fixedDay,
                fixed_time: patient.fixedTime,
                status: patient.status,
                user_id: user.id,
            })
            .eq('id', patient.id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            console.error('[Patient Update Error]', {
                code: error.code,
                message: error.message,
                patient: patient.name,
                userId: user.id,
                attempted_payment_type: dbPaymentType
            });
            this.handleError(error);
        }

        return this.mapToEntity(data)
    }


    async delete(id: string): Promise<void> {
        const user = await this.ensureAuthenticated()

        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)
            .eq('user_id', user.id) // ✅ SEGURANÇA NO DELETE

        if (error) this.handleError(error)
    }

    /**
     * Normaliza tipo de pagamento para match com constraint do DB
     * Aceita variações: "Sessão", "Por Sessão", "Sessao", etc.
     */
    private normalizePaymentType(input: string | undefined): string {
        if (!input) return 'Sessão'; // Default seguro

        const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');

        // Mapeamento flexível
        const mapping: Record<string, string> = {
            'sessao': 'Sessão',
            'sessão': 'Sessão',
            'por sessao': 'Sessão',
            'por sessão': 'Sessão',
            'quinzenal': 'Quinzenal',
            'biweekly': 'Quinzenal',
            'mensal': 'Mensal',
            'monthly': 'Mensal',
            'mes': 'Mensal',
            'mês': 'Mensal'
        };

        const result = mapping[normalized] || 'Sessão';
        console.log(`[PaymentType] Normalizando "${input}" → "${result}"`);
        return result;
    }

    private mapToEntity(p: any): Patient {
        return {
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone || '',
            paymentType: p.payment_type as PaymentType,
            fixedDay: p.fixed_day || '',
            fixedTime: p.fixed_time || '',
            status: p.status as 'active' | 'inactive'
        }
    }
}

export const patientService = new PatientService()
