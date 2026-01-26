// confirm-scheduling/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JWT } from 'npm:google-auth-library@9.0.0'
import { google } from 'npm:googleapis@126.0.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
    // Only allow GET requests for the confirmation link
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patient_id')

    if (!patientId) {
        return new Response("Erro: ID do paciente não fornecido.", { status: 400 })
    }

    try {
        // 1. Fetch Patient Data
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .single()

        if (fetchError || !patient) {
            return new Response("Erro: Paciente não encontrado.", { status: 404 })
        }

        if (patient.status === 'active' || patient.status === 'confirmed') {
            return new Response("Este agendamento já foi confirmado anteriormente.", { headers: { "Content-Type": "text/html" } })
        }

        // 2. Calculate Next Appointment Date
        // Simplification: We assume next occurrence of the fixedDay
        const nextDate = calculateNextDate(patient.fixed_day)
        const startTime = patient.fixed_time // e.g., "14:00"

        // 3. Create Appointment in DB
        const { error: appError } = await supabase
            .from('appointments')
            .insert({
                patient_id: patient.id,
                scheduled_date: nextDate, // YYYY-MM-DD
                scheduled_time: startTime,
                status: 'confirmed',
                source: 'internal'
            })

        if (appError) console.error("DB Error (Appointments):", appError)

        // 4. Update Patient Status
        const { error: updateError } = await supabase
            .from('patients')
            .update({ status: 'active' }) // or 'confirmed' if you added that status
            .eq('id', patientId)

        if (updateError) console.error("DB Error (Patient):", updateError)

        // 5. Add to Google Calendar
        try {
            await addToGoogleCalendar(patient.name, nextDate, startTime)
        } catch (gError) {
            console.error("Google Calendar Error:", gError)
            // We don't fail the request if Calendar fails, just log it
        }

        // 6. Return Success Page
        return new Response(`
      <html>
        <head>
           <style>
             body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #f0fdf4; color: #166534; }
             .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
             h1 { margin-bottom: 20px; }
           </style>
        </head>
        <body>
          <div class="card">
            <h1>Agendamento Confirmado!</h1>
            <p>Sua consulta foi agendada para <strong>${nextDate.split('-').reverse().join('/')} às ${startTime}</strong>.</p>
            <p>Obrigado, ${patient.name}.</p>
          </div>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } })

    } catch (err) {
        console.error(err)
        return new Response("Erro interno no servidor.", { status: 500 })
    }
})

// --- Helper Functions ---

function calculateNextDate(dayName: string): string {
    const daysMap: { [key: string]: number } = {
        'Domingo': 0, 'Segunda-feira': 1, 'Segunda': 1, 'Terça-feira': 2, 'Terça': 2,
        'Quarta-feira': 3, 'Quarta': 3, 'Quinta-feira': 4, 'Quinta': 4,
        'Sexta-feira': 5, 'Sexta': 5, 'Sábado': 6
    }
    const targetDay = daysMap[dayName]
    if (targetDay === undefined) return new Date().toISOString().split('T')[0] // Fallback to today

    const today = new Date()
    const resultDate = new Date(today)

    // Calculate days until next occurrence
    // If today is Monday(1) and we want Monday(1), we default to *next* week or today? 
    // Usually confirmed means upcoming. Let's say if today is the day, we schedule for next week, 
    // or if the time has passed... for simplicity, let's just find the next occurrence index.
    resultDate.setDate(today.getDate() + (targetDay + 7 - today.getDay()) % 7)

    // If calculated date is today, check time? Assuming simplified "future date" logic:
    // If result is today, invoke next week logic if you want strict future. 
    // For now, allow today.

    return resultDate.toISOString().split('T')[0]
}

async function addToGoogleCalendar(patientName: string, date: string, time: string) {
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') // JSON string
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') // 'primary' or specific email

    if (!serviceAccountKey || !calendarId) {
        console.warn("Skipping Google Calendar: Credentials not found.")
        return
    }

    const credentials = JSON.parse(serviceAccountKey)
    const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
    })

    const calendar = google.calendar({ version: 'v3', auth })

    // Calculate End Time (assume 1h duration)
    const startDate = new Date(`${date}T${time}:00`)
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

    await calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
            summary: `Consulta - ${patientName}`,
            description: 'Agendamento confirmado automaticamente via Supabase.',
            start: { dateTime: startDate.toISOString(), timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDate.toISOString(), timeZone: 'America/Sao_Paulo' },
            colorId: '2' // Greenish
        }
    })
}
