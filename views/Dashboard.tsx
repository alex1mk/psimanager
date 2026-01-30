import React, { useEffect, useState, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ptBR } from 'date-fns/locale';
import { Users, DollarSign, CalendarCheck, AlertTriangle, Bell, X, ChevronLeft, ChevronRight, Calendar, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAppointments, getExpenses } from '../services/supabaseService';
import { patientService } from '../services/features/patients/patient.service';
import { Appointment, Patient, Expense } from '../types';
import moment from 'moment';
import 'moment/locale/pt-br';

// Ensure locale is set
moment.locale('pt-br');

// Suppress Recharts defaultProps warnings (known issue in functional components + React 18)
const error = console.error;
console.error = (...args: any) => {
  if (/defaultProps/.test(args[0])) return;
  error(...args);
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string; subtext: string }> = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-verde-botanico mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-verde-botanico">{value}</h3>
      <p className="text-xs text-verde-botanico mt-2">{subtext}</p>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

interface DashboardProps {
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(moment().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().endOf('month').format('YYYY-MM-DD'));

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Derived Stats
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [newPatientsMonth, setNewPatientsMonth] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [scheduledSessionsCount, setScheduledSessionsCount] = useState(0);
  const [pendingIssuesCount, setPendingIssuesCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  // State for Day Navigation in "Próximos Atendimentos"
  const [viewDate, setViewDate] = useState(new Date());
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setActivePicker(null);
      }
    };
    if (activePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePicker]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apps, pats, exps] = await Promise.all([
          getAppointments(),
          patientService.getAll(),
          getExpenses()
        ]);

        setAppointments(apps);
        setPatients(pats);
        setExpenses(exps);

        // --- Calculate Stats ---

        // 1. Active Patients
        const activeCount = pats.filter(p => p.status === 'active').length;
        setActivePatientsCount(activeCount);
        // New patients this month (Assuming we had a createdAt field, but we don't. using 0 or placeholder logic)
        // Since we don't have createdAt, we'll just show 0 for now or remove the diff text
        setNewPatientsMonth(0);

        // 2. Revenue (Faturamento) & Chart Data
        // Since we don't have explicit income tracking yet, we will calculate based on...
        // Actually, for now, we only have Expenses. "Receitas" will be 0 until implemented.
        // We will aggregate expenses by month for the chart.
        const currentYear = new Date().getFullYear();
        const monthlyStats = Array.from({ length: 6 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - (5 - i));
          return {
            monthIdx: d.getMonth(), // 0-11
            year: d.getFullYear(),
            name: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
            receitas: 0,
            despesas: 0
          };
        });

        exps.forEach(e => {
          const eDate = new Date(e.date);
          const mIdx = eDate.getMonth();
          const y = eDate.getFullYear();

          // Find in monthlyStats
          const stat = monthlyStats.find(s => s.monthIdx === mIdx && s.year === y);
          if (stat) {
            stat.despesas += e.amount;
          }
        });

        setChartData(monthlyStats);

        // Current Month Revenue (Placeholder)
        setMonthlyRevenue(0);

        // 3. Scheduled Sessions (Next 7 days)
        const now = new Date();
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextSessions = apps.filter(a => {
          const d = new Date(a.date);
          return d >= now && d <= next7Days && a.status === 'scheduled';
        }).length;
        setScheduledSessionsCount(nextSessions);

        // 4. Pending Issues (e.g. Expenses without receipts?)
        // Let's say pending issues are expenses without receiptUrl (if that's a requirement) or just static 0
        const pending = exps.filter(e => !e.receiptUrl).length; // Example logic
        setPendingIssuesCount(pending);


        // --- Alert Logic (Next 24h) ---
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const urgentCount = apps.filter(app => {
          const appDate = new Date(`${app.date}T${app.time}`);
          return appDate >= now && appDate <= tomorrow && app.status === 'scheduled';
        }).length;

        if (urgentCount > 0) {
          setUpcomingCount(urgentCount);
          setShowAlert(true);
        }

      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter appointments for the selected day (viewDate)
  const dailyAppointments = appointments.filter(app => {
    // Compare YYYY-MM-DD strings
    return app.date === moment(viewDate).format('YYYY-MM-DD') && app.status !== 'cancelled';
  }).sort((a, b) => a.time.localeCompare(b.time));

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setViewDate(newDate);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Notification Alert */}
      {showAlert && (
        <div className="bg-bege-calmo border border-verde-botanico/20 rounded-2xl p-4 flex items-start gap-4 shadow-md animate-in slide-in-from-top-2 duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-verde-botanico/40" />
          <div className="bg-verde-botanico/10 p-2.5 rounded-full flex-shrink-0">
            <Bell className="text-verde-botanico w-5 h-5" />
          </div>
          <div className="flex-1 pt-0.5">
            <h4 className="text-sm font-bold text-verde-botanico mb-1 font-display">Atenção: Consultas Próximas</h4>
            <p className="text-sm text-verde-botanico/80 leading-relaxed font-medium">
              Você tem <span className="font-bold border-b-2 border-verde-botanico/30 pb-0.5">{upcomingCount} consultas</span> agendadas para as próximas 24 horas que ainda aguardam confirmação.
            </p>
            <button
              onClick={() => onNavigate('agenda')}
              className="mt-3 text-[10px] font-bold uppercase tracking-widest bg-verde-botanico text-white px-4 py-2 rounded-xl hover:bg-verde-botanico/90 hover:shadow-lg transition-all duration-300"
            >
              Ver na Agenda
            </button>
          </div>
          <button
            onClick={() => setShowAlert(false)}
            className="text-verde-botanico/40 hover:text-verde-botanico hover:bg-verde-botanico/10 p-1 rounded-lg transition-colors"
            aria-label="Dispensar alerta"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-verde-botanico/10 pb-6">
        <div>
          <h2 className="text-3xl font-display text-verde-botanico">Visão Geral</h2>
          <p className="text-verde-botanico/60 italic text-sm">Resumo da sua clínica no período selecionado.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/60 backdrop-blur-sm p-2 rounded-2xl border border-verde-botanico/10 shadow-sm">
          <div className="flex items-center gap-2 px-3 border-r border-verde-botanico/10">
            <Calendar size={16} className="text-verde-botanico/50" />
            <span className="text-[10px] font-bold text-verde-botanico/40 uppercase tracking-widest">PERÍODO</span>
          </div>

          <div className="flex items-center gap-2 relative" ref={activePicker ? datePickerRef : null}>
            <div className="relative">
              <button
                onClick={() => setActivePicker(activePicker === 'start' ? null : 'start')}
                className="bg-transparent text-sm font-medium text-verde-botanico outline-none hover:bg-verde-botanico/5 px-2 py-1 rounded-lg transition-colors"
              >
                {moment(startDate).format('DD/MM/YYYY')}
              </button>

              {activePicker === 'start' && (
                <div className="absolute top-full left-0 mt-2 z-[9999] bg-white border border-verde-botanico/20 shadow-2xl rounded-2xl p-4 animate-fade-in inline-block">
                  <DayPicker
                    mode="single"
                    locale={ptBR}
                    selected={new Date(startDate + 'T12:00:00')}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date.toISOString().split('T')[0]);
                        setActivePicker(null);
                      }
                    }}
                    className="m-0"
                    classNames={{
                      day_selected: "bg-verde-botanico text-white hover:bg-verde-botanico/90",
                      day_today: "text-verde-botanico font-bold border-b-2 border-verde-botanico",
                      head_cell: "text-verde-botanico/50 font-bold uppercase text-[10px] tracking-widest",
                      button: "hover:bg-bege-calmo transition-colors rounded-lg",
                      nav_button: "text-verde-botanico hover:bg-bege-calmo rounded-lg p-1",
                    }}
                  />
                </div>
              )}
            </div>

            <span className="text-verde-botanico/30">até</span>

            <div className="relative">
              <button
                onClick={() => setActivePicker(activePicker === 'end' ? null : 'end')}
                className="bg-transparent text-sm font-medium text-verde-botanico outline-none hover:bg-verde-botanico/5 px-2 py-1 rounded-lg transition-colors"
              >
                {moment(endDate).format('DD/MM/YYYY')}
              </button>

              {activePicker === 'end' && (
                <div className="absolute top-full right-0 mt-2 z-[9999] bg-white border border-verde-botanico/20 shadow-2xl rounded-2xl p-4 animate-fade-in inline-block">
                  <DayPicker
                    mode="single"
                    locale={ptBR}
                    selected={new Date(endDate + 'T12:00:00')}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date.toISOString().split('T')[0]);
                        setActivePicker(null);
                      }
                    }}
                    className="m-0"
                    classNames={{
                      day_selected: "bg-verde-botanico text-white hover:bg-verde-botanico/90",
                      day_today: "text-verde-botanico font-bold border-b-2 border-verde-botanico",
                      head_cell: "text-verde-botanico/50 font-bold uppercase text-[10px] tracking-widest",
                      button: "hover:bg-bege-calmo transition-colors rounded-lg",
                      nav_button: "text-verde-botanico hover:bg-bege-calmo rounded-lg p-1",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            className="p-2 hover:bg-verde-botanico/10 rounded-xl text-verde-botanico transition-colors shadow-sm bg-white"
            title="Sincronizar dados"
            onClick={() => window.location.reload()}
          >
            <Calendar size={14} className="animate-pulse" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pacientes Ativos"
          value={activePatientsCount.toString()}
          icon={Users}
          color="bg-verde-botanico"
          subtext="Base de cadastros ativos"
        />
        <StatCard
          title="Faturamento Mensal"
          value={`R$ ${monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="bg-verde-botanico/80"
          subtext="Total contabilizado este mês"
        />
        <StatCard
          title="Sessões Agendadas"
          value={scheduledSessionsCount.toString()}
          icon={CalendarCheck}
          color="bg-verde-botanico/60"
          subtext="Próximos 7 dias"
        />
        <StatCard
          title="Pendências Fiscais"
          value={pendingIssuesCount.toString()}
          icon={AlertTriangle}
          color="bg-verde-botanico/40"
          subtext="Despesas sem comprovante"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-verde-botanico">Receitas x Despesas</h3>
            <select className="text-xs border-gray-200 rounded-md text-verde-botanico bg-gray-50 p-1">
              <option>Últimos 6 meses</option>
            </select>
          </div>
          <div className="h-80 w-full relative">
            {chartData.every(d => d.receitas === 0 && d.despesas === 0) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-verde-botanico/40 border-2 border-dashed border-verde-botanico/10 rounded-xl bg-gray-50/50">
                <BarChart3 size={48} className="mb-2 opacity-50" />
                <p className="font-medium text-sm">Nenhum dado financeiro registrado</p>
                <p className="text-xs">As receitas e despesas aparecerão aqui.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#F7F5F0' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #5B6D5B/10', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                  />
                  <Bar dataKey="receitas" fill="#5B6D5B" radius={[6, 6, 0, 0]} name="Receitas" barSize={32} />
                  <Bar dataKey="despesas" fill="#8C7A6B" radius={[6, 6, 0, 0]} name="Despesas" barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Appointments Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-[450px]">
          <div className="flex flex-col mb-4">
            <h3 className="text-lg font-semibold text-verde-botanico">Atendimentos do Dia</h3>

            {/* Date Navigator */}
            <div className="flex items-center justify-between mt-2 bg-gray-50 rounded-lg p-1 border border-gray-100">
              <button
                onClick={() => navigateDay('prev')}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-verde-botanico transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 text-sm font-medium text-verde-botanico">
                <Calendar size={14} className="text-teal-600" />
                <span className="capitalize">
                  {/* Using Native Intl for guaranteed Portuguese formatting */}
                  {viewDate.toLocaleDateString('pt-BR', { weekday: 'long' })}, {viewDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => navigateDay('next')}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-verde-botanico transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {dailyAppointments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-verde-botanico space-y-2 opacity-60">
                <CalendarCheck size={32} />
                <p className="text-sm text-center">Nenhum atendimento<br />para este dia.</p>
              </div>
            ) : (
              dailyAppointments.map((app) => (
                <div key={app.id} className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100 hover:border-teal-100 group cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-sm group-hover:bg-teal-100 transition-colors flex-shrink-0">
                    {app.patientName.charAt(0)}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-bold text-verde-botanico group-hover:text-teal-700 transition-colors truncate">{app.patientName}</p>
                    <p className="text-xs text-verde-botanico truncate">
                      {app.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                    </p>
                  </div>
                  <div className="text-right pl-2">
                    <div className="bg-gray-100 text-verde-botanico px-2 py-1 rounded-md text-xs font-bold group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                      {app.time}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => onNavigate('agenda')}
            className="w-full mt-4 py-2.5 text-sm bg-white text-verde-botanico font-bold hover:bg-bege-calmo rounded-xl border border-verde-botanico/10 hover:-translate-y-1 transition-all duration-300 shadow-sm"
          >
            Ver Agenda Completa
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
