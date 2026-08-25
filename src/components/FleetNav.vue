<template lang="pug">
div.mb-3
  b-nav(pills small)
    template(v-if="isAdmin")
      b-nav-item(to="/fleet" exact exact-active-class="active")
        | {{ $tr('Live') }}
      b-nav-item(to="/fleet/summary" exact exact-active-class="active")
        | {{ $tr('Zusammenfassung') }}
      b-nav-item(to="/fleet/users" exact exact-active-class="active")
        | {{ $tr('Users') }}
      b-nav-item(to="/fleet/devices" exact exact-active-class="active")
        | {{ $tr('Devices') }}
    template(v-else)
      b-nav-item(:to="ownUserPath" :active="isOwnActive")
        | {{ $tr('My evaluation') }}
      b-nav-item(v-if="hasPage('fleet-live')" to="/fleet" exact exact-active-class="active")
        | {{ $tr('Live') }}
      b-nav-item(v-if="hasPage('fleet-summary') || hasPage('fleet-summary-own')" to="/fleet/summary" exact exact-active-class="active")
        | {{ $tr('Zusammenfassung') }}
      b-nav-item(v-if="hasPage('fleet-users')" to="/fleet/users" exact exact-active-class="active")
        | {{ $tr('Users') }}
      b-nav-item(v-if="hasPage('fleet-devices')" to="/fleet/devices" exact exact-active-class="active")
        | {{ $tr('Devices') }}
</template>

<script lang="ts">
import { useAuthStore } from '~/stores/auth';
import { ownFleetUserPath } from '~/util/landingPage';

export default {
  name: 'FleetNav',
  computed: {
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    ownUserPath() {
      return ownFleetUserPath(useAuthStore().username);
    },
    isOwnActive() {
      const own = this.ownUserPath.toLowerCase();
      const path = (this.$route?.path || '').toLowerCase();
      return path === own || path.startsWith(`${own}/`);
    },
  },
  methods: {
    hasPage(key) {
      return useAuthStore().allowedPages.includes(key);
    },
  },
};
</script>
