export const DEFAULT_LANDING_PAGE = '/fleet';
export const SHELVED_HOME_PAGE = '/home';

function stripQueryAndHash(path: string): string {
  return path.split(/[?#]/, 1)[0];
}

export function isLandingRedirectPath(path: unknown): boolean {
  if (typeof path !== 'string') {
    return false;
  }
  const cleanPath = stripQueryAndHash(path);
  return cleanPath === '/' || cleanPath === SHELVED_HOME_PAGE;
}

export function normalizeLandingPage(path: unknown): string {
  if (typeof path !== 'string') {
    return DEFAULT_LANDING_PAGE;
  }

  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith('/') || isLandingRedirectPath(trimmed)) {
    return DEFAULT_LANDING_PAGE;
  }

  return trimmed;
}

export function getLocalLandingPage(): string {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_LANDING_PAGE;
  }

  return normalizeLandingPage(localStorage.getItem('landingpage'));
}

export function getSettingsLandingPage(settingsStore: { landingpage?: string }): string {
  return normalizeLandingPage(settingsStore.landingpage || getLocalLandingPage());
}
