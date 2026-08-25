<template lang="pug">
div
  h5.mt-1.mb-2 {{ $tr('Landing page') }}
  b-alert(v-if="error" show variant="danger")
    | {{ error }}
  div.row(v-if="loaded")
    div.col-md-6.mb-2
      label.small.text-muted(for="landing-page-admin") {{ $tr('Landing page (admins)') }}
      b-select#landing-page-admin(
        size="sm"
        :value="adminUiStore.landingPageAdmin"
        :disabled="saving"
        @change="save('landingPageAdmin', $event)"
      )
        option(v-for="option in adminOptions" :key="option.value" :value="option.value")
          | {{ option.text }}
    div.col-md-6.mb-2
      label.small.text-muted(for="landing-page-user") {{ $tr('Landing page (users)') }}
      b-select#landing-page-user(
        size="sm"
        :value="adminUiStore.landingPageUser"
        :disabled="saving"
        @change="save('landingPageUser', $event)"
      )
        option(v-for="option in userOptions" :key="option.value" :value="option.value")
          | {{ option.text }}
  div(v-else)
    .aw-loading {{ $tr('Loading...') }}
  small
    | {{ $tr('The page to open when opening ActivityWatch, or clicking the logo in the top menu. Users only get pages they can see.') }}
</template>

<script lang="ts">
import { useAdminUiStore } from '~/stores/adminUi';
import { ADMIN_LANDING_PAGES, USER_LANDING_PAGES } from '~/util/landingPage';

export default {
  name: 'LandingPageSettings',
  data: () => {
    return {
      adminUiStore: useAdminUiStore(),
      loaded: false,
      saving: false,
      error: '',
    };
  },
  computed: {
    pageLabels() {
      return {
        '/fleet': this.$tr('Live'),
        '/fleet/summary': this.$tr('Zusammenfassung'),
        '/fleet/users': this.$tr('Users'),
        '/fleet/devices': this.$tr('Devices'),
        '/timeline': this.$tr('Timeline'),
        '/buckets': this.$tr('Raw Data'),
      };
    },
    adminOptions() {
      return ADMIN_LANDING_PAGES.map(value => ({ value, text: this.pageLabels[value] || value }));
    },
    userOptions() {
      // For non-admins every fleet path resolves to their own user view.
      const userLabels = { '/fleet': this.$tr('My evaluation') };
      return USER_LANDING_PAGES.map(value => ({
        value,
        text: userLabels[value] || this.pageLabels[value] || value,
      }));
    },
  },
  async mounted() {
    await this.adminUiStore.ensureLoaded();
    this.loaded = true;
  },
  methods: {
    async save(key, value) {
      this.saving = true;
      this.error = '';
      try {
        await this.adminUiStore.update({ [key]: value });
      } catch (e) {
        console.error('Unable to save landing page config:', e);
        this.error = this.$tr('Unable to save admin settings');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
