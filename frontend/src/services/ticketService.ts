import api from './api';

export interface TicketData {
  type: 'Bug' | 'Feature';
  subject: string;
  description: string;
  screenshot?: string; // base64-Daten-URL
}

export const createTicket = (data: TicketData) => api.post('/feedback', data);
