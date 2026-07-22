<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('User') }} {{ username }}
      div.text-muted.small(v-if="user")
        | {{ deviceCountLabel }}
    div.fleet-user-actions.ml-auto
      b-form-select.fleet-user-select(
        size="sm"
        :value="username"
        :options="userOptions"
        :aria-label="$tr('Select user')"
        @change="selectUser"
      )
      b-button(size="sm" variant="outline-dark" @click="refresh")
        | {{ $tr('Refresh') }}

  b-card.mb-3
    div.row
      div.col-md-4
        label.small.text-muted(for="fleet-user-start") {{ $tr('Start') }}
        input#fleet-user-start.form-control(type="date" v-model="startDate")
      div.col-md-4.mt-2.mt-md-0
        label.small.text-muted(for="fleet-user-end") {{ $tr('End') }}
        input#fleet-user-end.form-control(type="date" v-model="endDate")
      div.col-md-4.mt-3.mt-md-4
        b-button(variant="primary" @click="refresh")
          | {{ $tr('Apply range') }}
    div.mt-3(v-if="user && user.available_devices.length")
      div.d-flex.align-items-center.mb-2
        div.small.text-muted
          | {{ $tr('Devices included in this summary') }}
        b-button.ml-auto(size="sm" variant="outline-secondary" @click="selectAllDevices")
          | {{ $tr('All devices') }}
      div.small.text-muted.mb-2
        | {{ selectedDeviceLabel }}
      b-form-checkbox-group(
        v-model="selectedDeviceIds"
        :options="deviceOptions"
        stacked
      )

  b-alert(show variant="info" v-if="!user")
    | {{ $tr('No data found for this user.') }}

  fleet-activity-summary(v-if="user" :user="user")

  div.row(v-if="user")
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Active') }}
        h4.mb-0 {{ user.totals.active_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('AFK') }}
        h4.mb-0 {{ user.totals.afk_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Locked') }}
        h4.mb-0 {{ user.totals.locked_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Disconnected') }}
        h4.mb-0 {{ user.totals.disconnected_seconds | friendlyduration }}

  b-card.mb-3(v-if="user")
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('App Time') }}
      column-order-editor.ml-auto(
        :table-key="tableKeys.apps"
        :fields="defaultAppFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="user.apps"
      :fields="appFields"
      :empty-text="$tr('No app data found in the selected range')"
    )
      template(v-slot:cell(devices)="data")
        | {{ formatDeviceList(data.item.devices) }}
      template(v-slot:cell(active_seconds)="data")
        | {{ data.item.active_seconds | friendlyduration }}
      template(v-slot:cell(afk_seconds)="data")
        | {{ data.item.afk_seconds | friendlyduration }}
      template(v-slot:cell(seconds)="data")
        | {{ data.item.seconds | friendlyduration }}

  b-card(v-if="user")
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Live Sessions') }}
      column-order-editor.ml-auto(
        :table-key="tableKeys.sessions"
        :fields="defaultSessionFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="user.sessions"
      :fields="sessionFields"
      :empty-text="$tr('No live sessions for this user')"
    )
      template(v-slot:cell(device_name)="data")
        router-link(:to="'/fleet/devices/' + data.item.device_id")
          | {{ data.item.device_name || data.item.device_id }}
      template(v-slot:cell(state)="data")
        b-badge(:variant="stateVariant(data.item.state)")
          | {{ $tr(data.item.state) }}
      template(v-slot:cell(last_updated)="data")
        span(v-if="data.item.last_updated") {{ data.item.last_updated | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import moment from 'moment';

import { useSettingsStore } from '~/stores/settings';
import { useFleetStore } from '~/stores/fleet';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetUser',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-activity-summary': () => import('~/views/fleet/FleetActivitySummary.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  props: {
    username: String,
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      startDate: moment().format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      selectedDeviceIds: [],
      tableKeys: {
        apps: 'fleet-user-apps',
        sessions: 'fleet-user-sessions',
      },
    };
  },
  computed: {
    defaultAppFields() {
      return [
        { key: 'app', label: this.$tr('App'), sortable: true },
        { key: 'devices', label: this.$tr('Devices') },
        { key: 'active_seconds', label: this.$tr('Active time'), sortable: true },
        { key: 'afk_seconds', label: this.$tr('AFK time'), sortable: true },
        { key: 'seconds', label: this.$tr('Time'), sortable: true },
      ];
    },
    appFields() {
      return orderFields(
        this.defaultAppFields,
        this.settingsStore.columnOrdersData?.[this.tableKeys.apps]
      );
    },
    defaultSessionFields() {
      return [
        { key: 'device_name', label: this.$tr('Device'), sortable: true },
        { key: 'session_id', label: this.$tr('Session'), sortable: true },
        { key: 'state', label: this.$tr('State'), sortable: true },
        { key: 'current_app', label: this.$tr('Current app') },
        { key: 'last_updated', label: this.$tr('Updated'), sortable: true },
      ];
    },
    sessionFields() {
      return orderFields(
        this.defaultSessionFields,
        this.settingsStore.columnOrdersData?.[this.tableKeys.sessions]
      );
    },
    user() {
      return this.fleetStore.userDetails[this.username] || null;
    },
    userOptions() {
      const usersByName = new Map();

      for (const user of this.fleetStore.users || []) {
        if (!user || !user.username) {
          continue;
        }
        usersByName.set(user.username, {
          value: user.username,
          text: user.username,
        });
      }

      if (this.username && !usersByName.has(this.username)) {
        usersByName.set(this.username, {
          value: this.username,
          text: this.username,
        });
      }

      return Array.from(usersByName.values()).sort((left, right) =>
        left.text.localeCompare(right.text)
      );
    },
    deviceCountLabel() {
      if (!this.user) {
        return '';
      }
      return this.$tr('{count} device(s)', { count: this.user.devices.length });
    },
    deviceOptions() {
      if (!this.user) {
        return [];
      }
      return this.user.available_devices.map(device => ({
        value: device.device_id,
        text:
          device.device_name && device.device_name !== device.device_id
            ? `${device.device_name} (${device.device_id})`
            : device.device_id,
      }));
    },
    selectedDeviceLabel() {
      if (!this.user) {
        return '';
      }
      const total = this.user.available_devices.length;
      const selected = this.isAllDevicesSelected() ? total : this.selectedDeviceIds.length;
      return this.$tr('{selected} of {total} device(s) selected', { selected, total });
    },
  },
  watch: {
    username: async function () {
      await this.refresh();
    },
  },
  async mounted() {
    await this.loadUsers();
    await this.refresh();
  },
  methods: {
    async loadUsers() {
      await this.fleetStore.loadUsers();
    },
    selectUser(username) {
      if (!username || username === this.username) {
        return;
      }

      this.$router.push(`/fleet/users/${encodeURIComponent(username)}`);
    },
    isAllDevicesSelected() {
      if (!this.user || this.user.available_devices.length === 0) {
        return true;
      }
      return (
        this.selectedDeviceIds.length === 0 ||
        this.selectedDeviceIds.length === this.user.available_devices.length
      );
    },
    selectAllDevices() {
      if (!this.user) {
        this.selectedDeviceIds = [];
        return;
      }
      this.selectedDeviceIds = this.user.available_devices.map(device => device.device_id);
    },
    buildParams() {
      const params: Record<string, string> = {
        start: moment(this.startDate).startOf('day').toISOString(),
        end: moment(this.endDate).endOf('day').toISOString(),
      };
      if (!this.isAllDevicesSelected()) {
        params.device_ids = this.selectedDeviceIds.join(',');
      }
      return params;
    },
    async refresh() {
      const user = await this.fleetStore.loadUser(this.username, this.buildParams());
      this.selectedDeviceIds = user.selected_devices || [];
    },
    formatDeviceList(deviceIds) {
      if (!this.user || !deviceIds || deviceIds.length === 0) {
        return '—';
      }
      const namesById = Object.fromEntries(
        this.user.available_devices.map(device => [device.device_id, device.device_name])
      );
      return deviceIds
        .map(deviceId => {
          const name = namesById[deviceId];
          if (name && name !== deviceId) {
            return name;
          }
          return deviceId;
        })
        .join(', ');
    },
    stateVariant(state) {
      const variants = {
        active: 'success',
        afk: 'warning',
        locked: 'warning',
        disconnected: 'secondary',
        logged_in: 'info',
        no_session: 'dark',
      };
      return variants[state] || 'light';
    },
  },
};
</script>

<style scoped lang="scss">
.fleet-user-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fleet-user-select {
  width: min(18rem, 42vw);
}

@media (max-width: 575.98px) {
  .fleet-user-actions {
    margin-top: 0.75rem;
    width: 100%;
  }

  .fleet-user-select {
    flex: 1 1 auto;
    width: auto;
  }
}
</style>
