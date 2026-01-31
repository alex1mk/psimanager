import { ptBR } from 'date-fns/locale';

/**
 * Localization configuration for the entire application
 */

// Note: Moment.js has been removed from the project dependencies.
// Only modern date-fns and calendar configurations are maintained here.

// React Big Calendar Messages
export const calendarMessages = {
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
    showMore: (total: number) => `+ ${total} mais`
};

// date-fns Locale
export const dateLocale = ptBR;
