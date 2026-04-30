import api from './api';

export type TicketType = 'bug' | 'feature';

export interface TicketData {
  type: TicketType;
  title: string;
  description: string;
  screenshot?: string;
  contactEmail?: string;
  reporterEmail?: string;
  reporterName?: string;
  reporterId?: number;
  userName?: string;
  urgency?: 'low' | 'normal' | 'high';
}

const MAX_CONSOLE_ENTRIES = 80;
const consoleBuffer: string[] = [];
let consoleCaptureInitialized = false;

function firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function getEmailLocalPart(email?: string): string | undefined {
  if (!email || !email.includes('@')) {
    return undefined;
  }

  return email.split('@')[0]?.trim() || undefined;
}

function resolveUserNameFromToken(): Record<string, unknown> {
  const token = localStorage.getItem('token');
  if (!token) {
    return {};
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || '')) as Record<string, unknown>;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const username = firstNonEmptyString(
      typeof payload.username === 'string' ? payload.username : undefined,
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
      getEmailLocalPart(email)
    );

    return {
      userId: payload.id,
      userEmail: email,
      userName: username,
      reporterName: firstNonEmptyString(
        typeof payload.fullName === 'string' ? payload.fullName : undefined,
        typeof payload.full_name === 'string' ? payload.full_name : undefined,
        username
      ),
    };
  } catch {
    return {};
  }
}

function stringifyConsoleArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pushConsoleEntry(level: string, args: unknown[]) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(stringifyConsoleArg).join(' ')}`;
  consoleBuffer.push(line);

  if (consoleBuffer.length > MAX_CONSOLE_ENTRIES) {
    consoleBuffer.splice(0, consoleBuffer.length - MAX_CONSOLE_ENTRIES);
  }
}

function collectConsoleLogs(): string {
  return consoleBuffer.join('\n');
}

function collectSystemInfo(overrides: Partial<TicketData> = {}): Record<string, unknown> {
  const tokenInfo = resolveUserNameFromToken();

  return {
    system: 'MaterialManager',
    url: window.location.href,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    timestamp: new Date().toISOString(),
    appVersion: process.env.REACT_APP_VERSION || '1.0.0',
    reporterEmail: overrides.reporterEmail || overrides.contactEmail,
    reporterName: overrides.reporterName,
    reporterId: overrides.reporterId,
    ...tokenInfo,
  };
}

export function initConsoleCapture() {
  if (consoleCaptureInitialized || typeof window === 'undefined') {
    return;
  }

  const methods = ['log', 'info', 'warn', 'error'] as const;
  const consoleRef = console as unknown as Record<(typeof methods)[number], (...args: unknown[]) => void>;

  methods.forEach((method) => {
    const original = consoleRef[method].bind(console);
    consoleRef[method] = (...args: unknown[]) => {
      pushConsoleEntry(method, args);
      original(...args);
    };
  });

  consoleCaptureInitialized = true;
}

export async function createTicket(data: TicketData) {
  const softwareInfo = collectSystemInfo(data);
  const payload = {
    ...data,
    softwareInfo,
    consoleLogs: collectConsoleLogs(),
  };

  const response = await api.post('/feedback', payload);
  return response.data;
}
