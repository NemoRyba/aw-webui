<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Devices') }}
      div.text-muted.small
        | {{ $tr('Devices grouped across all reported sessions') }}
    b-button.ml-auto(size="sm" variant="outline-dark" @click="refresh")
      | {{ $tr('Refresh') }}

  b-card
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Devices') }}
      column-order-editor.ml-auto(
        :table-key="tableKey"
        :fields="defaultFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="devices"
      :fields="fields"
      :empty-text="$tr('No devices found')"
    )
      template(v-slot:cell(device_name)="data")
        router-link(:to="'/fleet/devices/' + data.item.device_id")
          | {{ data.item.device_name || data.item.device_id }}
      template(v-slot:cell(status)="data")
        b-badge(:variant="stateVariant(data.item.status)")
          | {{ $tr(data.item.status) }}
      template(v-slot:cell(users)="data")
        | {{ data.item.users.length ? data.item.users.join(', ') : '—' }}
      template(v-slot:cell(last_seen)="data")
        span(v-if="data.item.last_seen") {{ data.item.last_seen | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetDevices',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      tableKey: 'fleet-devices-list',
    };
  },
  computed: {
    defaultFields() {
      return [
        { key: 'device_name', label: this.$tr('Device'), sortable: true },
        { key: 'status', label: this.$tr('Status'), sortable: true },
        { key: 'users', label: this.$tr('Users') },
        { key: 'session_count', label: this.$tr('Sessions'), sortable: true },
        { key: 'last_seen', label: this.$tr('Last seen'), sortable: true },
      ];
    },
    fields() {
      return orderFields(this.defaultFields, this.settingsStore.columnOrdersData?.[this.tableKey]);
    },
    devices() {
      return this.fleetStore.devices;
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      await this.fleetStore.loadDevices();
    },
    stateVariant(state) {
      return state === 'online' ? 'success' : 'secondary';
    },
  },
};
</script>
