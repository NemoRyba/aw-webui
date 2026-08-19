<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Landing page') }}
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/fleet") {{ $tr('Fleet') }}
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames")
          | {{ $tr('Activity') }} ({{hostname}})
        option(value="/timeline") {{ $tr('Timeline') }}
      span(v-else)
        .aw-loading {{ $tr('Loading...') }}
  small
    | {{ $tr('The page to open when opening ActivityWatch, or clicking the logo in the top menu.') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getSettingsLandingPage, normalizeLandingPage } from '~/util/landingPage';

export default {
  name: 'LandingPageSettings',
  data: () => {
    return {
      bucketsStore: useBucketsStore(),

      loaded: false,
    };
  },
  computed: {
    landingpage: {
      get: function () {
        const settingsStore = useSettingsStore();
        return getSettingsLandingPage(settingsStore);
      },
      set: function (val) {
        const settingsStore = useSettingsStore();
        settingsStore.update({ landingpage: normalizeLandingPage(val) });
      },
    },
    hostnames() {
      return this.bucketsStore.hosts;
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.loaded = true;
  },
};
</script>
