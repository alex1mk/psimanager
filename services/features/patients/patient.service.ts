import { BaseService } from '../../core/base.service'
import { Patient, PaymentType } from '../../../types'

export class PatientService extends BaseService {
    constructor() {
        super('patients')
    }

    async getAll(): Promise<Patient[]> {
        await this.ensureAuthenticated()

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .order('name')

        if (error) this.handleError(error)

        return data.map(this.mapToEntity)
    }

    async create(patient: Patient): Promise<Patient> {
        await this.ensureAuthenticated()

        const dbPaymentType = this.normalizePaymentType(patient.paymentType);

        // Validação
        if (!['Sessão', 'Quinzenal', 'Mensal'].includes(dbPaymentType)) {
            throw new Error(`Tipo de pagamento inválido: ${patient.paymentType}`);
        }

        console.log('[Patient Create]', {
            original: patient.paymentType,
            normalized: dbPaymentType
        });

        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert({
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                payment_type: dbPaymentType,
                fixed_day: patient.fixedDay,
                fixed_time: patient.fixedTime,
                status: patient.status
            })
            .select()
            .single()

        if (error) {
            console.error('[Patient Create Error]', {
                code: error.code,
                message: error.message,
                patient: patient.name,
                paymentType: dbPaymentType
            });
            this.handleError(error);
        }

        return this.mapToEntity(data)
    }


    async update(patient: Patient): Promise<Patient> {
        await this.ensureAuthenticated()

        const dbPaymentType = this.normalizePaymentType(patient.paymentType);

        // Validação
        if (!['Sessão', 'Quinzenal', 'Mensal'].includes(dbPaymentType)) {
            throw new Error(`Tipo de pagamento inválido: ${patient.paymentType}`);
        }

        console.log('[Patient Update]', {
            original: patient.paymentType,
            normalized: dbPaymentType
        });

        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                payment_type: dbPaymentType,
                fixed_day: patient.fixedDay,
                fixed_time: patient.fixedTime,
                status: patient.status
            })
            .eq('id', patient.id)
            .select()
            .single()

        if (error) {
            console.error('[Patient Update Error]', {
                code: error.code,
                message: error.message,
                patient: patient.name,
                paymentType: dbPaymentType
            });
            this.handleError(error);
        }

        return this.mapToEntity(data)
    }


    async delete(id: string): Promise<void> {
        await this.ensureAuthenticated()

        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)

        if (error) this.handleError(error)
    }

    private normalizePaymentType(input: string | undefined): string {
        if (!input) return 'Sessão';

        const normalized = input.trim().toLowerCase();

        const mapping: Record<string, string> = {
            'sessao': 'Sessão',
            'sessão': 'Sessão',
            'por sessao': 'Sessão',
            'por sessão': 'Sessão',
            'quinzenal': 'Quinzenal',
            'mensal': 'Mensal',
            'mes': 'Mensal',
            'mês': 'Mensal'
        };

        return mapping[normalized] || 'Sessão';
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
