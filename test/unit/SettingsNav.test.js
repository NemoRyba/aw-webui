import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';

import SettingsNav from '~/components/SettingsNav.vue';
import Settings from '~/views/settings/Settings.vue';
import SettingsConnectors from '~/views/settings/SettingsConnectors.vue';
import { useAuthStore } from '~/stores/auth';

// The settings page is split in two: General keeps the local preferences,
// Connectors holds LDAP and Redmine. Both are admin-only routes, but the
// connector endpoints are restricted further to the built-in admin, so the
// tab must not be offered to anyone else.

function mount(component, username) {
  const pinia = createTestingPinia({ stubActions: true });
  useAuthStore(pinia).$patch({
    user: { username, is_admin: true, allowed_pages: [] },
  });
  return shallowMount(component, {
    pinia,
    mocks: { $tr: key => key },
    stubs: { 'router-link': true },
  });
}

function has(wrapper, name) {
  return wrapper.findComponent({ name }).exists();
}

describe('SettingsNav', () => {
  it('offers both tabs to the built-in admin', () => {
    expect(mount(SettingsNav, 'admin').vm.showConnectors).toBe(true);
  });

  it('hides the connectors tab from other admins', () => {
    expect(mount(SettingsNav, 'mstep').vm.showConnectors).toBe(false);
  });
});

describe('Settings split', () => {
  it('puts the sub-navigation on both pages', () => {
    expect(has(mount(Settings, 'admin'), 'SettingsNav')).toBe(true);
    expect(has(mount(SettingsConnectors, 'admin'), 'SettingsNav')).toBe(true);
  });

  it('keeps the connector panels off the general page', () => {
    const general = mount(Settings, 'admin');
    // These moved to /settings/connectors and must not be rendered twice.
    expect(has(general, 'AdminAuthSettings')).toBe(false);
    expect(has(general, 'RedmineSettings')).toBe(false);
  });

  it('keeps the local preference panels on the general page', () => {
    const general = mount(Settings, 'admin');
    expect(has(general, 'DaystartSettings')).toBe(true);
    expect(has(general, 'FleetSummaryPrecomputeSettings')).toBe(true);
    expect(has(general, 'TimelineDurationSettings')).toBe(true);
    expect(has(general, 'CategorizationSettings')).toBe(true);
    expect(has(general, 'DeveloperSettings')).toBe(true);
  });

  it('renders LDAP and Redmine on the connectors page', () => {
    const connectors = mount(SettingsConnectors, 'admin');
    expect(has(connectors, 'AdminAuthSettings')).toBe(true);
    expect(has(connectors, 'RedmineSettings')).toBe(true);
  });

  it('shows a notice instead of the panels for a non-built-in admin', () => {
    const connectors = mount(SettingsConnectors, 'mstep');
    expect(connectors.vm.showConnectorSettings).toBe(false);
    expect(has(connectors, 'AdminAuthSettings')).toBe(false);
    expect(has(connectors, 'RedmineSettings')).toBe(false);
    // BootstrapVue is not registered in tests, so b-alert stays a raw tag.
    expect(connectors.html()).toContain('b-alert');
  });
});
