import React, { useEffect, useState } from 'react';
import { Users, DollarSign, CalendarCheck, AlertTriangle, Bell, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAppointments } from '../services/mockService';
import { Appointment } from '../types';
import moment from 'moment';
import 'moment/locale/pt-br';

// Ensure locale is set
moment.locale('pt-br');

const data = [
  { name: 'Jan', receitas: 4000, despesas: 2400 },
  { name: 'Fev', receitas: 3000, despesas: 1398 },
  { name: 'Mar', receitas: 2000, despesas: 9800 },
  { name: 'Abr', receitas: 2780, despesas: 3908 },
  { name: 'Mai', receitas: 1890, despesas: 4800 },
  { name: 'Jun', receitas: 2390, despesas: 3800 },
];

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string; subtext: string }> = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      <p className="text-xs text-slate-400 mt-2">{subtext}</p>
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // State for Day Navigation in "Próximos Atendimentos"
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apps = await getAppointments();
        setAppointments(apps);
        
        // Alert logic (Next 24h)
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const count = apps.filter(app => {
          const appDate = new Date(`${app.date}T${app.time}`);
          return appDate >= now && appDate <= tomorrow && app.status === 'scheduled';
        }).length;

        if (count > 0) {
          setUpcomingCount(count);
          setShowAlert(true);
        }
      } catch (error) {
        console.error("Failed to fetch appointments for dashboard", error);
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-500">
          <div className="bg-blue-100 p-2 rounded-full flex-shrink-0">
             <Bell className="text-blue-600 w-5 h-5" />
          </div>
          <div className="flex-1 pt-0.5">
            <h4 className="text-sm font-bold text-blue-900 mb-1">Atenção: Consultas Próximas</h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              Você tem <span className="font-bold underline decoration-blue-400 underline-offset-2">{upcomingCount} consultas</span> agendadas para as próximas 24 horas que ainda aguardam confirmação.
            </p>
            <button 
              onClick={() => onNavigate('agenda')}
              className="mt-3 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
            >
              Ver na Agenda
            </button>
          </div>
          <button 
            onClick={() => setShowAlert(false)}
            className="text-blue-400 hover:text-blue-600 hover:bg-blue-100 p-1 rounded-lg transition-colors"
            aria-label="Dispensar alerta"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
        <span className="text-sm text-slate-500 bg-white px-3 py-1 rounded-full border border-gray-200 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Sistema Operante
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Pacientes Ativos" 
          value="24" 
          icon={Users} 
          color="bg-teal-500" 
          subtext="+2 novos este mês"
        />
        <StatCard 
          title="Faturamento Mensal" 
          value="R$ 12.450" 
          icon={DollarSign} 
          color="bg-emerald-500" 
          subtext="85% da meta atingida"
        />
        <StatCard 
          title="Sessões Agendadas" 
          value="42" 
          icon={CalendarCheck} 
          color="bg-purple-500" 
          subtext="Próximos 7 dias"
        />
        <StatCard 
          title="Pendências Fiscais" 
          value="3" 
          icon={AlertTriangle} 
          color="bg-orange-400" 
          subtext="Recibos não categorizados"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-semibold text-slate-800">Receitas x Despesas</h3>
             <select className="text-xs border-gray-200 rounded-md text-slate-500 bg-gray-50 p-1">
               <option>Últimos 6 meses</option>
               <option>Este ano</option>
             </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="receitas" fill="#0d9488" radius={[4, 4, 0, 0]} name="Receitas" barSize={32} />
                <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Appointments Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col h-[450px]">
          <div className="flex flex-col mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Atendimentos do Dia</h3>
            
            {/* Date Navigator */}
            <div className="flex items-center justify-between mt-2 bg-gray-50 rounded-lg p-1 border border-gray-100">
               <button 
                 onClick={() => navigateDay('prev')}
                 className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all"
               >
                  <ChevronLeft size={16} />
               </button>
               <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar size={14} className="text-teal-600" />
                  <span className="capitalize">
                    {/* Using Native Intl for guaranteed Portuguese formatting */}
                    {viewDate.toLocaleDateString('pt-BR', { weekday: 'long' })}, {viewDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
               </div>
               <button 
                 onClick={() => navigateDay('next')}
                 className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all"
               >
                  <ChevronRight size={16} />
               </button>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {dailyAppointments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-60">
                    <CalendarCheck size={32} />
                    <p className="text-sm text-center">Nenhum atendimento<br/>para este dia.</p>
                </div>
            ) : (
                dailyAppointments.map((app) => (
                <div key={app.id} className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100 hover:border-teal-100 group cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-sm group-hover:bg-teal-100 transition-colors flex-shrink-0">
                    {app.patientName.charAt(0)}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors truncate">{app.patientName}</p>
                    <p className="text-xs text-slate-500 truncate">
                        {app.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                    </p>
                    </div>
                    <div className="text-right pl-2">
                    <div className="bg-gray-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors whitespace-nowrap">
                        {app.time}
                    </div>
                    </div>
                </div>
                ))
            )}
          </div>
          <button 
            onClick={() => onNavigate('agenda')}
            className="w-full mt-4 py-2.5 text-sm bg-gray-50 text-slate-600 font-medium hover:bg-gray-100 hover:text-slate-800 rounded-lg transition-colors border border-gray-200"
          >
            Ver Agenda Completa
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;