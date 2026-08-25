<template lang="pug">
div
  h3 {{ $tr('Settings') }}

  hr

  AdminAuthSettings(v-if="showAdminAuthSettings")

  hr(v-if="showAdminAuthSettings")

  DaystartSettings

  hr

  FleetSummaryPrecomputeSettings

  hr

  RedmineSettings(v-if="showAdminAuthSettings")

  hr(v-if="showAdminAuthSettings")

  TimelineDurationSettings

  hr

  Theme

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
import FleetSummaryPrecomputeSettings from '~/views/settings/FleetSummaryPrecomputeSettings.vue';
import RedmineSettings from '~/views/settings/RedmineSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import DeveloperSettings from '~/views/settings/DeveloperSettings.vue';
import Theme from '~/views/settings/Theme.vue';
import ColorSettings from '~/views/settings/ColorSettings.vue';
import ActivePatternSettings from '~/views/settings/ActivePatternSettings.vue';

export default {
  name: 'Settings',
  components: {
    DaystartSettings,
    FleetSummaryPrecomputeSettings,
    RedmineSettings,
    AdminAuthSettings,
    TimelineDurationSettings,
    CategorizationSettings,
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
