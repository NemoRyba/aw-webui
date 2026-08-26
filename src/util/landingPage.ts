export const DEFAULT_LANDING_PAGE = '/fleet';
export const SHELVED_HOME_PAGE = '/home';
// "Meine Zusammenfassung": a page of its own, not the fleet Zusammenfassung
// filtered down to one row. Own hours vs. Redmine bookings, per day.
export const OWN_SUMMARY_PAGE = '/fleet/me';

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

// Pages a landing page may point to, by role. Non-admins only get pages their
// navigation actually exposes.
// "Meine Zusammenfassung" is deliberately absent: admins pick any user -
// including themselves - on the fleet Zusammenfassung, so the personal page
// is not offered to them at all.
export const ADMIN_LANDING_PAGES = [
  '/fleet',
  '/fleet/summary',
  '/fleet/users',
  '/fleet/devices',
  '/timeline',
  '/buckets',
];
// Non-admins are restricted to their own single-user fleet view; the router
// rewrites any fleet path to /fleet/users/<own username>, so '/fleet' is the
// only meaningful start value.
export const USER_LANDING_PAGES = ['/fleet'];

// Fleet pages that can be granted per user by the admin (settings ->
// Authentication, user table). The own single-user view needs no grant.
export const FLEET_PAGE_PATHS: Record<string, string> = {
  'fleet-live': '/fleet',
  'fleet-summary': '/fleet/summary',
  // Its own page ("Meine Zusammenfassung"), not the fleet table filtered to one
  // row. The server enforces the restriction either way; this only navigates.
  'fleet-summary-own': OWN_SUMMARY_PAGE,
  'fleet-users': '/fleet/users',
  'fleet-devices': '/fleet/devices',
};

// True when the user may only see their own summary. Such a user gets
// "Meine Zusammenfassung" instead of the fleet-wide Zusammenfassung.
export function hasOwnSummaryOnly(authStore: {
  isAdmin?: boolean;
  allowedPages?: string[];
}): boolean {
  if (authStore?.isAdmin) {
    return false;
  }
  const allowed = new Set(authStore?.allowedPages || []);
  return allowed.has('fleet-summary-own') && !allowed.has('fleet-summary');
}

export function ownFleetUserPath(username: string): string {
  return username ? `/fleet/users/${encodeURIComponent(username)}` : '/fleet';
}

// Start-page keys an ADMIN may pick in the per-user table (Administration).
export const ADMIN_LANDING_KEY_PATHS: Record<string, string> = {
  ...FLEET_PAGE_PATHS,
  // The personal page is a non-admin page. An admin whose stored start page
  // still says 'fleet-summary-own' (set before the page was removed for
  // admins) degrades to the fleet Zusammenfassung, where they can pick
  // themselves.
  'fleet-summary-own': '/fleet/summary',
  timeline: '/timeline',
  buckets: '/buckets',
};

// Whitelist check for non-admin navigation: own view (+subpaths) plus
// explicitly granted fleet pages. Everything else is off-limits, so direct
// URL entry cannot reach other pages.
export function isNonAdminPathAllowed(
  path: string,
  authStore: { username?: string; allowedPages?: string[] }
): boolean {
  const cleanPath = stripQueryAndHash(String(path || '')).toLowerCase();
  const username = String(authStore?.username || '');
  if (username) {
    const own = ownFleetUserPath(username).toLowerCase();
    if (cleanPath === own || cleanPath.startsWith(`${own}/`)) {
      return true;
    }
  }
  const allowed = new Set(authStore?.allowedPages || []);
  if (allowed.has('fleet-live') && cleanPath === '/fleet') {
    return true;
  }
  if (allowed.has('fleet-summary') && cleanPath === '/fleet/summary') {
    return true;
  }
  // Either grant may open the personal page; only the wide one opens the
  // fleet-wide table.
  if (
    (allowed.has('fleet-summary') || allowed.has('fleet-summary-own')) &&
    cleanPath === OWN_SUMMARY_PAGE
  ) {
    return true;
  }
  if (
    allowed.has('fleet-users') &&
    (cleanPath === '/fleet/users' || cleanPath.startsWith('/fleet/users/'))
  ) {
    return true;
  }
  if (
    allowed.has('fleet-devices') &&
    (cleanPath === '/fleet/devices' || cleanPath.startsWith('/fleet/devices/'))
  ) {
    return true;
  }
  return false;
}

export function resolveLandingPage(
  settingsStore: { landingpage?: string },
  adminUiStore: { landingPageAdmin?: string; landingPageUser?: string },
  authStore: {
    isAdmin?: boolean;
    username?: string;
    allowedPages?: string[];
    landingPageOverride?: string;
  }
): string {
  const isAdmin = Boolean(authStore?.isAdmin);
  const override = String(authStore?.landingPageOverride || '');

  if (isAdmin) {
    // Per-admin start page set in the user table wins; 'own' means the
    // admin's own single-user view.
    if (override === 'own') {
      return ownFleetUserPath(String(authStore?.username || ''));
    }
    if (override && ADMIN_LANDING_KEY_PATHS[override]) {
      return ADMIN_LANDING_KEY_PATHS[override];
    }
  }

  if (!isAdmin) {
    // Non-admins start on their own user view unless the admin set a per-user
    // override onto a page that user is actually granted.
    const allowedPages = new Set(authStore?.allowedPages || []);
    if (
      override &&
      override !== 'own' &&
      allowedPages.has(override) &&
      FLEET_PAGE_PATHS[override]
    ) {
      return FLEET_PAGE_PATHS[override];
    }
    return ownFleetUserPath(String(authStore?.username || ''));
  }

  const allowed = ADMIN_LANDING_PAGES;
  const roleValue = adminUiStore?.landingPageAdmin;
  if (roleValue) {
    const normalized = normalizeLandingPage(roleValue);
    if (allowed.includes(normalized)) {
      return normalized;
    }
  }

  // A personal start page stored before the legacy views were unrouted (e.g.
  // '/activity/<host>') would now land on the 404 page, so clamp it to a page
  // that still exists.
  const personal = normalizeLandingPage(settingsStore?.landingpage || getLocalLandingPage());
  return allowed.includes(personal) ? personal : DEFAULT_LANDING_PAGE;
}
