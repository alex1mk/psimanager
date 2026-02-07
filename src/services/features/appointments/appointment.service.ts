import { BaseService } from "../../core/base.service";
import { Appointment } from "../../../types";

export class AppointmentService extends BaseService {
    constructor() {
        super('appointments');
    }

    async getAll(): Promise<Appointment[]> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                patients (name)
            `)
            .eq('user_id', user.id)
            .order('scheduled_date', { ascending: true });

        if (error) this.handleError(error);

        return data.map(a => ({
            id: a.id,
            patientId: a.patient_id,
            patientName: a.patients?.name || 'Paciente não encontrado',
            date: a.scheduled_date,
            time: a.scheduled_time,
            status: a.status as 'scheduled' | 'confirmed' | 'completed' | 'cancelled',
            notes: a.notes,
            source: a.source as 'internal' | 'google',
            googleId: a.google_id
        }));
    }

    async create(appointment: Appointment): Promise<Appointment> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert({
                patient_id: appointment.patientId,
                scheduled_date: appointment.date,
                scheduled_time: appointment.time,
                status: appointment.status,
                notes: appointment.notes,
                source: appointment.source || 'internal',
                google_id: appointment.googleId,
                user_id: user.id
            })
            .select(`
                *,
                patients (name)
            `)
            .single();

        if (error) this.handleError(error);

        // Trigger confirmation email if status is pending_confirmation
        if (data.status === 'pending_confirmation') {
            // Fire and forget - don't block the UI for email sending
            this.sendConfirmationEmail(data.id);
        }

        return {
            id: data.id,
            patientId: data.patient_id,
            patientName: data.patients?.name || appointment.patientName,
            date: data.scheduled_date,
            time: data.scheduled_time,
            status: data.status,
            notes: data.notes,
            source: data.source,
            googleId: data.google_id
        };
    }

    /**
     * Trigger the confirmation email for a specific appointment
     * This is separated to allow retries if needed
     */
    async sendConfirmationEmail(appointmentId: string): Promise<void> {
        const { error } = await this.supabase.functions.invoke('send-confirmation-email', {
            body: { appointment_id: appointmentId }
        });

        if (error) {
            console.error('Failed to trigger confirmation email:', error);
            // We don't throw here to avoid blocking UI, but we log it
        }
    }

    async update(appointment: Appointment): Promise<Appointment> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
                patient_id: appointment.patientId,
                scheduled_date: appointment.date,
                scheduled_time: appointment.time,
                status: appointment.status,
                notes: appointment.notes,
                source: appointment.source,
                google_id: appointment.googleId,
                user_id: user.id
            })
            .eq('id', appointment.id)
            .eq('user_id', user.id)
            .select(`
                *,
                patients (name)
            `)
            .single();

        if (error) this.handleError(error);

        return {
            id: data.id,
            patientId: data.patient_id,
            patientName: data.patients?.name || appointment.patientName,
            date: data.scheduled_date,
            time: data.scheduled_time,
            status: data.status,
            notes: data.notes,
            source: data.source,
            googleId: data.google_id
        };
    }

    async delete(id: string): Promise<void> {
        const user = await this.ensureAuthenticated();

        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) this.handleError(error);
    }
}

export const appointmentService = new AppointmentService();
