<template lang="pug">
div
  h3 {{ $tr('Settings') }}

  SettingsNav

  hr

  div(v-if="showConnectorSettings")
    AdminAuthSettings

    hr

    RedmineSettings
  b-alert(v-else show variant="warning")
    | {{ $tr('Only the built-in admin account can configure connectors.') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useAuthStore } from '~/stores/auth';

import SettingsNav from '~/components/SettingsNav.vue';
import AdminAuthSettings from '~/views/settings/AdminAuthSettings.vue';
import RedmineSettings from '~/views/settings/RedmineSettings.vue';

export default {
  name: 'SettingsConnectors',
  components: {
    SettingsNav,
    AdminAuthSettings,
    RedmineSettings,
  },
  computed: {
    showConnectorSettings() {
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
