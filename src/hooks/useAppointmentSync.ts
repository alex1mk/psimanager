import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleCalendarService } from '../services/integrations/google-calendar.service';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface AppointmentPayload {
    new: {
        id: string;
        patient_id: string;
        scheduled_date: string;
        scheduled_time: string;
        status: string;
        recurrence_type?: string;
        google_event_id?: string;
    };
    old?: any;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

/**
 * Hook para sincronização em tempo real entre Supabase e Google Calendar
 * 
 * Monitora mudanças na tabela appointments e sincroniza automaticamente
 * com o Google Calendar quando necessário.
 */
export function useAppointmentSync(onUpdate?: () => void) {
    const channelRef = useRef<any>(null);

    const syncWithGoogleCalendar = useCallback(async (payload: AppointmentPayload) => {
        const { new: appointment, eventType } = payload;

        console.log('[Sync] Evento detectado:', eventType, appointment.id);

        try {
            // INSERT: Criar evento no Google Calendar se status = confirmed
            if (eventType === 'INSERT' && appointment.status === 'confirmed' && !appointment.google_event_id) {
                console.log('[Sync] Criando evento no Google Calendar...');

                // Buscar dados completos do paciente
                const { data: appointmentWithPatient } = await supabase
                    .from('appointments')
                    .select('*, patient:patients(name)')
                    .eq('id', appointment.id)
                    .single();

                if (!appointmentWithPatient) {
                    console.error('[Sync] Agendamento não encontrado:', appointment.id);
                    return;
                }

                const result = await GoogleCalendarService.createEvent({
                    patient_name: appointmentWithPatient.patient.name,
                    date: appointment.scheduled_date,
                    time: appointment.scheduled_time,
                    recurrence_type: appointment.recurrence_type as any,
                });

                if (result.success && result.event_id) {
                    // Salvar event_id no banco
                    await supabase
                        .from('appointments')
                        .update({ google_event_id: result.event_id })
                        .eq('id', appointment.id);

                    console.log('[Sync] ✅ Evento criado e ID salvo:', result.event_id);
                } else {
                    console.error('[Sync] ❌ Falha ao criar evento:', result.error);
                }
            }

            // UPDATE: Atualizar evento se mudou data/hora e já tem google_event_id
            if (eventType === 'UPDATE' && appointment.google_event_id) {
                console.log('[Sync] Atualizando evento no Google Calendar...');

                const { data: appointmentWithPatient } = await supabase
                    .from('appointments')
                    .select('*, patient:patients(name)')
                    .eq('id', appointment.id)
                    .single();

                if (!appointmentWithPatient) {
                    console.error('[Sync] Agendamento não encontrado:', appointment.id);
                    return;
                }

                const result = await GoogleCalendarService.updateEvent(
                    appointment.google_event_id,
                    {
                        patient_name: appointmentWithPatient.patient.name,
                        date: appointment.scheduled_date,
                        time: appointment.scheduled_time,
                    }
                );

                if (result.success) {
                    console.log('[Sync] ✅ Evento atualizado:', appointment.google_event_id);
                } else {
                    console.error('[Sync] ❌ Falha ao atualizar evento:', result.error);
                }
            }

            // UPDATE: Cancelar evento se status mudou para cancelled
            if (eventType === 'UPDATE' && appointment.status === 'cancelled' && appointment.google_event_id) {
                console.log('[Sync] Cancelando evento no Google Calendar...');

                const result = await GoogleCalendarService.cancelEvent(appointment.google_event_id);

                if (result.success) {
                    console.log('[Sync] ✅ Evento cancelado:', appointment.google_event_id);
                } else {
                    console.error('[Sync] ❌ Falha ao cancelar evento:', result.error);
                }
            }

            // DELETE: Cancelar evento no Google Calendar
            if (eventType === 'DELETE' && appointment.google_event_id) {
                console.log('[Sync] Removendo evento do Google Calendar...');

                const result = await GoogleCalendarService.cancelEvent(appointment.google_event_id);

                if (result.success) {
                    console.log('[Sync] ✅ Evento removido:', appointment.google_event_id);
                } else {
                    console.error('[Sync] ❌ Falha ao remover evento:', result.error);
                }
            }

            // Notificar componente pai
            if (onUpdate) {
                onUpdate();
            }

        } catch (error) {
            console.error('[Sync] Erro ao sincronizar:', error);
        }
    }, [onUpdate]);

    useEffect(() => {
        console.log('[Sync] Iniciando escuta de mudanças em appointments...');

        // Criar canal de subscription
        const channel = supabase
            .channel('appointments-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments',
                },
                (payload: any) => {
                    console.log('[Sync] Mudança detectada:', payload);
                    syncWithGoogleCalendar(payload);
                }
            )
            .subscribe((status) => {
                console.log('[Sync] Status da subscription:', status);
            });

        channelRef.current = channel;

        // Cleanup
        return () => {
            console.log('[Sync] Removendo subscription...');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [syncWithGoogleCalendar]);

    return null;
}
