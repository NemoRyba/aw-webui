<template lang="pug">
div.container(style="color: #555; font-size: 0.9em")
  div.mb-2
    div
      span.mt-2(v-if="info", style="color: #888; font-size: 0.8em")
        span.mr-2
          b {{ $tr('Host:') }}
          | &nbsp; {{info.hostname}}
        span
          b {{ $tr('Version:') }}
          | &nbsp; {{info.version}}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Footer',
  computed: {
    ...mapState(useServerStore, ['info']),
  },
};
</script>
