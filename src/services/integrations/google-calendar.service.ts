/**
 * Google Calendar Integration Service
 * 
 * RESPONSABILIDADES:
 * - Interface unificada para operações no Google Calendar via Edge Functions.
 * - Tratamento de estados de carregamento e erros para a UI.
 * - Suporte a eventos recorrentes e únicos.
 * 
 * PADRÕES SENIOR:
 * - Singleton pattern (via static methods).
 * - Tipagem rigorosa para payloads.
 * - Logs estruturados com prefixos para debug facilitado.
 */

interface CalendarEvent {
    patient_name: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    recurrence_type?: 'single' | 'weekly' | 'biweekly' | 'monthly';
    recurrence_end_date?: string;
    notes?: string;
}

interface CalendarResult {
    success: boolean;
    event_id?: string;
    error?: string;
    details?: {
        link?: string;
        start?: any;
        end?: any;
        recurrence?: string[];
    };
}

export class GoogleCalendarService {

    private static readonly API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    private static readonly HEADERS = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
    };

    /**
     * Cria evento no Google Calendar
     * Suporta eventos únicos e recorrentes
     */
    static async createEvent(event: CalendarEvent): Promise<CalendarResult> {
        try {
            console.log(`[GoogleCalendarService] 🛰️ Solicitando criação de evento: ${event.patient_name}`);

            const response = await fetch(`${this.API_URL}/google-calendar-create`, {
                method: 'POST',
                headers: this.HEADERS,
                body: JSON.stringify(event),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.error || `HTTP ${response.status}: Falha na criação do evento`;
                throw new Error(errorMsg);
            }

            console.log(`[GoogleCalendarService] ✅ Sucesso: Evento ${data.event_id} criado.`);

            return {
                success: true,
                event_id: data.event_id,
                details: data.details,
            };

        } catch (error) {
            console.error('[GoogleCalendarService] ❌ Falha crítica no createEvent:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro interno inesperado na integração com Google',
            };
        }
    }

    /**
     * Atualiza evento existente
     */
    static async updateEvent(
        event_id: string,
        updates: Partial<CalendarEvent>
    ): Promise<CalendarResult> {
        try {
            console.log(`[GoogleCalendarService] 🔄 Atualizando evento: ${event_id}`);

            const response = await fetch(`${this.API_URL}/google-calendar-update`, {
                method: 'POST',
                headers: this.HEADERS,
                body: JSON.stringify({ event_id, updates }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao atualizar evento no Google Calendar');
            }

            return {
                success: true,
                event_id: data.event_id,
            };

        } catch (error) {
            console.error('[GoogleCalendarService] ❌ Erro no updateEvent:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao atualizar agendamento no Google',
            };
        }
    }

    /**
     * Cancela evento (soft delete/remove)
     */
    static async cancelEvent(event_id: string): Promise<CalendarResult> {
        try {
            console.log(`[GoogleCalendarService] 🗑️ Cancelando evento: ${event_id}`);

            const response = await fetch(`${this.API_URL}/google-calendar-cancel`, {
                method: 'POST',
                headers: this.HEADERS,
                body: JSON.stringify({ event_id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao cancelar evento no Google Calendar');
            }

            return {
                success: true,
                event_id: data.event_id,
            };

        } catch (error) {
            console.error('[GoogleCalendarService] ❌ Erro no cancelEvent:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao cancelar agendamento no Google',
            };
        }
    }

    /**
     * Verifica integridade da integração (Health Check)
     */
    static async checkConfiguration(): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_URL}/google-calendar-health`, {
                method: 'GET',
                headers: { 'apikey': this.HEADERS.apikey },
            });

            return response.ok;

        } catch (error) {
            console.error('[GoogleCalendarService] ⚠️ Falha no health check do Google Calendar');
            return false;
        }
    }
}
