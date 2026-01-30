import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Calendar as CalendarIcon, Clock, MessageCircle, Mail, CheckCircle, Plus, X, User, ArrowRight, AlertTriangle, Loader2, Link as LinkIcon, Check, Filter, CalendarDays, Save, ChevronLeft, ChevronRight, Coffee } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ptBR } from 'date-fns/locale';
import { format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { DatePickerInput } from '../src/components/ui/DatePickerInput';
import '../src/styles/agenda.css';
import { Appointment, Patient } from '../types';
import { getAppointments, getPatients, createAppointment, updateAppointment, sendNotification, connectGoogleCalendar, fetchGoogleCalendarEvents, exportToGoogleCalendar } from '../services/supabaseService';
import { Alert } from '../components/ui/Alert';

// Setup moment locale
moment.updateLocale('pt-br', {
  weekdaysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
});
moment.locale('pt-br'); // Force set locale globally


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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayAppointments = appointments
        .filter(app => app.date === dateStr)
        .filter(app => {
          if (filterStatus !== 'all' && app.status !== filterStatus) return false;
          if (filterPatient && !app.patientName.toLowerCase().includes(filterPatient.toLowerCase())) return false;
          return true;
        })
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        date: dateStr,
        dayNumber: day.getDate(),
        isCurrentMonth: isSameMonth(day, currentDate),
        isToday: isToday(day),
        appointments: dayAppointments
      };
    });
  }, [currentDate, appointments, filterStatus, filterPatient]);

  // Click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    const fetchData = async () => {
      const [appData, patData] = await Promise.all([getAppointments(), getPatients()]);
      setAppointments(appData);
      setPatients(patData);
      setLoading(false);
    };
    fetchData();
  }, []);


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
    } catch (error: any) {
      console.error('Google Sync Error:', error);
      const errorMsg = error.message || 'Erro de conexão ou permissão negada.';
      setNotificationStatus({
        type: 'error',
        message: `Não foi possível sincronizar com o Google: ${errorMsg}. Verifique se a conta está disponível.`
      });
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

  const handleCreateAppointment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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


  if (loading) return <div className="p-8 text-center text-verde-botanico">Carregando agenda...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col p-6 bg-bege-calmo rounded-3xl border border-verde-botanico/10 shadow-inner relative overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 font-sans">
        <div>
          <h2 className="text-3xl font-sans font-bold text-verde-botanico">Agenda</h2>
          <p className="text-verde-botanico/60 italic font-sans text-sm">Seu planner pessoal de cuidado e acolhimento.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleConnectGoogle}
            disabled={isSyncing || isGoogleConnected}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-300 ${isGoogleConnected
              ? 'bg-verde-botanico/10 text-verde-botanico border-verde-botanico/20'
              : 'bg-white text-verde-botanico border-verde-botanico/20 hover:shadow-md'
              }`}
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : isGoogleConnected ? <Check size={16} /> : <LinkIcon size={16} />}
            {isGoogleConnected ? 'Sincronizado' : 'Sincronizar Google'}
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 shadow-md hover:shadow-lg transition-all duration-300 ml-auto md:ml-0"
          >
            <Plus size={20} />
            <span className="hidden sm:inline font-medium">Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filters & Navigation Toolbar */}
      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-verde-botanico/10 flex flex-col sm:flex-row gap-4 items-center shadow-sm relative z-10">
        <div className="flex items-center gap-2 text-verde-botanico/70 text-sm font-medium">
          <Filter size={18} />
          Filtros:
        </div>

        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar por nome do paciente..."
            value={filterPatient}
            onChange={(e) => setFilterPatient(e.target.value)}
            className="w-full px-4 py-2 bg-white/80 border border-verde-botanico/20 rounded-xl text-sm focus:ring-2 focus:ring-verde-botanico/30 focus:border-verde-botanico outline-none transition-all"
          />
        </div>

        {/* Date Navigator with Integrated Arrows */}
        <div className="flex items-center gap-3 border-l border-r border-verde-botanico/10 px-6 mx-2 relative">
          <span className="text-xs text-verde-botanico/50 font-bold uppercase tracking-widest">DATA</span>
          <div className="flex items-center bg-white border border-verde-botanico/20 rounded-xl shadow-sm hover:shadow-md transition-all">
            <button
              onClick={() => {
                console.log('Navigating to Prev Month');
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentDate(newDate);
              }}
              className="p-2 hover:bg-bege-calmo text-verde-botanico border-r border-verde-botanico/10 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="relative z-[9999]" ref={datePickerRef}>
              <button
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-verde-botanico bg-transparent hover:bg-bege-calmo transition-colors rounded-lg border border-verde-botanico/10"
              >
                <CalendarIcon size={16} className="text-verde-botanico/60" />
                {moment(currentDate).format('MMMM YYYY')}
              </button>

              {isDatePickerOpen && (
                <div className="day-picker-popover">
                  <DayPicker
                    mode="single"
                    locale={ptBR}
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(date);
                        setIsDatePickerOpen(false);
                      }
                    }}
                    month={currentDate}
                    onMonthChange={setCurrentDate}
                    formatters={{
                      formatWeekdayName: (date) => format(date, 'EEEEEE', { locale: ptBR })
                    }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                console.log('Navigating to Next Month');
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentDate(newDate);
              }}
              className="p-2 hover:bg-bege-calmo text-verde-botanico border-l border-verde-botanico/10 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="w-full sm:w-52">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 bg-white/80 border border-verde-botanico/20 rounded-xl text-sm focus:ring-2 focus:ring-verde-botanico/30 focus:border-verde-botanico outline-none text-verde-botanico font-medium transition-all"
          >
            <option value="all">Filtrar por Status</option>
            <option value="scheduled">Agendados</option>
            <option value="confirmed">Confirmados</option>
            <option value="completed">Realizados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {
        notificationStatus && (
          <Alert
            type={notificationStatus.type}
            message={notificationStatus.message}
            onClose={() => setNotificationStatus(null)}
          />
        )
      }

      {/* Calendar View */}
      <div className="calendar-main-container">
        {/* Imagem de fundo da xícara */}
        <img
          src="/assets/coffee-cup.svg"
          alt=""
          className="calendar-coffee-bg"
        />

        {/* Conteúdo do calendário */}
        <div className="calendar-content">
          {/* Cabeçalho com dias da semana */}
          <div className="calendar-header">
            <div className="calendar-header-cell">Dom</div>
            <div className="calendar-header-cell">Seg</div>
            <div className="calendar-header-cell">Ter</div>
            <div className="calendar-header-cell">Qua</div>
            <div className="calendar-header-cell">Qui</div>
            <div className="calendar-header-cell">Sex</div>
            <div className="calendar-header-cell">Sáb</div>
          </div>

          {/* Grid do calendário */}
          <div className="calendar-grid">
            {daysInMonth.map((day) => (
              <div
                key={day.date}
                className={`calendar-cell ${day.isToday ? 'calendar-cell-today' : ''} ${!day.isCurrentMonth ? 'calendar-cell-other-month' : ''}`}
                onClick={() => {
                  setNewAppointment(prev => ({ ...prev, date: day.date }));
                  setIsNewModalOpen(true);
                }}
              >
                <div className="calendar-day-number font-sans">{day.dayNumber}</div>

                {/* Compromissos do dia */}
                <div className="space-y-1">
                  {day.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="calendar-appointment truncate font-sans"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent({
                          id: apt.id,
                          title: apt.patientName,
                          start: new Date(`${apt.date}T${apt.time}`),
                          resource: apt
                        });
                      }}
                    >
                      {apt.time} - {apt.patientName}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md modal-content">
            <div className="bg-bege-calmo/50 p-4 border-b border-verde-botanico/10 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-verde-botanico text-lg flex items-center gap-2 font-display">
                <Plus size={20} /> Novo Agendamento
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-verde-botanico hover:text-verde-botanico hover:bg-slate-200 rounded-lg p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-inner-scroll p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-verde-botanico mb-2">
                    Paciente
                  </label>
                  <select
                    value={newAppointment.patientId}
                    onChange={(e) => setNewAppointment({ ...newAppointment, patientId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-verde-botanico text-verde-botanico"
                  >
                    <option value="">Selecione um paciente</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-2">
                      Data
                    </label>
                    <DatePickerInput
                      value={new Date(newAppointment.date + 'T12:00:00')}
                      onChange={(date) => setNewAppointment({ ...newAppointment, date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      placeholder="28/01/2026"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-2">
                      Horário
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={newAppointment.time}
                        onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-verde-botanico text-verde-botanico"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCreateAppointment()}
                  disabled={isCreating}
                  className="w-full bg-verde-botanico text-white py-2.5 px-4 rounded-xl hover:bg-verde-botanico/90 transition-all font-bold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Agendar Consulta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {
        selectedEvent && !draggedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-verde-botanico flex items-center gap-2">
                  <User size={18} className="text-teal-600" />
                  Detalhes do Agendamento
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-verde-botanico hover:text-verde-botanico hover:bg-slate-200 rounded-lg p-1 transition-colors"
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
                    <h4 className="text-xl font-bold text-verde-botanico">{selectedEvent.title}</h4>
                    <p className="text-verde-botanico text-sm flex items-center gap-1">
                      <Clock size={14} />
                      {moment(selectedEvent.start).format('DD/MM/YYYY [às] HH:mm')}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-xs font-semibold text-verde-botanico uppercase mb-1">Status</div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${selectedEvent.resource.status === 'confirmed' ? 'bg-green-500' :
                          selectedEvent.resource.status === 'cancelled' ? 'bg-red-500' : 'bg-teal-500'
                          }`}></span>
                        <span className="text-verde-botanico font-medium capitalize">
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
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-verde-botanico rounded-lg hover:bg-slate-200 font-medium transition-colors">
                      <MessageCircle size={18} />
                      WhatsApp
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-verde-botanico rounded-lg hover:bg-slate-200 font-medium transition-colors">
                      <Mail size={18} />
                      E-mail
                    </button>
                  </div>
                )}
                {selectedEvent.resource.source === 'google' && (
                  <p className="text-xs text-center text-verde-botanico italic mt-4">
                    Este evento foi importado do Google Calendar e não pode ser editado aqui.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Reschedule Confirmation Modal */}
      {
        draggedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border-t-4 border-yellow-400">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-yellow-100 p-3 rounded-full">
                    <AlertTriangle className="text-yellow-600 w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-verde-botanico">Remarcar Consulta?</h3>
                    <p className="text-verde-botanico text-sm mt-1">
                      Você está movendo a consulta de <strong className="text-verde-botanico">{draggedEvent.event.title}</strong>.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between gap-2 mb-6">
                  <div className="text-center flex-1">
                    <p className="text-xs text-verde-botanico uppercase font-semibold">De</p>
                    <p className="text-sm font-bold text-red-500 line-through decoration-2 decoration-red-200">
                      {moment(draggedEvent.event.start).format('DD/MM HH:mm')}
                    </p>
                  </div>
                  <ArrowRight className="text-verde-botanico w-5 h-5" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-verde-botanico uppercase font-semibold">Para</p>
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

                <p className="text-xs text-verde-botanico mb-6 bg-yellow-50 p-2 rounded border border-yellow-100">
                  ⚠️ Confirme o novo horário acima. Uma notificação será enviada automaticamente.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDraggedEvent(null)}
                    disabled={isRescheduling}
                    className="flex-1 px-4 py-2 border border-gray-300 text-verde-botanico rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmReschedule}
                    disabled={isRescheduling}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 font-bold text-sm shadow-md transition-all disabled:opacity-50"
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
        )
      }
    </div>
  );
};

export default Agenda;
