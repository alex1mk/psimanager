import { supabase } from '../src/lib/supabase'
import { Patient, Appointment, Expense, PaymentType, ExpenseType } from '../types'
import moment from 'moment'

// ========================================
// AUTHENTICATION HELPER
// ========================================

const ensureAuthenticated = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Autenticação necessária. Faça login novamente.')
    return user
}

// ========================================
// AUTHENTICATION
// ========================================

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) throw error
    return data.user
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export const onAuthStateChange = (callback: (user: any) => void) => {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user ?? null)
    })
}

// ========================================
// PATIENTS CRUD
// ========================================

import { patientService } from './features/patients/patient.service'

export const getPatients = async (): Promise<Patient[]> => {
    return patientService.getAll()
}

export const createPatient = async (patient: Patient): Promise<Patient> => {
    return patientService.create(patient)
}

export const updatePatient = async (patient: Patient): Promise<Patient> => {
    return patientService.update(patient)
}

export const deletePatient = async (id: string): Promise<void> => {
    return patientService.delete(id)
}

// ========================================
// APPOINTMENTS CRUD
// ========================================

export const getAppointments = async (): Promise<Appointment[]> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('appointments')
        .select(`
      *,
      patients (name)
    `)
        .order('scheduled_date', { ascending: true })

    if (error) throw error

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
    }))
}

export const createAppointment = async (appointment: Appointment): Promise<Appointment> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('appointments')
        .insert({
            patient_id: appointment.patientId,
            scheduled_date: appointment.date,
            scheduled_time: appointment.time,
            status: appointment.status,
            notes: appointment.notes,
            source: appointment.source || 'internal',
            google_id: appointment.googleId
        })
        .select(`
      *,
      patients (name)
    `)
        .single()

    if (error) throw error

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
    }
}

export const updateAppointment = async (appointment: Appointment): Promise<Appointment> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('appointments')
        .update({
            patient_id: appointment.patientId,
            scheduled_date: appointment.date,
            scheduled_time: appointment.time,
            status: appointment.status,
            notes: appointment.notes,
            source: appointment.source,
            google_id: appointment.googleId
        })
        .eq('id', appointment.id)
        .select(`
      *,
      patients (name)
    `)
        .single()

    if (error) throw error

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
    }
}

// ========================================
// EXPENSES CRUD
// ========================================

export const getExpenses = async (): Promise<Expense[]> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })

    if (error) throw error

    return data.map(e => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
        category: e.category,
        type: e.type as ExpenseType,
        receiptUrl: e.receipt_url,
        merchantName: e.merchant_name
    }))
}

export const createExpense = async (expense: Expense): Promise<Expense> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('expenses')
        .insert({
            description: expense.description,
            merchant_name: expense.merchantName,
            amount: expense.amount,
            date: expense.date,
            category: expense.category,
            type: expense.type === ExpenseType.PF ? 'PF' : 'PJ',
            receipt_url: expense.receiptUrl
        })
        .select()
        .single()

    if (error) throw error

    return {
        id: data.id,
        description: data.description,
        amount: Number(data.amount),
        date: data.date,
        category: data.category,
        type: data.type as ExpenseType,
        receiptUrl: data.receipt_url,
        merchantName: data.merchant_name
    }
}

export const updateExpense = async (expense: Expense): Promise<Expense> => {
    await ensureAuthenticated()

    const { data, error } = await supabase
        .from('expenses')
        .update({
            description: expense.description,
            merchant_name: expense.merchantName,
            amount: expense.amount,
            date: expense.date,
            category: expense.category,
            type: expense.type === ExpenseType.PF ? 'PF' : 'PJ',
            receipt_url: expense.receiptUrl
        })
        .eq('id', expense.id)
        .select()
        .single()

    if (error) throw error

    return {
        id: data.id,
        description: data.description,
        amount: Number(data.amount),
        date: data.date,
        category: data.category,
        type: data.type as ExpenseType,
        receiptUrl: data.receipt_url,
        merchantName: data.merchant_name
    }
}

export const deleteExpense = async (id: string): Promise<void> => {
    await ensureAuthenticated()

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

    if (error) throw error
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

import { jsPDF } from 'jspdf'

// OCR Analysis - Placeholder for future integration
export const analyzeReceiptOCR = async (file: File): Promise<Partial<Expense>> => {
    await ensureAuthenticated()
    // In a real scenario, this would upload the file to an edge function or external service
    // For now, we return a ready-to-fill object immediately
    return {
        merchantName: '',
        description: file.name.replace(/\.[^/.]+$/, ""), // Use filename as description
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: 'Outros',
        type: ExpenseType.PJ
    }
}

// Notification - Placeholder for Twilio/Resend
export const sendNotification = async (type: 'whatsapp' | 'email', patientName: string, date: string): Promise<boolean> => {
    await ensureAuthenticated()
    // Log intent to Supabase or Console
    console.log(`[Notification] Sending ${type} to ${patientName} for date ${date}`)
    return true
}

// PDF Generation - Real implementation using jsPDF
export const generateReportPDF = async (month: string, data?: { patients: Patient[], appointments: Appointment[], expenses: Expense[] }): Promise<Blob> => {
    await ensureAuthenticated()

    let reportData = data;

    if (!reportData) {
        // Fetch data if not provided
        // month comes formatted as DD/MM/YYYY from Reports.tsx, e.g. "01/10/2023"
        // We need to parse this to filter relative data locally or fetch all and filter
        // For simplicity and to match current Service structure which fetches all:
        const [pats, apps, exps] = await Promise.all([
            getPatients(),
            getAppointments(),
            getExpenses()
        ]);

        reportData = {
            patients: pats,
            appointments: apps,
            expenses: exps
        };
    }

    // Parse the month string to filter
    // Format: DD/MM/YYYY
    const [day, monthStr, year] = month.split('/');
    const targetMonth = parseInt(monthStr, 10) - 1; // 0-indexed
    const targetYear = parseInt(year, 10);

    const filteredAppointments = reportData.appointments.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    const filteredExpenses = reportData.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    // We keep all patients usually (as a roster), or filter by active? 
    // Reports usually list active patients or those with activity. 
    // Let's keep all for the summary but maybe note activity.
    // For the PDF we'll just use the full list as per previous logic, or filtered apps.

    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setTextColor(44, 126, 32) // #2C7E20
    doc.text(`Relatório Mensal - ${month}`, 20, 20)

    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30)
    doc.text(`Administradora: (Usuário Logado)`, 20, 36)

    let yPos = 50

    // Summary Section
    doc.setFillColor(240, 247, 237) // #F0F7ED
    doc.rect(20, 45, 170, 40, 'F')

    doc.setFontSize(16)
    doc.setTextColor(89, 158, 74) // #599E4A
    doc.text('Resumo do Mês', 25, 55)

    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    yPos = 65
    doc.text(`Total de Pacientes Ativos: ${reportData.patients.filter(p => p.status === 'active').length}`, 25, yPos)
    yPos += 8
    doc.text(`Atendimentos no Mês: ${filteredAppointments.length}`, 25, yPos)
    yPos += 8
    doc.text(`Despesas no Mês: ${filteredExpenses.length}`, 25, yPos)

    yPos = 100

    // Appointments List
    doc.setFontSize(16)
    doc.setTextColor(89, 158, 74)
    doc.text('Detalhamento de Atendimentos', 20, yPos)
    yPos += 10
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    if (filteredAppointments.length === 0) {
        doc.text('Nenhum atendimento registrado neste mês.', 20, yPos)
        yPos += 10
    } else {
        filteredAppointments.forEach(app => {
            if (yPos > 270) {
                doc.addPage()
                yPos = 20
            }
            const statusMap: any = { 'scheduled': 'Agendado', 'confirmed': 'Confirmado', 'completed': 'Realizado', 'cancelled': 'Cancelado' }
            doc.text(`${moment(app.date).format('DD/MM')} - ${app.patientName} (${statusMap[app.status] || app.status})`, 20, yPos)
            yPos += 7
        })
    }

    yPos += 10

    // Expenses List
    if (yPos > 250) {
        doc.addPage()
        yPos = 20
    }

    doc.setFontSize(16)
    doc.setTextColor(89, 158, 74)
    doc.text('Despesas do Mês', 20, yPos)
    yPos += 10
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    if (filteredExpenses.length === 0) {
        doc.text('Nenhuma despesa registrada neste mês.', 20, yPos)
    } else {
        filteredExpenses.forEach(exp => {
            if (yPos > 270) {
                doc.addPage()
                yPos = 20
            }
            doc.text(`${moment(exp.date).format('DD/MM')} - ${exp.description} (R$ ${exp.amount.toFixed(2)})`, 20, yPos)
            yPos += 7
        })
    }

    return doc.output('blob')
}

// Google Calendar - Placeholder
export const connectGoogleCalendar = async (): Promise<boolean> => {
    await ensureAuthenticated()
    console.log('[Google Calendar] Connect requested')
    return true
}

export const fetchGoogleCalendarEvents = async (): Promise<Appointment[]> => {
    await ensureAuthenticated()
    console.log('[Google Calendar] Fetch events')
    return []
}

export const exportToGoogleCalendar = async (appointment: Appointment): Promise<boolean> => {
    await ensureAuthenticated()
    console.log(`[Google Calendar] Export appointment: ${appointment.patientName}`)
    return true
}
