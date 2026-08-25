<template lang="pug">
div
  h4.mb-3 Developer settings
  b-alert(show) #[b Note:] These settings are meant for developers who (hopefully) know what they are doing, and as such, may break things unexpectedly.

  b-form-group(label="Request timeout" label-cols-md=3 description="The maximum amount of time a server request can take before timing out. Setting this to a high value can be useful for large queries. Note that you need to reload the web UI for it to apply.")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  div
    | Web UI commit hash: {{ COMMIT_HASH }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  data() {
    return {
      showSettings: false,
    };
  },
  computed: {
    requestTimeout: {
      get() {
        return useSettingsStore().requestTimeout;
      },
      set(requestTimeout) {
        useSettingsStore().update({ requestTimeout });
      },
    },
  },
};
</script>
