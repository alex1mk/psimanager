import { Patient, Appointment, Expense, PaymentType, ExpenseType } from '../types';

// Initial Mock Data - Mutable for Demo Session
let localPatients: Patient[] = [
  { id: '1', name: 'Ana Silva', email: 'ana@example.com', phone: '(11) 99999-9999', paymentType: PaymentType.MONTHLY, fixedDay: 'Segunda-feira', fixedTime: '10:00', status: 'active' },
  { id: '2', name: 'Bruno Costa', email: 'bruno@example.com', phone: '(11) 98888-8888', paymentType: PaymentType.SESSION, fixedDay: 'Quarta-feira', fixedTime: '15:00', status: 'active' },
  { id: '3', name: 'Carla Dias', email: 'carla@example.com', phone: '(11) 97777-7777', paymentType: PaymentType.BIWEEKLY, fixedDay: 'Sexta-feira', fixedTime: '09:00', status: 'active' },
];

// Helper to get dates relative to today
const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

// Changed to let for mutability
let localAppointments: Appointment[] = [
  // Ana Silva - Hoje
  { id: '101', patientId: '1', patientName: 'Ana Silva', date: getRelativeDate(0), time: '10:00', status: 'confirmed', source: 'internal' },
  
  // Bruno Costa - Amanhã (Simulando navegação)
  { id: '102', patientId: '2', patientName: 'Bruno Costa', date: getRelativeDate(1), time: '15:00', status: 'scheduled', source: 'internal' },
  
  // Carla Dias - Depois de amanhã (Para aparecer na navegação)
  { id: '103', patientId: '3', patientName: 'Carla Dias', date: getRelativeDate(2), time: '09:00', status: 'scheduled', source: 'internal' },
];

// Changed from const to let for mutability
let localExpenses: Expense[] = [
  { id: '201', description: 'Aluguel Sala', amount: 1500, date: '2023-10-01', category: 'Infraestrutura', type: ExpenseType.PJ, merchantName: 'Imobiliária Central' },
  { id: '202', description: 'Materiais de Escritório', amount: 230.50, date: '2023-10-05', category: 'Materiais', type: ExpenseType.PF, merchantName: 'Kalunga' },
];

// Service Functions for Patients (CRUD)
export const getPatients = async (): Promise<Patient[]> => {
  return new Promise((resolve) => setTimeout(() => resolve([...localPatients]), 500));
};

export const createPatient = async (patient: Patient): Promise<Patient> => {
  return new Promise((resolve) => {
    localPatients.push(patient);
    setTimeout(() => resolve(patient), 500);
  });
};

export const updatePatient = async (patient: Patient): Promise<Patient> => {
  return new Promise((resolve) => {
    localPatients = localPatients.map(p => p.id === patient.id ? patient : p);
    setTimeout(() => resolve(patient), 500);
  });
};

export const deletePatient = async (id: string): Promise<void> => {
  return new Promise((resolve) => {
    localPatients = localPatients.filter(p => p.id !== id);
    setTimeout(() => resolve(), 500);
  });
};

// --- APPOINTMENTS CRUD ---

export const getAppointments = async (): Promise<Appointment[]> => {
  return new Promise((resolve) => setTimeout(() => resolve([...localAppointments]), 500));
};

export const createAppointment = async (appointment: Appointment): Promise<Appointment> => {
  return new Promise((resolve) => {
    localAppointments.push(appointment);
    setTimeout(() => resolve(appointment), 500);
  });
};

export const updateAppointment = async (appointment: Appointment): Promise<Appointment> => {
  return new Promise((resolve) => {
    localAppointments = localAppointments.map(app => app.id === appointment.id ? appointment : app);
    setTimeout(() => resolve(appointment), 500);
  });
};

// --- EXPENSES CRUD ---

export const getExpenses = async (): Promise<Expense[]> => {
  return new Promise((resolve) => setTimeout(() => resolve([...localExpenses]), 500));
};

export const createExpense = async (expense: Expense): Promise<Expense> => {
  return new Promise((resolve) => {
    localExpenses.unshift(expense); // Add to beginning
    setTimeout(() => resolve(expense), 500);
  });
};

export const updateExpense = async (expense: Expense): Promise<Expense> => {
  return new Promise((resolve) => {
    localExpenses = localExpenses.map(e => e.id === expense.id ? expense : e);
    setTimeout(() => resolve(expense), 500);
  });
};

export const deleteExpense = async (id: string): Promise<void> => {
  return new Promise((resolve) => {
    localExpenses = localExpenses.filter(e => e.id !== id);
    setTimeout(() => resolve(), 500);
  });
};

// Simulates Google Cloud Vision API
export const analyzeReceiptOCR = async (file: File): Promise<Partial<Expense>> => {
  console.log(`Analyzing file: ${file.name} via mock Google Vision...`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        merchantName: 'Papelaria Kalunga',
        description: 'Material de Papelaria',
        amount: Math.floor(Math.random() * 500) + 50,
        date: new Date().toISOString().split('T')[0],
        category: 'Insumos',
        type: ExpenseType.PJ
      });
    }, 2000);
  });
};

// Simulates Twilio/Nodemailer
export const sendNotification = async (type: 'whatsapp' | 'email', patientName: string, date: string): Promise<boolean> => {
  console.log(`Sending ${type} to ${patientName} for date ${date}`);
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};

// Simulates PDF Generation
export const generateReportPDF = async (month: string): Promise<string> => {
  console.log(`Generating PDF for ${month}...`);
  return new Promise((resolve) => setTimeout(() => resolve('blob:https://fake-pdf-url'), 1500));
};

// --- GOOGLE CALENDAR MOCKS ---

export const connectGoogleCalendar = async (): Promise<boolean> => {
  console.log('Initiating OAuth2 flow...');
  return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
};

export const fetchGoogleCalendarEvents = async (): Promise<Appointment[]> => {
  console.log('Fetching events from Google Calendar API...');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Create a mock event for "Dentist" or "Personal"
  const mockGoogleEvents: Appointment[] = [
    {
      id: 'g-001',
      patientId: 'external',
      patientName: 'Dentista (Google Calendar)',
      date: today,
      time: '13:00',
      status: 'scheduled',
      source: 'google',
      googleId: 'event-123'
    },
    {
      id: 'g-002',
      patientId: 'external',
      patientName: 'Reunião Escolar (Google Calendar)',
      date: today,
      time: '17:00',
      status: 'scheduled',
      source: 'google',
      googleId: 'event-456'
    }
  ];

  return new Promise((resolve) => setTimeout(() => resolve(mockGoogleEvents), 1200));
};

export const exportToGoogleCalendar = async (appointment: Appointment): Promise<boolean> => {
  console.log(`Creating event in Google Calendar: ${appointment.patientName}`);
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};