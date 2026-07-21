<template lang="pug">
div(:class="{'fixed-top-padding': fixedTopMenu}")
  b-navbar.aw-navbar(toggleable="lg" :fixed="fixedTopMenu ? 'top' : null")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.aligh-middle(src="/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") ActivityWatch

    b-navbar-toggle(target="nav-collapse")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        // If only a single view (the default) is available
        b-nav-item(v-if="activityViews && activityViews.length === 1", v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
          div.px-2.px-lg-1
            icon(name="calendar-day")
            | {{ $tr('Activity') }}

        // If multiple (or no) activity views are available
        b-nav-item-dropdown(v-if="!activityViews || activityViews.length !== 1")
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="calendar-day")
              | {{ $tr('Activity') }}
          b-dropdown-item(v-if="activityViews === null", disabled)
            span.text-muted {{ $tr('Loading...') }}
            br
          b-dropdown-item(v-else-if="activityViews && activityViews.length <= 0", disabled)
            | {{ $tr('No activity reports available') }}
            br
            small {{ $tr('Make sure you have both an AFK and window watcher running') }}
          b-dropdown-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
            icon(:name="view.icon")
            | {{ view.name }}

        b-nav-item(to="/timeline" style="font-color: #000;")
          div.px-2.px-lg-1
            icon(name="stream")
            | {{ $tr('Timeline') }}

        b-nav-item(to="/fleet")
          div.px-2.px-lg-1
            icon(name="calendar-week")
            | {{ $tr('Fleet') }}

        b-nav-item(v-if="showStopwatchMenu" to="/stopwatch")
          div.px-2.px-lg-1
            icon(name="stopwatch")
            | {{ $tr('Stopwatch') }}

      // Brand on large screens (centered)
      b-navbar-nav.abs-center.d-none.d-lg-block
        b-navbar-brand(to="/" style="background-color: transparent;")
          img.ml-0.aligh-middle(src="/logo.png" style="height: 1.5em;")
          span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") ActivityWatch

      b-navbar-nav.ml-auto
        b-nav-item-dropdown(right)
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="globe")
              | {{ $tr('Language') }}
          b-dropdown-item-button(
            v-for="option in languageOptions"
            :key="option.value"
            :active="language === option.value"
            @click="language = option.value"
          )
            | {{ option.text }}

        b-nav-item-dropdown(right)
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="user")
              | {{ authUsername }}
          b-dropdown-item-button(disabled)
            | {{ authRoleLabel }}
          b-dropdown-item-button(v-if="authIsAdmin" @click="openAdminSettings")
            | {{ $tr('Admin settings') }}
          b-dropdown-divider
          b-dropdown-item-button(@click="logout")
            | {{ $tr('Log out') }}

        b-nav-item-dropdown(v-if="showToolsMenu")
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="tools")
              | {{ $tr('Tools') }}
          b-dropdown-item(to="/search")
            icon(name="search")
            | {{ $tr('Search') }}
          b-dropdown-item(to="/trends" v-if="devmode")
            icon(name="chart-line")
            | {{ $tr('Trends') }}
          b-dropdown-item(to="/report" v-if="devmode")
            icon(name="chart-pie")
            | {{ $tr('Report') }}
          b-dropdown-item(to="/alerts" v-if="devmode")
            icon(name="flag-checkered")
            | {{ $tr('Alerts') }}
          b-dropdown-item(to="/timespiral" v-if="devmode")
            icon(name="history")
            | {{ $tr('Timespiral') }}
          b-dropdown-item(to="/query")
            icon(name="code")
            | {{ $tr('Query') }}
          b-dropdown-item(to="/graph" v-if="devmode")
            // TODO: use circle-nodes instead in the future
            icon(name="project-diagram")
            | {{ $tr('Graph') }}

        b-nav-item(to="/buckets")
          div.px-2.px-lg-1
            icon(name="database")
            | {{ $tr('Raw Data') }}
        b-nav-item(to="/settings")
          div.px-2.px-lg-1
            icon(name="cog")
            | {{ $tr('Settings') }}

  b-modal(
    id="admin-settings-modal"
    ref="adminSettingsModal"
    :title="$tr('Admin settings')"
    :ok-title="adminSettingsSaving ? $tr('Saving...') : $tr('Save')"
    :cancel-title="$tr('Cancel')"
    :ok-disabled="adminSettingsSaving"
    :cancel-disabled="adminSettingsSaving"
    @show="resetAdminSettingsDraft"
    @ok="handleAdminSettingsOk"
  )
    p.text-muted.mb-3 {{ $tr('Change which top navigation menus are visible for all users.') }}
    b-alert.mb-3(v-if="adminSettingsError" show variant="danger")
      | {{ adminSettingsError }}
    b-form-checkbox.mb-3(v-model="adminSettingsDraft.showStopwatchMenu" switch :disabled="adminSettingsSaving")
      | {{ $tr('Show stopwatch menu') }}
    b-form-checkbox(v-model="adminSettingsDraft.showToolsMenu" switch :disabled="adminSettingsSaving")
      | {{ $tr('Show tools menu') }}
</template>

<style lang="scss" scoped>
.fixed-top-padding {
  padding-bottom: 3.5em;
}
</style>

<script lang="ts">
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/calendar-day';
import 'vue-awesome/icons/calendar-week';
import 'vue-awesome/icons/stream';
import 'vue-awesome/icons/database';
import 'vue-awesome/icons/search';
import 'vue-awesome/icons/code';
import 'vue-awesome/icons/chart-line'; // TODO: switch to chart-column, when vue-awesome supports FA v6
import 'vue-awesome/icons/chart-pie';
import 'vue-awesome/icons/flag-checkered';
import 'vue-awesome/icons/stopwatch';
import 'vue-awesome/icons/cog';
import 'vue-awesome/icons/tools';
import 'vue-awesome/icons/history';
import 'vue-awesome/icons/globe';
import 'vue-awesome/icons/user';

// TODO: use circle-nodes instead in the future
import 'vue-awesome/icons/project-diagram';
//import 'vue-awesome/icons/cicle-nodes';

import 'vue-awesome/icons/ellipsis-h';

import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import _ from 'lodash';

import { mapState } from 'pinia';
import { useAdminUiStore } from '~/stores/adminUi';
import { useAuthStore } from '~/stores/auth';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getLanguageOptions } from '~/i18n';
import { IBucket } from '~/util/interfaces';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: null,
      // Make configurable?
      fixedTopMenu: this.$isAndroid,
      adminSettingsDraft: {
        showStopwatchMenu: false,
        showToolsMenu: true,
      },
      adminSettingsSaving: false,
      adminSettingsError: '',
    };
  },
  computed: {
    ...mapState(useAdminUiStore, ['showStopwatchMenu', 'showToolsMenu']),
    ...mapState(useSettingsStore, ['devmode']),
    authIsAdmin() {
      const authStore = useAuthStore();
      return authStore.isAdmin;
    },
    authUsername() {
      const authStore = useAuthStore();
      return authStore.username || this.$tr('User');
    },
    authRoleLabel() {
      const authStore = useAuthStore();
      return authStore.isAdmin ? this.$tr('Admin') : this.$tr('User');
    },
    language: {
      get() {
        const settingsStore = useSettingsStore();
        return settingsStore.language || 'de';
      },
      set(value) {
        const settingsStore = useSettingsStore();
        settingsStore.update({ language: value });
      },
    },
    languageOptions() {
      return getLanguageOptions(this.language);
    },
  },
  mounted: async function () {
    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
    const buckets: IBucket[] = bucketStore.buckets;
    const types_by_host = {};

    const activityViews = [];

    // TODO: Change to use same bucket detection logic as get_buckets/set_available in store/modules/activity.ts
    _.each(buckets, v => {
      types_by_host[v.hostname] = types_by_host[v.hostname] || {};
      types_by_host[v.hostname].afk ||= v.type == 'afkstatus';
      types_by_host[v.hostname].window ||= v.type == 'currentwindow';
      // TODO: Use other bucket type ID in the future
      types_by_host[v.hostname].android ||= v.type == 'currentwindow' && v.id.includes('android');
    });
    //console.log(types_by_host);

    _.each(types_by_host, (types, hostname) => {
      if (hostname != 'unknown') {
        activityViews.push({
          name: hostname,
          hostname: hostname,
          type: 'default',
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
        });
      }
      if (types['android']) {
        activityViews.push({
          name: `${hostname} (Android)`,
          hostname: hostname,
          type: 'android',
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      }
    });

    this.activityViews = activityViews;
  },
  methods: {
    openAdminSettings() {
      this.$bvModal.show('admin-settings-modal');
    },
    resetAdminSettingsDraft() {
      const adminUiStore = useAdminUiStore();
      this.adminSettingsDraft = {
        showStopwatchMenu: adminUiStore.showStopwatchMenu,
        showToolsMenu: adminUiStore.showToolsMenu,
      };
      this.adminSettingsError = '';
    },
    async handleAdminSettingsOk(event) {
      event.preventDefault();
      await this.saveAdminSettings();
    },
    async saveAdminSettings() {
      const adminUiStore = useAdminUiStore();
      this.adminSettingsSaving = true;
      this.adminSettingsError = '';
      try {
        await adminUiStore.update(this.adminSettingsDraft);
        if (this.$route.path === '/stopwatch' && !adminUiStore.showStopwatchMenu) {
          await this.$router.replace(localStorage.landingpage || '/home');
        }
        this.$nextTick(() => {
          this.$refs.adminSettingsModal.hide();
        });
      } catch (e) {
        console.error('Unable to save admin settings:', e);
        this.adminSettingsError = this.$tr('Unable to save admin settings');
      } finally {
        this.adminSettingsSaving = false;
      }
    },
    async logout() {
      const authStore = useAuthStore();
      await authStore.logout();
      await this.$router.replace('/login');
    },
  },
};
</script>

<style lang="scss" scoped>
@import '../style/globals';

.aw-navbar {
  background-color: white;
  border: solid $lightBorderColor;
  border-width: 0 0 1px 0;
}

.nav-item {
  align-items: center;

  margin-left: 0.2em;
  margin-right: 0.2em;
  border-radius: 0.5em;

  &:hover {
    background-color: #ddd;
  }
}

.abs-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
</style>

<style lang="scss">
// Needed because dropdown somehow doesn't properly work with scoping
.nav-item {
  .nav-link {
    color: #555 !important;
  }
}
</style>
