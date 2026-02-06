export enum PaymentType {
  SESSION = 'Sessão',
  BIWEEKLY = 'Quinzenal',
  MONTHLY = 'Mensal'
}

export enum ExpenseType {
  PF = 'Pessoa Física (CPF)',
  PJ = 'Pessoa Jurídica (CNPJ)'
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  paymentType: PaymentType;
  fixedDay: string; // e.g., "Segunda-feira"
  fixedTime: string; // e.g., "14:00"
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // ISO Date (YYYY-MM-DD)
  time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'pending_confirmation' | 'draft';
  recurrence_type?: 'single' | 'weekly' | 'biweekly' | 'monthly';
  notes?: string;
  google_event_id?: string;
  source?: 'internal' | 'google';
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: ExpenseType;
  receiptUrl?: string; // Mock URL
  merchantName?: string;
}

export interface DashboardStats {
  totalPatients: number;
  monthlyRevenue: number;
  pendingReports: number;
  upcomingAppointments: number;
}