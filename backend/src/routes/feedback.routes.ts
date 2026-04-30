import http from 'http';
import https from 'https';
import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = express.Router();

type TicketType = 'bug' | 'feature';

interface TicketRequestBody {
  type?: string;
  title?: string;
  subject?: string;
  description?: string;
  screenshot?: string;
  contactEmail?: string;
  reporterEmail?: string;
  reporterName?: string;
  reporterId?: string | number;
  userName?: string;
  softwareInfo?: unknown;
  consoleLogs?: string;
}

interface TicketResponseBody {
  message?: string;
  id?: string | number;
}

function getConfiguredEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeTicketType(value?: string): TicketType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'bug') {
    return 'bug';
  }

  if (normalized === 'feature') {
    return 'feature';
  }

  return null;
}

function parseSoftwareInfo(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { raw: value };
    }
  }

  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function buildTicketEndpoint(baseUrl: string): URL {
  const url = new URL(baseUrl);
  const trimmedPath = url.pathname.replace(/\/$/, '');

  if (trimmedPath.endsWith('/api/tickets')) {
    url.pathname = trimmedPath;
    return url;
  }

  if (trimmedPath.endsWith('/api')) {
    url.pathname = `${trimmedPath}/tickets`;
    return url;
  }

  url.pathname = trimmedPath ? `${trimmedPath}/api/tickets` : '/api/tickets';
  return url;
}

function postJson(url: URL, apiKey: string | undefined, body: Record<string, unknown>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
      },
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode || 500, body: responseBody });
        });
      }
    );

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      type,
      title,
      subject,
      description,
      screenshot,
      contactEmail,
      reporterEmail,
      reporterName,
      reporterId,
      userName,
      softwareInfo,
      consoleLogs,
    } = req.body as TicketRequestBody;

    const normalizedType = normalizeTicketType(type);
    const normalizedTitle = (title || subject || '').trim();
    const normalizedDescription = (description || '').trim();

    if (!normalizedType || !normalizedTitle || !normalizedDescription) {
      return res.status(400).json({ error: 'Typ, Titel und Beschreibung sind erforderlich.' });
    }

    const ticketSystemUrl = getConfiguredEnv(
      'TICKET_SYSTEM_URL',
      'VITE_TICKET_SYSTEM_URL',
      'VITE_TICKE_SYSTEM_URL'
    );
    const ticketApiKey = getConfiguredEnv(
      'TICKET_API_KEY',
      'VITE_TICKET_API_KEY',
      'VITE_API_KEY'
    );
    const ticketSystemId = Number(getConfiguredEnv('TICKET_SYSTEM_ID', 'VITE_TICKET_SYSTEM_ID') || '1');

    if (!ticketSystemUrl) {
      return res.status(503).json({
        error: 'Ticketsystem ist nicht konfiguriert. Bitte TICKET_SYSTEM_URL oder VITE_TICKET_SYSTEM_URL setzen.',
      });
    }

    const authenticatedUser = req.user;
    const resolvedSoftwareInfo = parseSoftwareInfo(softwareInfo);
    const resolvedUserName = userName || authenticatedUser?.fullName || authenticatedUser?.username || 'Unbekannt';
    const resolvedReporterEmail = reporterEmail || contactEmail || authenticatedUser?.email || '';
    const resolvedDescription = `${normalizedDescription}\n\n--- Automatisch übermittelte Informationen ---\n${JSON.stringify(
      resolvedSoftwareInfo,
      null,
      2
    )}`;
    const endpoint = buildTicketEndpoint(ticketSystemUrl);

    const payload = {
      type: normalizedType,
      title: normalizedTitle,
      subject: normalizedTitle,
      description: resolvedDescription,
      username: resolvedUserName,
      reporter_name: reporterName || authenticatedUser?.fullName || authenticatedUser?.username || null,
      reporter_id: reporterId || authenticatedUser?.id || null,
      reporter_email: resolvedReporterEmail || null,
      system_id: Number.isFinite(ticketSystemId) ? ticketSystemId : 1,
      software_info: JSON.stringify(resolvedSoftwareInfo),
      console_logs: consoleLogs || '',
      location: typeof resolvedSoftwareInfo.url === 'string' ? resolvedSoftwareInfo.url : '',
      contact_email: contactEmail || resolvedReporterEmail || null,
      urgency: 'normal',
      screenshot,
      screenshot_base64: screenshot,
    };

    const response = await postJson(endpoint, ticketApiKey, payload);

    if (response.status < 200 || response.status >= 300) {
      console.error('Ticketsystem-Fehler:', response.status, response.body);
      return res.status(502).json({
        error: `Ticketsystem antwortete mit Status ${response.status}.`,
        details: response.body || 'Keine Fehlerdetails vom Ticketsystem verfügbar.',
      });
    }

    let parsedResponse: TicketResponseBody | null = null;
    if (response.body) {
      try {
        parsedResponse = JSON.parse(response.body) as TicketResponseBody;
      } catch {
        parsedResponse = null;
      }
    }

    res.json({
      message: parsedResponse?.message || 'Ticket erfolgreich an das Ticketsystem übermittelt.',
      id: parsedResponse?.id,
    });
  } catch (error: any) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Interner Fehler beim Senden des Tickets.' });
  }
});

export default router;
