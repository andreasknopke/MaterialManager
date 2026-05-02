export const FORCE_LOGOUT_EVENT = 'material-manager:force-logout';
const FORCE_LOGOUT_STORAGE_KEY = 'forcedLogoutReason';

export interface ForcedLogoutReason {
  title?: string;
  message: string;
  code?: 'auth' | 'offline-cache-failure' | 'db-connection' | 'session';
}

export const persistForcedLogoutReason = (reason: ForcedLogoutReason): void => {
  sessionStorage.setItem(FORCE_LOGOUT_STORAGE_KEY, JSON.stringify(reason));
};

export const consumeForcedLogoutReason = (): ForcedLogoutReason | null => {
  const rawValue = sessionStorage.getItem(FORCE_LOGOUT_STORAGE_KEY);
  if (!rawValue) return null;

  sessionStorage.removeItem(FORCE_LOGOUT_STORAGE_KEY);

  try {
    return JSON.parse(rawValue) as ForcedLogoutReason;
  } catch {
    return {
      title: 'Sitzung beendet',
      message: rawValue,
      code: 'session',
    };
  }
};

export const dispatchForcedLogout = (reason: ForcedLogoutReason): void => {
  persistForcedLogoutReason(reason);
  window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, { detail: reason }));
};
