import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import { Calendar as CalendarIcon, Clock, MessageCircle, Mail, CheckCircle, Plus, X, User, ArrowRight, AlertTriangle, Loader2, Link as LinkIcon, Check, Filter, CalendarDays, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Appointment, Patient } from '../types';
import { getAppointments, getPatients, createAppointment, updateAppointment, sendNotification, connectGoogleCalendar, fetchGoogleCalendarEvents, exportToGoogleCalendar } from '../services/supabaseService';
import { Alert } from '../components/ui/Alert';

// Setup localizer
moment.locale('pt-br');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

// Portuguese translation for calendar
const messages = {
  allDay: 'Dia inteiro',
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Não há eventos neste período.',
};

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  const goToCurrent = () => {
    toolbar.onNavigate('TODAY');
  };

  const label = () => {
    return (
      <div className="flex items-center gap-4 justify-center">
        <button
          onClick={goToBack}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:-translate-y-1 transition-transform duration-300 ease-in-out"
          title="Mês Anterior"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="text-xl font-bold text-slate-800 capitalize min-w-[150px] text-center">
          {toolbar.label}
        </span>
        <button
          onClick={goToNext}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:-translate-y-1 transition-transform duration-300 ease-in-out"
          title="Próximo Mês"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 p-2 border-b border-gray-100 pb-4">
      <div className="flex gap-2 w-full md:w-auto justify-center md:justify-start">
        <button onClick={goToCurrent} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-50 hover:-translate-y-1 transition-transform duration-300 ease-in-out">Hoje</button>
        <button onClick={goToBack} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-50 hover:-translate-y-1 transition-transform duration-300 ease-in-out">Anterior</button>
        <button onClick={goToNext} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-50 hover:-translate-y-1 transition-transform duration-300 ease-in-out">Próximo</button>
      </div>

      <div className="flex-1 w-full md:w-auto">
        {label()}
      </div>

      <div className="flex gap-2 w-full md:w-auto justify-center md:justify-end">
        {['month', 'week', 'day'].map(view => (
          <button
            key={view}
            onClick={() => toolbar.onView(view)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium capitalize hover:-translate-y-1 transition-transform duration-300 ease-in-out ${toolbar.view === view
              ? 'bg-teal-50 text-teal-700 border-teal-200 shadow-sm'
              : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {view === 'month' ? 'Mês' : view === 'week' ? 'Semana' : 'Dia'}
          </button>
        ))}
      </div>
    </div>
  );
};

const Agenda: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPatient, setFilterPatient] = useState<string>('');

  // New Appointment Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    notes: ''
  });

  // State for Drag and Drop Confirmation
  const [draggedEvent, setDraggedEvent] = useState<{ event: any, start: Date, end: Date } | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Google Calendar State
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [appData, patData] = await Promise.all([getAppointments(), getPatients()]);
      setAppointments(appData);
      setPatients(patData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const events = useMemo(() => {
    return appointments
      .filter(app => {
        if (filterStatus !== 'all' && app.status !== filterStatus) return false;
        if (filterPatient && !app.patientName.toLowerCase().includes(filterPatient.toLowerCase())) return false;
        return true;
      })
      .map(app => {
        const start = new Date(`${app.date}T${app.time}`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        return {
          id: app.id,
          title: app.patientName,
          start,
          end,
          resource: app,
        };
      });
  }, [appointments, filterStatus, filterPatient]);

  const handleConnectGoogle = async () => {
    setIsSyncing(true);
    setNotificationStatus({ type: 'info', message: 'Conectando ao Google Calendar...' });

    try {
      await connectGoogleCalendar();
      setIsGoogleConnected(true);

      const googleEvents = await fetchGoogleCalendarEvents();
      setAppointments(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newEvents = googleEvents.filter(e => !existingIds.has(e.id));
        return [...prev, ...newEvents];
      });

      setNotificationStatus({ type: 'success', message: 'Conectado e sincronizado com Google Calendar!' });
    } catch (error) {
      setNotificationStatus({ type: 'error', message: 'Erro ao conectar com Google.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirm = useCallback(async (id: string, name: string) => {
    setNotificationStatus({ type: 'info', message: `Enviando confirmações para ${name}...` });

    await Promise.all([
      sendNotification('whatsapp', name, 'Hoje'),
      sendNotification('email', name, 'Hoje')
    ]);

    const updatedApp = appointments.find(a => a.id === id);
    if (updatedApp) {
      const newItem = { ...updatedApp, status: 'confirmed' as const };
      await updateAppointment(newItem);
      setAppointments(prev => prev.map(app => app.id === id ? newItem : app));
    }

    setNotificationStatus({ type: 'success', message: `Presença de ${name} confirmada! Notificações enviadas.` });

    if (isGoogleConnected && updatedApp) {
      await exportToGoogleCalendar({ ...updatedApp, status: 'confirmed' });
    }

    setSelectedEvent((prev: any) => {
      if (prev && prev.resource.id === id) {
        return { ...prev, resource: { ...prev.resource, status: 'confirmed' } };
      }
      return prev;
    });
  }, [isGoogleConnected, appointments]);

  const onEventDrop = (data: { event: any; start: Date; end: Date; isAllDay: boolean }) => {
    const { event, start, end } = data;
    if (event.resource.source === 'google') {
      setNotificationStatus({ type: 'info', message: 'Eventos do Google Calendar devem ser editados na plataforma original.' });
      return;
    }

    setRescheduleTime(moment(start).format('HH:mm'));
    setDraggedEvent({ event, start, end });
  };

  const confirmReschedule = async () => {
    if (!draggedEvent) return;

    setIsRescheduling(true);
    const { event, start } = draggedEvent;

    const newDateStr = moment(start).format('YYYY-MM-DD');
    const newTimeStr = rescheduleTime;
    const formattedDateDisplay = moment(newDateStr + 'T' + newTimeStr).format('DD/MM/YYYY [às] HH:mm');

    try {
      const updatedAppointment = {
        ...event.resource,
        date: newDateStr,
        time: newTimeStr,
        status: 'scheduled' as const
      };

      await updateAppointment(updatedAppointment);
      await sendNotification('whatsapp', event.title, formattedDateDisplay);

      setAppointments(prev => prev.map(app => app.id === event.id ? updatedAppointment : app));

      if (isGoogleConnected) {
        exportToGoogleCalendar(updatedAppointment);
      }

      setNotificationStatus({
        type: 'success',
        message: `Consulta remarcada para ${formattedDateDisplay}. Notificações enviadas!`
      });

    } catch (error) {
      setNotificationStatus({ type: 'error', message: 'Erro ao remarcar consulta.' });
    } finally {
      setIsRescheduling(false);
      setDraggedEvent(null);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppointment.patientId || !newAppointment.date || !newAppointment.time) {
      setNotificationStatus({ type: 'error', message: 'Preencha paciente, data e horário.' });
      return;
    }

    setIsCreating(true);
    try {
      const patient = patients.find(p => p.id === newAppointment.patientId);
      if (!patient) throw new Error('Paciente não encontrado');

      const app: Appointment = {
        id: Math.random().toString(36).substr(2, 9),
        patientId: patient.id,
        patientName: patient.name,
        date: newAppointment.date,
        time: newAppointment.time,
        status: 'scheduled',
        source: 'internal',
        notes: newAppointment.notes
      };

      await createAppointment(app);
      setAppointments(prev => [...prev, app]);

      setNotificationStatus({ type: 'success', message: 'Agendamento criado com sucesso!' });
      setIsNewModalOpen(false);

      setNewAppointment({
        patientId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        notes: ''
      });
    } catch (error) {
      setNotificationStatus({ type: 'error', message: 'Erro ao criar agendamento.' });
    } finally {
      setIsCreating(false);
    }
  };

  // ... (imports remain the same, just updating styles)

  const eventStyleGetter = (event: any) => {
    const status = event.resource.status;
    const isGoogle = event.resource.source === 'google';

    if (isGoogle) {
      return {
        style: {
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          color: 'white',
          border: '0px',
          display: 'block',
          fontSize: '0.85rem',
          fontWeight: '500',
          opacity: 0.9,
          borderLeft: '4px solid #1e40af',
          transition: 'transform 0.2s',
        },
        className: 'hover:-translate-y-1 shadow-sm'
      };
    }

    // Default Theme Green (#b4df9f) for scheduled events as requested
    // Confirmed = Darker Green (#599e4a)
    // Cancelled = Red

    let backgroundColor = '#b4df9f'; // Light Green (Standard)
    let borderColor = '#86be74';
    let color = '#1a2e1a'; // Darker text for contrast on light green

    switch (status) {
      case 'confirmed':
        backgroundColor = '#599e4a'; // Sidebar Green
        borderColor = '#2c9e40';
        color = 'white';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        borderColor = '#dc2626';
        color = 'white';
        break;
      case 'completed':
        backgroundColor = '#cbd5e1';
        borderColor = '#94a3b8';
        color = '#334155';
        break;
      case 'scheduled':
      default:
        backgroundColor = '#b4df9f';
        borderColor = '#a3cfa3';
        color = '#14532d'; // Dark Green text
        break;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        color,
        border: '1px solid ' + borderColor, // Added border
        display: 'block',
        fontSize: '0.85rem',
        fontWeight: '600',
        borderRadius: '6px',
        transition: 'all 0.2s ease-in-out',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      },
      className: 'hover:-translate-y-1 hover:shadow-md cursor-pointer'
    };
  };

  const { components } = useMemo(() => ({
    components: {
      toolbar: CustomToolbar,
      event: ({ event }: any) => (
        <div className="flex items-center justify-between w-full h-full overflow-hidden px-2 py-0.5">
          <span className="truncate text-xs sm:text-sm flex items-center gap-1 font-bold">
            {event.resource.source === 'google' && <CalendarIcon size={12} className="text-white/80" />}
            {event.title}
          </span>
          {event.resource.status === 'scheduled' && event.resource.source !== 'google' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm(event.resource.id, event.title);
              }}
              className="ml-1 p-0.5 bg-white/30 hover:bg-white/60 rounded text-teal-900 flex-shrink-0 transition-colors"
              title="Confirmar Presença"
            >
              <CheckCircle size={14} />
            </button>
          )}
        </div>
      )
    }
  }), [handleConfirm]);

  const customDayPropGetter = (date: Date) => {
    // Optional: Style today or specific days
    return {
      style: {
        backgroundColor: 'transparent' // Default
      }
    };
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando agenda...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda</h2>
          <p className="text-slate-500">Arraste os eventos para remarcar consultas.</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleConnectGoogle}
            disabled={isSyncing || isGoogleConnected}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border hover:-translate-y-1 transition-transform duration-300 ease-in-out ${isGoogleConnected
              ? 'bg-[#f0f7ed] text-[#599e4a] border-[#b4df9f]'
              : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : isGoogleConnected ? <Check size={16} /> : <LinkIcon size={16} />}
            {isGoogleConnected ? 'Sincronizado' : 'Sincronizar Google'}
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#599e4a] text-white rounded-lg hover:bg-[#4a8a3c] shadow-sm hover:-translate-y-1 transition-transform duration-300 ease-in-out ml-auto md:ml-0"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filters & Navigation Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Filter size={16} />
          Filtros:
        </div>

        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={filterPatient}
            onChange={(e) => setFilterPatient(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#f0f7ed] border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-[#599e4a] focus:border-[#599e4a]"
          />
        </div>

        {/* Date Navigator with Integrated Arrows */}
        <div className="flex items-center gap-2 border-l border-r border-gray-200 px-4 mx-2">
          <CalendarDays size={16} className="text-slate-400" />
          <span className="text-xs text-slate-500 font-semibold uppercase">DATA</span>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-[#f0f7ed] text-slate-500 border-r border-gray-200 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="relative">
              <input
                type="date"
                className="pl-2 pr-8 py-1 text-sm bg-white border-none text-slate-700 focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer relative z-10"
                value={moment(currentDate).format('YYYY-MM-DD')}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const newDate = new Date(year, month - 1, day);
                    setCurrentDate(newDate);
                  }
                }}
              />
              <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none z-20 text-slate-500">
                <CalendarIcon size={14} />
              </div>
            </div>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-[#f0f7ed] text-slate-500 border-l border-gray-200 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="w-full sm:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#f0f7ed] border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-[#599e4a] focus:border-[#599e4a] text-slate-700"
          >
            <option value="all">Todos os Status</option>
            <option value="scheduled">Agendados</option>
            <option value="confirmed">Confirmados</option>
            <option value="completed">Realizados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {notificationStatus && (
        <Alert
          type={notificationStatus.type}
          message={notificationStatus.message}
          onClose={() => setNotificationStatus(null)}
        />
      )}

      {/* Calendar View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 h-[600px] hover:shadow-md transition-shadow">
        {/* Style overwrite for Calendar Header */}
        <style>{`
          .rbc-header {
             background-color: #f0f7ed !important;
             padding: 12px 0 !important;
             color: #14532d !important;
             font-weight: 700 !important;
             border-bottom: 1px solid #b4df9f !important;
             text-transform: uppercase;
             font-size: 0.8rem;
          }
          .rbc-today {
             background-color: #f8fafc !important;
          }
          .rbc-off-range-bg {
             background-color: #fefefe !important;
          }
          /* Hover effect on cells is tricky in big-calendar without custom components, 
             but we added hover effects to events */
        `}</style>
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onNavigate={(date) => setCurrentDate(date)}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          messages={messages}
          culture='pt-br'
          eventPropGetter={eventStyleGetter}
          dayPropGetter={customDayPropGetter}
          components={components}
          onSelectEvent={(event) => setSelectedEvent(event)}
          onEventDrop={onEventDrop}
          resizable={false}
          views={['month', 'week', 'day']}
          defaultView={Views.MONTH}
          popup
          selectable
        />
      </div>

// ... (rest of the modal code remains similar but we should update button colors there too if needed, but for now focusing on main view)

      {/* New Appointment Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Plus size={20} className="text-teal-600" /> Novo Agendamento
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg p-1"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                <select
                  required
                  value={newAppointment.patientId}
                  onChange={(e) => setNewAppointment({ ...newAppointment, patientId: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-slate-800"
                >
                  <option value="">Selecione um paciente</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={newAppointment.date}
                      onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                      className="bg-white w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-slate-800 pr-10 appearance-none relative z-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none z-20 text-slate-500">
                      <CalendarIcon size={20} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                  <div className="relative">
                    <input
                      type="time"
                      required
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                      className="bg-white w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-slate-800 pr-10 appearance-none relative z-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none z-20 text-slate-500">
                      <Clock size={20} />
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex justify-center items-center gap-2"
              >
                {isCreating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                Agendar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {selectedEvent && !draggedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <User size={18} className="text-teal-600" />
                Detalhes do Agendamento
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${selectedEvent.resource.source === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-teal-50 text-teal-600'
                  }`}>
                  {selectedEvent.title.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-800">{selectedEvent.title}</h4>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    <Clock size={14} />
                    {moment(selectedEvent.start).format('DD/MM/YYYY [às] HH:mm')}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${selectedEvent.resource.status === 'confirmed' ? 'bg-green-500' :
                        selectedEvent.resource.status === 'cancelled' ? 'bg-red-500' : 'bg-teal-500'
                        }`}></span>
                      <span className="text-slate-700 font-medium capitalize">
                        {selectedEvent.resource.status === 'confirmed' ? 'Confirmado' :
                          selectedEvent.resource.status === 'scheduled' ? 'Agendado' :
                            selectedEvent.resource.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedEvent.resource.source !== 'google' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {selectedEvent.resource.status === 'scheduled' && (
                    <button
                      onClick={() => handleConfirm(selectedEvent.resource.id, selectedEvent.title)}
                      className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      <CheckCircle size={18} />
                      Confirmar Presença
                    </button>
                  )}
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors">
                    <MessageCircle size={18} />
                    WhatsApp
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors">
                    <Mail size={18} />
                    E-mail
                  </button>
                </div>
              )}
              {selectedEvent.resource.source === 'google' && (
                <p className="text-xs text-center text-slate-400 italic mt-4">
                  Este evento foi importado do Google Calendar e não pode ser editado aqui.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Confirmation Modal */}
      {draggedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border-t-4 border-yellow-400">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-yellow-100 p-3 rounded-full">
                  <AlertTriangle className="text-yellow-600 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Remarcar Consulta?</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Você está movendo a consulta de <strong className="text-slate-800">{draggedEvent.event.title}</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between gap-2 mb-6">
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-400 uppercase font-semibold">De</p>
                  <p className="text-sm font-bold text-red-500 line-through decoration-2 decoration-red-200">
                    {moment(draggedEvent.event.start).format('DD/MM HH:mm')}
                  </p>
                </div>
                <ArrowRight className="text-slate-300 w-5 h-5" />
                <div className="text-center flex-1">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Para</p>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-teal-600 mb-1">
                      {moment(draggedEvent.start).format('DD/MM')}
                    </span>
                    {/* Time Input for precise rescheduling */}
                    <input
                      type="time"
                      className="text-sm font-bold text-teal-700 bg-white border border-teal-200 rounded px-1 py-0.5 text-center w-20 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-6 bg-yellow-50 p-2 rounded border border-yellow-100">
                ⚠️ Confirme o novo horário acima. Uma notificação será enviada automaticamente.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDraggedEvent(null)}
                  disabled={isRescheduling}
                  className="flex-1 px-4 py-2 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmReschedule}
                  disabled={isRescheduling}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors disabled:opacity-50"
                >
                  {isRescheduling ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Atualizando...
                    </>
                  ) : 'Confirmar e Notificar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;