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
    div.d-flex.align-items-start.mb-3
      div
        h5.mb-0 {{ $tr('Server storage') }}
        div.text-muted.small(v-if="storage")
          | {{ $tr('Calculated') }} {{ storage.generated_at | friendlytime }}
      b-button.ml-auto(
        size="sm"
        variant="outline-secondary"
        @click="refreshStorage(true)"
        :disabled="storageLoading"
      )
        | {{ $tr('Recalculate') }}
    b-alert(show variant="warning" v-if="storageError")
      | {{ storageError }}
    div(v-if="storage")
      div.fleet-storage-grid.mb-3
        div.fleet-storage-metric
          div.text-muted.small {{ $tr('ActivityWatch data') }}
          div.fleet-storage-value {{ formatBytes(storage.data_size_bytes) }}
        div.fleet-storage-metric
          div.text-muted.small {{ $tr('Disk size') }}
          div.fleet-storage-value {{ formatBytes(storage.disk_total_bytes) }}
        div.fleet-storage-metric
          div.text-muted.small {{ $tr('Free disk space') }}
          div.fleet-storage-value {{ formatBytes(storage.disk_free_bytes) }}
      b-progress.mb-2(:max="storage.disk_total_bytes" height="0.75rem")
        b-progress-bar(:value="storage.disk_used_bytes" :variant="diskUsageVariant")
      div.d-flex.small.text-muted
        div
          | {{ $tr('Disk used') }}: {{ formatBytes(storage.disk_used_bytes) }} ({{ diskUsagePercent }}%)
        div.ml-auto
          | {{ $tr('Data path') }}:
          code.ml-1.fleet-storage-path {{ storage.data_dir }}
    div.text-muted(v-else-if="storageLoading")
      | {{ $tr('Loading...') }}

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
      storageLoading: false,
      storageError: '',
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
    storage() {
      return this.fleetStore.storage;
    },
    diskUsagePercent() {
      if (!this.storage || !this.storage.disk_total_bytes) {
        return 0;
      }
      return Math.round((this.storage.disk_used_bytes / this.storage.disk_total_bytes) * 100);
    },
    diskUsageVariant() {
      if (this.diskUsagePercent >= 90) {
        return 'danger';
      }
      if (this.diskUsagePercent >= 80) {
        return 'warning';
      }
      return 'success';
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
    await this.refreshStorage(false);
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
    async refreshStorage(force) {
      this.storageLoading = true;
      this.storageError = '';
      try {
        await this.fleetStore.loadStorage({
          force,
          startOfDay: this.settingsStore.startOfDay,
        });
      } catch (error) {
        console.error(error);
        this.storageError = this.$tr('Unable to load server storage');
      } finally {
        this.storageLoading = false;
      }
    },
    formatBytes(bytes) {
      const value = Number(bytes || 0);
      if (value < 1024) {
        return `${value} B`;
      }
      const units = ['KB', 'MB', 'GB', 'TB'];
      let size = value / 1024;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
      }
      return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unitIndex]}`;
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

<style scoped lang="scss">
.fleet-storage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.fleet-storage-metric {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.45rem;
  background: rgba(127, 127, 127, 0.05);
}

.fleet-storage-value {
  font-size: 1.25rem;
  font-weight: 600;
}

.fleet-storage-path {
  word-break: break-all;
}

@media (max-width: 767.98px) {
  .fleet-storage-grid {
    grid-template-columns: 1fr;
  }
}
</style>
