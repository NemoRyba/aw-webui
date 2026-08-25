<template lang="pug">
div
  h3 {{ $tr('Admin') }}

  hr

  div(v-if="isAdmin")
    UserAccessSettings(v-if="isBuiltinAdmin")

    hr(v-if="isBuiltinAdmin")

    RedmineUserMappingSettings

    hr

    DeviceEnrollmentSettings

    hr

    WatcherUpdateSettings

    hr(v-if="isBuiltinAdmin")

    FleetAuthSettings(v-if="isBuiltinAdmin")

    hr(v-if="isBuiltinAdmin")

    FleetEndpointSettings(v-if="isBuiltinAdmin")
  b-alert(v-else show variant="warning")
    | {{ $tr('Only admins can view this page.') }}
</template>

<script lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useSettingsStore } from '~/stores/settings';

import DeviceEnrollmentSettings from '~/views/settings/DeviceEnrollmentSettings.vue';
import FleetAuthSettings from '~/views/settings/FleetAuthSettings.vue';
import FleetEndpointSettings from '~/views/settings/FleetEndpointSettings.vue';
import RedmineUserMappingSettings from '~/views/settings/RedmineUserMappingSettings.vue';
import UserAccessSettings from '~/views/settings/UserAccessSettings.vue';
import WatcherUpdateSettings from '~/views/settings/WatcherUpdateSettings.vue';

export default {
  name: 'Admin',
  components: {
    DeviceEnrollmentSettings,
    FleetAuthSettings,
    FleetEndpointSettings,
    RedmineUserMappingSettings,
    UserAccessSettings,
    WatcherUpdateSettings,
  },
  computed: {
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    isBuiltinAdmin() {
      // The user-management API is restricted to the built-in admin account.
      return useAuthStore().username === 'admin';
    },
  },
  async created() {
    await useSettingsStore().load();
  },
};
</script>
