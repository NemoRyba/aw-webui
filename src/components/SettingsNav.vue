<template lang="pug">
div.mb-3
  b-nav(pills small)
    b-nav-item(to="/settings" exact exact-active-class="active")
      | {{ $tr('General') }}
    b-nav-item(v-if="showConnectors" to="/settings/connectors" exact exact-active-class="active")
      | {{ $tr('Connectors') }}
</template>

<script lang="ts">
import { useAuthStore } from '~/stores/auth';

export default {
  name: 'SettingsNav',
  computed: {
    showConnectors() {
      // LDAP and Redmine are configured through admin-only endpoints, so the
      // tab is empty for anyone else - do not offer it to them.
      return useAuthStore().username === 'admin';
    },
  },
};
</script>
