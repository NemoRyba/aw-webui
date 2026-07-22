<template lang="pug">
div
  h3 {{ $tr('Settings') }}

  hr

  AdminAuthSettings(v-if="showAdminAuthSettings")

  hr(v-if="showAdminAuthSettings")

  DaystartSettings

  hr

  TimelineDurationSettings

  hr

  LandingPageSettings

  hr

  Theme

  hr

  div(v-if="!$isAndroid")
    ReleaseNotificationSettings
    hr

  ColorSettings

  hr

  ActivePatternSettings

  hr

  CategorizationSettings

  hr

  DeveloperSettings
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useAuthStore } from '~/stores/auth';

import AdminAuthSettings from '~/views/settings/AdminAuthSettings.vue';
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import ReleaseNotificationSettings from '~/views/settings/ReleaseNotificationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import LandingPageSettings from '~/views/settings/LandingPageSettings.vue';
import DeveloperSettings from '~/views/settings/DeveloperSettings.vue';
import Theme from '~/views/settings/Theme.vue';
import ColorSettings from '~/views/settings/ColorSettings.vue';
import ActivePatternSettings from '~/views/settings/ActivePatternSettings.vue';

export default {
  name: 'Settings',
  components: {
    DaystartSettings,
    AdminAuthSettings,
    TimelineDurationSettings,
    ReleaseNotificationSettings,
    CategorizationSettings,
    LandingPageSettings,
    Theme,
    ColorSettings,
    DeveloperSettings,
    ActivePatternSettings,
  },
  computed: {
    showAdminAuthSettings() {
      return useAuthStore().username === 'admin';
    },
  },
  async created() {
    await this.init();
  },
  methods: {
    async init() {
      const settingsStore = useSettingsStore();
      return settingsStore.load();
    },
  },
};
</script>
