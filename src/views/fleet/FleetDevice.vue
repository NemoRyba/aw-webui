<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Device') }} {{ device ? device.device_name : device_id }}
      div.text-muted.small(v-if="device && device.last_updated")
        | {{ $tr('Last updated') }} {{ device.last_updated | friendlytime }}
    b-button.ml-auto(size="sm" variant="outline-dark" @click="refresh")
      | {{ $tr('Refresh') }}

  b-card.mb-3
    div.row
      div.col-md-4
        label.small.text-muted(for="fleet-device-start") {{ $tr('Start') }}
        input#fleet-device-start.form-control(type="date" v-model="startDate")
      div.col-md-4.mt-2.mt-md-0
        label.small.text-muted(for="fleet-device-end") {{ $tr('End') }}
        input#fleet-device-end.form-control(type="date" v-model="endDate")
      div.col-md-4.mt-3.mt-md-4
        b-button(variant="primary" @click="refresh")
          | {{ $tr('Apply range') }}
    div.mt-3
      b-form-checkbox(
        v-model="excludeInactiveSessionAfk"
        @change="refresh"
      )
        | {{ $tr('Only count AFK while session is active') }}
      div.small.text-muted.ml-4
        | {{ $tr('AFK during locked, disconnected, logged-in-only, or unavailable sessions is excluded from the AFK totals.') }}

  b-alert(show variant="info" v-if="!device")
    | {{ $tr('No data found for this device.') }}

  div.row(v-if="device")
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Active') }}
        h4.mb-0 {{ device.totals.active_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('AFK') }}
        h4.mb-0 {{ device.totals.afk_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Locked') }}
        h4.mb-0 {{ device.totals.locked_seconds | friendlyduration }}
    div.col-md-3.mb-3
      b-card
        div.text-muted.small {{ $tr('Disconnected') }}
        h4.mb-0 {{ device.totals.disconnected_seconds | friendlyduration }}

  b-card.mb-3(v-if="device")
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
      :items="device.apps"
      :fields="appFields"
      :empty-text="$tr('No app data found in the selected range')"
    )
      template(v-slot:cell(active_seconds)="data")
        | {{ data.item.active_seconds | friendlyduration }}
      template(v-slot:cell(afk_seconds)="data")
        | {{ data.item.afk_seconds | friendlyduration }}
      template(v-slot:cell(seconds)="data")
        | {{ data.item.seconds | friendlyduration }}

  b-card(v-if="device")
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
      :items="device.sessions"
      :fields="sessionFields"
      :empty-text="$tr('No live sessions for this device')"
    )
      template(v-slot:cell(username)="data")
        router-link(:to="'/fleet/users/' + data.item.username")
          | {{ data.item.username }}
      template(v-slot:cell(state)="data")
        b-badge(:variant="stateVariant(data.item.state)")
          | {{ $tr(data.item.state) }}
      template(v-slot:cell(last_updated)="data")
        span(v-if="data.item.last_updated") {{ data.item.last_updated | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import moment from 'moment';

import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetDevice',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  props: {
    device_id: String,
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      startDate: moment().subtract(6, 'days').format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      tableKeys: {
        apps: 'fleet-device-apps',
        sessions: 'fleet-device-sessions',
      },
    };
  },
  computed: {
    defaultAppFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'app', label: this.$tr('App'), sortable: true },
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
        { key: 'username', label: this.$tr('Username'), sortable: true },
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
    device() {
      return this.fleetStore.deviceDetails[this.device_id] || null;
    },
    excludeInactiveSessionAfk: {
      get() {
        return this.settingsStore.fleetSummaryExcludeInactiveSessionAfk;
      },
      set(value) {
        this.settingsStore.update({ fleetSummaryExcludeInactiveSessionAfk: Boolean(value) });
      },
    },
  },
  watch: {
    device_id: async function () {
      await this.refresh();
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    buildParams() {
      return {
        start: moment(this.startDate).startOf('day').toISOString(),
        end: moment(this.endDate).endOf('day').toISOString(),
        exclude_inactive_session_afk: this.excludeInactiveSessionAfk ? 'true' : 'false',
      };
    },
    async refresh() {
      await this.fleetStore.loadDevice(this.device_id, this.buildParams());
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
