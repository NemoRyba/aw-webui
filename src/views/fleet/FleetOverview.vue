<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Live devices') }}
      div.text-muted.small(v-if="live")
        | {{ $tr('Generated') }} {{ live.generated_at | friendlytime }}
    b-button.ml-auto(size="sm" variant="outline-dark" @click="refresh")
      | {{ $tr('Refresh') }}

  b-alert(show variant="info" v-if="!live || (live.users.length === 0 && live.devices.length === 0)")
    | {{ $tr('No watcher data found yet. Start `aw-watcher-session`, `aw-watcher-afk`, and `aw-watcher-window` in central mode to populate this view.') }}

  b-card.mb-3
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Live Sessions') }}
      column-order-editor.ml-auto(
        :table-key="tableKeys.liveUsers"
        :fields="defaultUserFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="liveUsers"
      :fields="userFields"
      :empty-text="$tr('No live sessions found')"
    )
      template(v-slot:cell(username)="data")
        router-link(:to="'/fleet/users/' + data.item.username")
          | {{ data.item.username }}
      template(v-slot:cell(device_name)="data")
        router-link(:to="'/fleet/devices/' + data.item.device_id")
          | {{ data.item.device_name || data.item.device_id }}
      template(v-slot:cell(state)="data")
        b-badge(:variant="stateVariant(data.item.state)")
          | {{ $tr(data.item.state) }}
      template(v-slot:cell(current_app)="data")
        div
          div {{ data.item.current_app || '—' }}
          small.text-muted(v-if="data.item.current_title") {{ data.item.current_title }}
      template(v-slot:cell(last_updated)="data")
        span(v-if="data.item.last_updated") {{ data.item.last_updated | friendlytime }}
        span(v-else) —

  b-card
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Devices') }}
      column-order-editor.ml-auto(
        :table-key="tableKeys.devices"
        :fields="defaultDeviceFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="liveDevices"
      :fields="deviceFields"
      :empty-text="$tr('No devices found')"
    )
      template(v-slot:cell(device_name)="data")
        router-link(:to="'/fleet/devices/' + data.item.device_id")
          | {{ data.item.device_name || data.item.device_id }}
      template(v-slot:cell(status)="data")
        b-badge(:variant="stateVariant(data.item.status)")
          | {{ $tr(data.item.status) }}
      template(v-slot:cell(users_logged_in)="data")
        | {{ data.item.users_logged_in.length ? data.item.users_logged_in.join(', ') : '—' }}
      template(v-slot:cell(last_updated)="data")
        span(v-if="data.item.last_updated") {{ data.item.last_updated | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetOverview',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      refreshHandle: null,
      tableKeys: {
        liveUsers: 'fleet-overview-live-users',
        devices: 'fleet-overview-devices',
      },
    };
  },
  computed: {
    live() {
      return this.fleetStore.live;
    },
    defaultUserFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'device_name', label: this.$tr('Device'), sortable: true },
        { key: 'session_id', label: this.$tr('Session'), sortable: true },
        { key: 'state', label: this.$tr('State'), sortable: true },
        { key: 'afk_status', label: this.$tr('AFK'), sortable: true },
        { key: 'current_app', label: this.$tr('Current app') },
        { key: 'last_updated', label: this.$tr('Updated'), sortable: true },
      ];
    },
    userFields() {
      return orderFields(
        this.defaultUserFields,
        this.settingsStore.columnOrdersData?.[this.tableKeys.liveUsers]
      );
    },
    defaultDeviceFields() {
      return [
        { key: 'device_name', label: this.$tr('Device'), sortable: true },
        { key: 'status', label: this.$tr('Status'), sortable: true },
        { key: 'users_logged_in', label: this.$tr('Users') },
        { key: 'last_updated', label: this.$tr('Updated'), sortable: true },
      ];
    },
    deviceFields() {
      return orderFields(
        this.defaultDeviceFields,
        this.settingsStore.columnOrdersData?.[this.tableKeys.devices]
      );
    },
    liveUsers() {
      return this.live ? this.live.users : [];
    },
    liveDevices() {
      return this.live ? this.live.devices : [];
    },
  },
  async mounted() {
    await this.refresh();
    this.refreshHandle = window.setInterval(() => this.refresh(), 10000);
  },
  beforeDestroy() {
    if (this.refreshHandle) {
      clearInterval(this.refreshHandle);
    }
  },
  methods: {
    async refresh() {
      await this.fleetStore.loadLive();
    },
    stateVariant(state) {
      const variants = {
        active: 'success',
        online: 'success',
        afk: 'warning',
        locked: 'warning',
        disconnected: 'secondary',
        stale: 'secondary',
        logged_in: 'info',
        no_session: 'dark',
      };
      return variants[state] || 'light';
    },
  },
};
</script>
