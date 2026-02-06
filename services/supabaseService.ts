import { supabase } from '../src/lib/supabase'
import { Patient, Appointment, Expense, ExpenseType } from '../types'
import { patientService } from './features/patients/patient.service'
import { appointmentService } from './features/appointments/appointment.service'
import { expenseService } from './features/expenses/expense.service'
import { format, parseISO } from 'date-fns'

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

// PATIENTS CRUD
// ----------------------------------------

export const getPatients = () => patientService.getAll()
export const createPatient = (p: Patient) => patientService.create(p)
export const updatePatient = (p: Patient) => patientService.update(p)
export const deletePatient = (id: string) => patientService.delete(id)

// APPOINTMENTS CRUD
// ----------------------------------------

export const getAppointments = () => appointmentService.getAll()
export const createAppointment = (a: Appointment) => appointmentService.create(a)
export const updateAppointment = (a: Appointment) => appointmentService.update(a)
// Note: deleteAppointment was not previously exported/implemented in supabaseService.ts

// ========================================
// EXPENSES CRUD
// ========================================

export const getExpenses = () => expenseService.getAll()
export const createExpense = (e: Expense) => expenseService.create(e)
export const updateExpense = (e: Expense) => expenseService.update(e)
export const deleteExpense = (id: string) => expenseService.delete(id)

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

// Notification - Placeholder for n8n webhook / Resend email
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
            doc.text(`${format(parseISO(app.date), 'dd/MM')} - ${app.patientName} (${statusMap[app.status] || app.status})`, 20, yPos)
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
            doc.text(`${format(parseISO(exp.date), 'dd/MM')} - ${exp.description} (R$ ${exp.amount.toFixed(2)})`, 20, yPos)
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
