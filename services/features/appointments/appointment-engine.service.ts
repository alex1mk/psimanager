// ─── MOTOR CENTRAL DE AGENDAMENTO ───────────────────────────────────────────
// Purpose: Centralizes all scheduling logic (validation, creation, confirmation)
// Created: 2026-02-06
// ────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../../src/lib/supabase';

export interface AppointmentData {
    patient_id: string;
    scheduled_date: string; // YYYY-MM-DD
    scheduled_time: string; // HH:MM
    recurrence_type: 'single' | 'weekly' | 'biweekly' | 'monthly';
    recurrence_end_date?: string;
    notes?: string;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    conflicts?: Array<{
        date: string;
        time: string;
        patient_name: string;
    }>;
}

export interface ConfirmationToken {
    token: string;
    expires_at: string;
    link: string;
}

/**
 * Motor Central de Agendamento
 * Responsável por toda lógica de validação, criação e confirmação
 */
export class AppointmentEngine {

    /**
     * VALIDAÇÃO: Verifica disponibilidade de horário
     */
    static async validateAvailability(
        date: string,
        time: string,
        excludeAppointmentId?: string
    ): Promise<ValidationResult> {
        try {
            let query = supabase
                .from('appointments')
                .select(`
          id,
          scheduled_date,
          scheduled_time,
          patient:patients(name)
        `)
                .eq('scheduled_date', date)
                .eq('scheduled_time', time)
                .neq('status', 'cancelled');

            if (excludeAppointmentId) {
                query = query.neq('id', excludeAppointmentId);
            }

            const { data: conflicts, error } = await query;

            if (error) throw error;

            if (conflicts && conflicts.length > 0) {
                return {
                    valid: false,
                    error: 'Horário já possui agendamento',
                    conflicts: conflicts.map(c => ({
                        date: c.scheduled_date,
                        time: c.scheduled_time,
                        patient_name: (c.patient as any)?.name || 'Paciente desconhecido'
                    }))
                };
            }

            return { valid: true };

        } catch (error) {
            console.error('[AppointmentEngine] Erro ao validar disponibilidade:', error);
            return {
                valid: false,
                error: 'Erro ao validar disponibilidade'
            };
        }
    }

    /**
     * CRIAÇÃO: Cria agendamento com validação
     */
    static async createAppointment(
        data: AppointmentData,
        status: 'draft' | 'pending_confirmation' | 'confirmed' = 'draft'
    ): Promise<{ success: boolean; appointment?: any; error?: string }> {
        try {
            // 0. Pegar user_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Validar disponibilidade
            const validation = await this.validateAvailability(
                data.scheduled_date,
                data.scheduled_time
            );

            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                };
            }

            // 2. Criar agendamento
            const { data: appointment, error } = await supabase
                .from('appointments')
                .insert({
                    patient_id: data.patient_id,
                    scheduled_date: data.scheduled_date,
                    scheduled_time: data.scheduled_time,
                    status: status,
                    source: 'internal',
                    recurrence_type: data.recurrence_type,
                    recurrence_end_date: data.recurrence_end_date,
                    notes: data.notes,
                    user_id: user.id
                })
                .select(`
          *,
          patient:patients(*)
        `)
                .single();

            if (error) throw error;

            console.log('[AppointmentEngine] ✅ Agendamento criado:', appointment.id);

            return {
                success: true,
                appointment,
            };

        } catch (error) {
            console.error('[AppointmentEngine] ❌ Erro ao criar agendamento:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    }

    /**
     * CONFIRMAÇÃO: Confirma agendamento via token
     */
    static async confirmAppointment(
        token: string
    ): Promise<{ success: boolean; appointment?: any; error?: string }> {
        try {
            // 1. Validar token
            const { data: tokenData, error: tokenError } = await supabase
                .from('confirmation_tokens')
                .select('*')
                .eq('token', token)
                .single();

            if (tokenError || !tokenData) {
                return {
                    success: false,
                    error: 'Token inválido',
                };
            }

            // 2. Verificar expiração
            if (new Date(tokenData.expires_at) < new Date()) {
                return {
                    success: false,
                    error: 'Token expirado',
                };
            }

            // 3. Verificar se já foi usado
            if (tokenData.used_at) {
                return {
                    success: false,
                    error: 'Token já utilizado',
                };
            }

            // 4. Buscar agendamento
            const { data: appointment, error: appError } = await supabase
                .from('appointments')
                .select(`
          *,
          patient:patients(*)
        `)
                .eq('id', tokenData.appointment_id)
                .single();

            if (appError || !appointment) {
                return {
                    success: false,
                    error: 'Agendamento não encontrado',
                };
            }

            // 5. Validar disponibilidade (caso tenha sido preenchido manualmente)
            const validation = await this.validateAvailability(
                appointment.scheduled_date,
                appointment.scheduled_time,
                appointment.id
            );

            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                };
            }

            // 6. Confirmar agendamento
            const { error: updateError } = await supabase
                .from('appointments')
                .update({ status: 'confirmed' })
                .eq('id', appointment.id);

            if (updateError) throw updateError;

            // 7. Marcar token como usado
            await supabase
                .from('confirmation_tokens')
                .update({ used_at: new Date().toISOString() })
                .eq('token', token);

            console.log('[AppointmentEngine] ✅ Agendamento confirmado:', appointment.id);

            return {
                success: true,
                appointment,
            };

        } catch (error) {
            console.error('[AppointmentEngine] ❌ Erro ao confirmar agendamento:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    }

    /**
     * GERAÇÃO DE TOKEN: Cria link de confirmação
     */
    static async generateConfirmationToken(
        appointmentId: string
    ): Promise<{ success: boolean; tokenData?: ConfirmationToken; error?: string }> {
        try {
            // 1. Gerar token único
            const token = crypto.randomUUID();

            // 2. Calcular expiração (24h)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            // 3. Salvar no banco
            const { error } = await supabase
                .from('confirmation_tokens')
                .insert({
                    appointment_id: appointmentId,
                    token: token,
                    expires_at: expiresAt.toISOString(),
                });

            if (error) throw error;

            // 4. Gerar link (Vercel Portal)
            const appUrl = "https://psimanager-bay.vercel.app";
            const link = `${appUrl}/confirmar?token=${token}`;

            console.log('[AppointmentEngine] ✅ Token gerado:', token);

            return {
                success: true,
                tokenData: {
                    token,
                    expires_at: expiresAt.toISOString(),
                    link,
                },
            };

        } catch (error) {
            console.error('[AppointmentEngine] ❌ Erro ao gerar token:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    }

    /**
     * CANCELAMENTO: Cancela agendamento
     */
    static async cancelAppointment(
        appointmentId: string,
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('appointments')
                .update({
                    status: 'cancelled',
                    notes: reason ? `Cancelado: ${reason}` : undefined
                })
                .eq('id', appointmentId);

            if (error) throw error;

            console.log('[AppointmentEngine] ✅ Agendamento cancelado:', appointmentId);

            return { success: true };

        } catch (error) {
            console.error('[AppointmentEngine] ❌ Erro ao cancelar agendamento:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    }
}
