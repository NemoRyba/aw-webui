<template lang="pug">
div#wrapper(v-if="loaded")
  template(v-if="showChrome")
    aw-header

    div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
      div.aw-container.my-sm-3.p-3
        error-boundary
          user-satisfaction-poll
          new-release-notification(v-if="isNewReleaseCheckEnabled")
          router-view

    aw-footer

  template(v-else)
    error-boundary
      router-view
</template>

<script lang="ts">
import { useAdminUiStore } from '~/stores/adminUi';
import { useAuthStore } from '~/stores/auth';
import { useSettingsStore } from '~/stores/settings';
import { useServerStore } from '~/stores/server';
import { detectPreferredTheme } from '~/util/theme';
// if vite is used, you can import css file as module
//import darkCssUrl from '../static/dark.css?url';
//import darkCssContent from '../static/dark.css?inline';

export default {
  data: function () {
    return {
      activityViews: [],
      isNewReleaseCheckEnabled: !process.env.VUE_APP_ON_ANDROID,
      loaded: false,
    };
  },

  computed: {
    fullContainer() {
      return this.$route.meta.fullContainer;
    },
    showChrome() {
      const authStore = useAuthStore();
      return authStore.authenticated && this.$route.path !== '/login';
    },
  },

  async beforeCreate() {
    const authStore = useAuthStore();
    await authStore.ensureLoaded();

    // Get Theme From settings when signed in, otherwise use localStorage fallback.
    const settingsStore = useSettingsStore();
    let theme = 'auto';
    if (authStore.authenticated) {
      await settingsStore.ensureLoaded();
      const adminUiStore = useAdminUiStore();
      await adminUiStore.ensureLoaded();
      theme = settingsStore.theme;
    } else if (typeof localStorage !== 'undefined') {
      theme = localStorage.theme || 'auto';
    }
    const detectedTheme = theme === 'auto' ? detectPreferredTheme() : theme;

    // Apply the dark theme if detected
    if (detectedTheme === 'dark') {
      const method: 'link' | 'style' = 'link';

      if (method === 'link') {
        // Method 1: Create <link> Element
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = '/dark.css'; // darkCssUrl
        themeLink.rel = 'stylesheet';
        // Append Dark Theme Element
        document.querySelector('head').appendChild(themeLink);
      } else {
        // Not supported for Webpack due to not supporting ?inline import in a cross-compatible way (afaik)
        // Method 2: Create <style> Element
        //const style = document.createElement('style');
        //style.innerHTML = darkCssContent;
        //theme === 'dark' ? document.querySelector('head').appendChild(style) : '';
      }
    }
    this.loaded = true;
  },

  mounted: async function () {
    const serverStore = useServerStore();
    await serverStore.getInfo();
  },
};
</script>
