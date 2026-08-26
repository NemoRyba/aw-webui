<template lang="pug">
div
  h3 {{ $tr('Settings') }}

  SettingsNav

  hr

  DaystartSettings

  hr

  FleetSummaryPrecomputeSettings

  hr

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

import SettingsNav from '~/components/SettingsNav.vue';
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import FleetSummaryPrecomputeSettings from '~/views/settings/FleetSummaryPrecomputeSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import DeveloperSettings from '~/views/settings/DeveloperSettings.vue';
import Theme from '~/views/settings/Theme.vue';
import ColorSettings from '~/views/settings/ColorSettings.vue';
import ActivePatternSettings from '~/views/settings/ActivePatternSettings.vue';

export default {
  name: 'Settings',
  components: {
    SettingsNav,
    DaystartSettings,
    FleetSummaryPrecomputeSettings,
    TimelineDurationSettings,
    CategorizationSettings,
    Theme,
    ColorSettings,
    DeveloperSettings,
    ActivePatternSettings,
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
