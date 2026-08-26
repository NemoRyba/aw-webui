// vue-awesome ships untranspiled ESM; the icon is only a side-effect import.
jest.mock('vue-awesome/icons/sync', () => ({}));

import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import moment from 'moment';

import FleetMySummary from '~/views/fleet/FleetMySummary.vue';
import { useAuthStore } from '~/stores/auth';
import { useFleetStore } from '~/stores/fleet';
// friendlyduration / friendlytime are registered globally in main.js.
import '~/util/filters';

// The personal summary page derives everything it shows from three fleet
// responses. These cover the shaping: picking the own row out of a response,
// the per-day mapping, and the "did I book my hours" verdict.

async function flush(wrapper) {
  for (let i = 0; i < 5; i += 1) {
    await wrapper.vm.$nextTick();
  }
}

function mountPage(existingPinia) {
  const pinia = existingPinia || createTestingPinia({ stubActions: true });
  const auth = useAuthStore(pinia);
  auth.$patch({ user: { username: 'mstep', is_admin: false, allowed_pages: [] } });
  return shallowMount(FleetMySummary, {
    pinia,
    mocks: { $tr: key => key },
    // BootstrapVue is registered in main.js, which tests do not run.
    stubs: {
      'b-alert': true,
      'b-button': true,
      'b-button-group': true,
      'b-card': true,
      'b-nav': true,
      'b-nav-item': true,
      'b-spinner': true,
      'fleet-nav': true,
      icon: true,
      'router-link': true,
    },
  });
}

function dayFixture(date, activeSeconds, bookedSeconds, extra = {}) {
  const entries = bookedSeconds
    ? [{ project_id: 7, project_name: 'Kunde A', seconds: bookedSeconds, comments: 'CAD' }]
    : [];
  return {
    date,
    range: { start: date + 'T04:00:00+02:00', end: date + 'T04:00:00+02:00' },
    users: [
      {
        username: 'mstep',
        matched: true,
        active_seconds: activeSeconds,
        redmine_seconds: bookedSeconds,
        delta_seconds: activeSeconds - bookedSeconds,
        entries,
        ...extra,
      },
    ],
  };
}

describe('FleetMySummary', () => {
  test('shows the logged-in user, never somebody else', () => {
    const wrapper = mountPage();
    // A response that (wrongly) carried a colleague must not be rendered as
    // "mine" just because it arrived first.
    wrapper.setData({
      summaryResult: {
        users: [
          { username: 'colleague', totals: { active_seconds: 9999 } },
          { username: 'mstep', totals: { active_seconds: 3600, not_afk_active_seconds: 3000 } },
        ],
      },
    });
    expect(wrapper.vm.myRow.username).toBe('mstep');
    expect(wrapper.vm.activeSeconds).toBe(3600);
    expect(wrapper.vm.notAfkSeconds).toBe(3000);
  });

  test('matches the own row case-insensitively', () => {
    const wrapper = mountPage();
    wrapper.setData({
      summaryResult: { users: [{ username: 'MSTEP', totals: { active_seconds: 60 } }] },
    });
    expect(wrapper.vm.activeSeconds).toBe(60);
  });

  test('booked time and difference stay null without a Redmine match', () => {
    const wrapper = mountPage();
    wrapper.setData({
      hasLoaded: true,
      summaryResult: { users: [{ username: 'mstep', totals: { active_seconds: 3600 } }] },
      redmineResult: {
        users: [{ username: 'mstep', redmine_seconds: null, status: 'no_redmine_user' }],
      },
    });
    expect(wrapper.vm.redmineSeconds).toBeNull();
    // A missing booking must not read as "booked nothing, you are 1h over".
    expect(wrapper.vm.deltaSeconds).toBeNull();
    expect(wrapper.vm.deltaClass).toBe('text-muted');
    expect(wrapper.vm.redmineNotice).toBeTruthy();
  });

  test('grades the difference against the tolerance', () => {
    const wrapper = mountPage();
    const vm = wrapper.vm;
    expect(vm.deltaClassFor(0)).toBe('text-success');
    expect(vm.deltaClassFor(14 * 60)).toBe('text-success');
    expect(vm.deltaClassFor(-14 * 60)).toBe('text-success');
    expect(vm.deltaClassFor(30 * 60)).toBe('text-warning');
    expect(vm.deltaClassFor(-90 * 60)).toBe('text-danger');
    expect(vm.formatSignedDuration(-3600)).toMatch(/^-/);
    expect(vm.formatSignedDuration(3600)).toMatch(/^\+/);
  });

  test('maps the daily comparison to own days only', () => {
    const wrapper = mountPage();
    const foreign = dayFixture('2026-08-20', 100, 100);
    foreign.users[0].username = 'colleague';
    wrapper.setData({
      dailyComparison: {
        days: [
          dayFixture('2026-08-24', 8 * 3600, 7 * 3600),
          dayFixture('2026-08-23', 0, 0),
          foreign,
        ],
      },
    });
    const vm = wrapper.vm;
    expect(vm.myDays.map(day => day.date)).toEqual(['2026-08-24', '2026-08-23']);
    expect(vm.myDays[0].entries).toHaveLength(1);
    // Days with no tracked time still list, but do not count as worked days.
    expect(vm.activeDayCount).toBe(1);
    expect(vm.averagePerActiveDay).toBe(8 * 3600);
    expect(vm.dayBarMax).toBe(8 * 3600);
    expect(vm.barWidth(4 * 3600)).toBe('50%');
    expect(vm.barWidth(0)).toBe('0%');
    // A tiny but non-zero day stays visible instead of collapsing to nothing.
    expect(vm.barWidth(30)).toBe('2%');
  });

  test('ranks projects and reports their share', () => {
    const wrapper = mountPage();
    wrapper.setData({
      redmineResult: {
        users: [
          {
            username: 'mstep',
            redmine_seconds: 4 * 3600,
            status: 'matched',
            projects: [
              { project_id: 1, project_name: 'Klein', seconds: 3600 },
              { project_id: 2, project_name: 'Gross', seconds: 3 * 3600 },
            ],
          },
        ],
      },
    });
    const vm = wrapper.vm;
    expect(vm.myProjects.map(project => project.project_name)).toEqual(['Gross', 'Klein']);
    expect(vm.projectShare(3 * 3600)).toBe('75%');
    expect(vm.projectWidth(3 * 3600)).toBe('100%');
  });

  test('range presets cover whole weeks and months', () => {
    const wrapper = mountPage();
    const vm = wrapper.vm;
    const lastWeek = vm.presetRange('last-week');
    expect(moment(lastWeek.start).isoWeekday()).toBe(1);
    expect(moment(lastWeek.end).isoWeekday()).toBe(7);
    expect(moment(lastWeek.end).diff(moment(lastWeek.start), 'days')).toBe(6);

    const lastMonth = vm.presetRange('last-month');
    expect(moment(lastMonth.start).date()).toBe(1);
    expect(moment(lastMonth.end).isSame(moment(lastMonth.end).endOf('month'), 'day')).toBe(true);

    const yesterday = vm.presetRange('yesterday');
    expect(yesterday.start).toBe(yesterday.end);

    // The page opens on the current week, so that preset is the active one.
    expect(vm.activePreset).toBe('this-week');
  });

  test('stops loading the daily breakdown automatically for long ranges', () => {
    const wrapper = mountPage();
    wrapper.setData({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(wrapper.vm.rangeDays).toBe(31);
    expect(wrapper.vm.dailyAutoLoads).toBe(true);

    wrapper.setData({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(wrapper.vm.dailyAutoLoads).toBe(false);
    expect(wrapper.vm.canLoad).toBe(true);

    // An inverted range is not loadable at all.
    wrapper.setData({ startDate: '2026-02-01', endDate: '2026-01-01' });
    expect(wrapper.vm.canLoad).toBe(false);
  });

  test('renders the loaded page from the real load path', async () => {
    // No setData here: the fleet store answers, and the page has to do the rest
    // on its own - the mounted() load, the three requests, the whole template.
    const pinia = createTestingPinia({ stubActions: true });
    const auth = useAuthStore(pinia);
    auth.$patch({ user: { username: 'mstep', is_admin: false, allowed_pages: [] } });
    const fleet = useFleetStore(pinia);
    fleet.loadSummary.mockResolvedValue({
      users: [
        {
          username: 'mstep',
          totals: { active_seconds: 8 * 3600, not_afk_active_seconds: 7 * 3600 },
        },
      ],
    });
    fleet.loadRedmineComparison.mockResolvedValue({
      enabled: true,
      users: [
        {
          username: 'mstep',
          redmine_seconds: 7.5 * 3600,
          status: 'matched',
          projects: [{ project_id: 4, project_name: 'Kunde A', seconds: 7.5 * 3600 }],
        },
      ],
    });
    fleet.loadRedmineDailyComparison.mockResolvedValue({
      enabled: true,
      generated_at: '2026-08-24T18:00:00+02:00',
      days: [dayFixture('2026-08-24', 8 * 3600, 7.5 * 3600)],
    });

    const wrapper = mountPage(pinia);
    await flush(wrapper);

    expect(fleet.loadSummary).toHaveBeenCalled();
    const text = wrapper.text();
    expect(text).toContain('My summary');
    expect(text).toContain('Days with activity');
    expect(text).toContain('Kunde A');
    // 8h tracked, 7.5h booked - the figures reach the page, not just the boxes.
    expect(text).toContain('Active session time8h 0m 0s');
    expect(text).toContain('Redmine booked time7h 30m 0s');
    expect(text).toContain('Difference+30m 0s');
    expect(wrapper.findAll('.my-day').length).toBe(1);
    expect(wrapper.findAll('.my-day-bar').length).toBe(2);
    expect(wrapper.findAll('.my-project').length).toBe(1);
    expect(wrapper.find('.my-day-bar-fill.is-active').attributes('style')).toContain('100%');
    // 8h tracked against 7.5h booked is half an hour out: amber, not green.
    expect(wrapper.vm.deltaClass).toBe('text-warning');
  });

  test('changing the range drops the previous results', () => {
    const wrapper = mountPage();
    wrapper.setData({
      hasLoaded: true,
      summaryResult: { users: [{ username: 'mstep', totals: { active_seconds: 1 } }] },
      dailyComparison: { days: [dayFixture('2026-08-24', 60, 60)] },
    });
    wrapper.vm.clearResults();
    expect(wrapper.vm.hasLoaded).toBe(false);
    expect(wrapper.vm.summaryResult).toBeNull();
    expect(wrapper.vm.dailyComparison).toBeNull();
  });
});
