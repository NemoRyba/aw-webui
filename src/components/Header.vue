<template lang="pug">
div(:class="{'fixed-top-padding': fixedTopMenu}")
  b-navbar.aw-navbar(toggleable="lg" :fixed="fixedTopMenu ? 'top' : null")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(:to="landingPage" style="background-color: transparent;")
        img.aligh-middle(src="/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") ActivityWatch

    b-navbar-toggle(target="nav-collapse")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        b-nav-item(v-if="authIsAdmin" to="/timeline" style="font-color: #000;")
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
        b-navbar-brand(:to="landingPage" style="background-color: transparent;")
          img.ml-0.aligh-middle(src="/logo.png" style="height: 1.5em;")
          span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") ActivityWatch

      b-navbar-nav.ml-auto
        // Logged-in user first in the right-side group; shows the actual
        // username of whoever is signed in.
        b-nav-item-dropdown(right)
          template(slot="button-content")
            div.d-inline.px-2.px-lg-1
              icon(name="user")
              | {{ authUsername }}
          b-dropdown-item-button(disabled)
            | {{ authRoleLabel }}
          b-dropdown-divider
          b-dropdown-item(v-if="authIsAdmin" to="/admin")
            | {{ $tr('Administration') }}
          b-dropdown-divider(v-if="authIsAdmin")
          b-dropdown-item-button(@click="logout")
            | {{ $tr('Log out') }}

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

        b-nav-item(v-if="authIsAdmin" to="/buckets")
          div.px-2.px-lg-1
            icon(name="database")
            | {{ $tr('Raw Data') }}
        b-nav-item(v-if="authIsAdmin" to="/settings")
          div.px-2.px-lg-1
            icon(name="cog")
            | {{ $tr('Settings') }}

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
import 'vue-awesome/icons/history';
import 'vue-awesome/icons/globe';
import 'vue-awesome/icons/user';

// TODO: use circle-nodes instead in the future
import 'vue-awesome/icons/project-diagram';
//import 'vue-awesome/icons/cicle-nodes';

import 'vue-awesome/icons/ellipsis-h';

import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/desktop';

import { mapState } from 'pinia';
import { useAdminUiStore } from '~/stores/adminUi';
import { useAuthStore } from '~/stores/auth';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getLanguageOptions } from '~/i18n';
import { resolveLandingPage } from '~/util/landingPage';

export default {
  name: 'Header',
  data() {
    return {
      // Make configurable?
      fixedTopMenu: this.$isAndroid,
    };
  },
  computed: {
    ...mapState(useAdminUiStore, ['showStopwatchMenu']),
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
    landingPage() {
      const settingsStore = useSettingsStore();
      const adminUiStore = useAdminUiStore();
      const authStore = useAuthStore();
      return resolveLandingPage(settingsStore, adminUiStore, authStore);
    },
  },
  mounted: async function () {
    // The bucket store is still primed here for the rest of the UI; the old
    // per-host Activity menu it used to build is gone along with the
    // /activity routes.
    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
  },
  methods: {
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
