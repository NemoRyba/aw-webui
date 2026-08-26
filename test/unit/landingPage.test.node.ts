import {
  ADMIN_LANDING_PAGES,
  FLEET_PAGE_PATHS,
  OWN_SUMMARY_PAGE,
  hasOwnSummaryOnly,
  isNonAdminPathAllowed,
  resolveLandingPage,
} from '~/util/landingPage';

// The own-summary grant is the one place where a wrong path is a data leak
// rather than a broken link: /fleet/summary lists every user. The server
// rewrites the requested usernames regardless (rest.py
// _authorize_fleet_summary_scope), so these guard navigation, not access.

const ownOnly = {
  isAdmin: false,
  username: 'mstep',
  allowedPages: ['fleet-summary-own'],
};
const fullSummary = {
  isAdmin: false,
  username: 'mstep',
  allowedPages: ['fleet-summary'],
};

describe('own summary grant', () => {
  test('is its own page, not the fleet-wide table', () => {
    expect(FLEET_PAGE_PATHS['fleet-summary-own']).toBe(OWN_SUMMARY_PAGE);
    expect(FLEET_PAGE_PATHS['fleet-summary-own']).not.toBe('/fleet/summary');
  });

  test('does not open the fleet-wide summary', () => {
    expect(isNonAdminPathAllowed('/fleet/summary', ownOnly)).toBe(false);
    expect(isNonAdminPathAllowed(OWN_SUMMARY_PAGE, ownOnly)).toBe(true);
  });

  test('the wide grant opens both pages', () => {
    expect(isNonAdminPathAllowed('/fleet/summary', fullSummary)).toBe(true);
    expect(isNonAdminPathAllowed(OWN_SUMMARY_PAGE, fullSummary)).toBe(true);
  });

  test('neither grant opens anything else', () => {
    for (const store of [ownOnly, fullSummary]) {
      expect(isNonAdminPathAllowed('/fleet', store)).toBe(false);
      expect(isNonAdminPathAllowed('/fleet/users', store)).toBe(false);
      expect(isNonAdminPathAllowed('/fleet/devices', store)).toBe(false);
      expect(isNonAdminPathAllowed('/settings', store)).toBe(false);
      // ...but the own single-user view never needs a grant.
      expect(isNonAdminPathAllowed('/fleet/users/mstep', store)).toBe(true);
    }
  });

  test('hasOwnSummaryOnly separates the two grants, admins excluded', () => {
    expect(hasOwnSummaryOnly(ownOnly)).toBe(true);
    expect(hasOwnSummaryOnly(fullSummary)).toBe(false);
    // The wider grant wins server-side, so both ticked must not mean own-only.
    expect(
      hasOwnSummaryOnly({ isAdmin: false, allowedPages: ['fleet-summary', 'fleet-summary-own'] })
    ).toBe(false);
    expect(hasOwnSummaryOnly({ isAdmin: true, allowedPages: ['fleet-summary-own'] })).toBe(false);
  });

  test('is usable as a start page', () => {
    const landing = resolveLandingPage(
      {},
      {},
      { ...ownOnly, landingPageOverride: 'fleet-summary-own' }
    );
    expect(landing).toBe(OWN_SUMMARY_PAGE);
  });

  test('a start page the user is not granted falls back to their own view', () => {
    const landing = resolveLandingPage({}, {}, { ...ownOnly, landingPageOverride: 'fleet-users' });
    expect(landing).toBe('/fleet/users/mstep');
  });
});

// Admins pick any user - themselves included - on the fleet Zusammenfassung,
// so the personal page is not offered to them anywhere: not in the nav, not
// as a start page, and stale references degrade to the fleet table.
describe('admins have no personal summary page', () => {
  const admin = { isAdmin: true, username: 'admin', allowedPages: [] };

  test('it is not an admin landing page', () => {
    expect(ADMIN_LANDING_PAGES).not.toContain(OWN_SUMMARY_PAGE);
  });

  test('a stale fleet-summary-own override degrades to the fleet table', () => {
    const landing = resolveLandingPage(
      {},
      {},
      { ...admin, landingPageOverride: 'fleet-summary-own' }
    );
    expect(landing).toBe('/fleet/summary');
  });

  test('a stale stored personal start page clamps to the default', () => {
    expect(resolveLandingPage({ landingpage: OWN_SUMMARY_PAGE }, {}, admin)).toBe('/fleet');
    expect(resolveLandingPage({}, { landingPageAdmin: OWN_SUMMARY_PAGE }, admin)).toBe('/fleet');
  });
});
