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
        v-if="canBrowseUsers"
        size="sm"
        :value="username"
        :options="userOptions"
        :aria-label="$tr('Select user')"
        @change="selectUser"
      )
      b-button(size="sm" variant="outline-dark" @click="refresh" :disabled="loading")
        b-spinner.mr-1(v-if="loading" small)
        | {{ loading ? loadingLabel : $tr('Refresh') }}
      b-button(
        size="sm"
        variant="outline-dark"
        @click="recalculateSummary"
        :disabled="summaryRecalculating || loading"
      )
        icon(name="sync")
        span.ml-1 {{ summaryRecalculating ? $tr('Calculating...') : $tr('Recalculate') }}

  b-card.mb-3
    div.fleet-user-range-shortcuts.mb-2
      b-button-group(size="sm")
        b-button(
          variant="outline-secondary"
          :title="$tr('Previous day')"
          @click="shiftRangeDays(-1)"
        )
          icon(name="arrow-left")
          span.ml-1 {{ $tr('Previous day') }}
        b-button(
          variant="outline-secondary"
          :title="$tr('Next day')"
          :disabled="!canShiftNextDay"
          @click="shiftRangeDays(1)"
        )
          span.mr-1 {{ $tr('Next day') }}
          icon(name="arrow-right")
    div.row
      div.col-md-4
        label.small.text-muted(for="fleet-user-start") {{ $tr('Start') }}
        input#fleet-user-start.form-control(type="date" v-model="startDate")
      div.col-md-4.mt-2.mt-md-0
        label.small.text-muted(for="fleet-user-end") {{ $tr('End') }}
        input#fleet-user-end.form-control(type="date" v-model="endDate")
      div.col-md-4.mt-3.mt-md-4
        div.fleet-user-range-actions
          b-button(variant="primary" @click="refresh" :disabled="loading")
            b-spinner.mr-1(v-if="loading" small)
            | {{ loading ? loadingLabel : $tr('Apply range') }}
          b-button(
            v-if="loading"
            variant="outline-secondary"
            @click="cancelUserLoad"
          )
            | {{ $tr('Cancel') }}
    div.mt-3(v-if="loading && loadProgress && loadProgress.total_days > 0")
      b-progress(
        :value="loadProgress.days_done"
        :max="loadProgress.total_days"
        height="0.45rem"
        animated
      )
      div.small.text-muted.mt-1 {{ progressDetailLine }}
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
  b-alert(show variant="info" v-if="!user && !loading && !loadError && !loadCancelled")
    | {{ $tr('No data found for this user.') }}
  b-alert(show variant="danger" v-if="loadError")
    | {{ loadError }}
  b-alert(show variant="warning" v-if="loadCancelled")
    | {{ $tr('Loading cancelled') }}

  fleet-activity-summary(
    v-if="user"
    :user="user"
    :prefer-backend-session-totals="!!user.summary_cache"
  )

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
import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/sync';

import { useSettingsStore } from '~/stores/settings';
import { useAuthStore } from '~/stores/auth';
import { useFleetStore } from '~/stores/fleet';
import { getClient } from '~/util/awclient';
import { applyColumnPreferences } from '~/util/columnOrder';

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
      startDate: this.validQueryDate(this.$route?.query?.start) || moment().format('YYYY-MM-DD'),
      endDate:
        this.validQueryDate(this.$route?.query?.end) ||
        this.validQueryDate(this.$route?.query?.start) ||
        moment().format('YYYY-MM-DD'),
      selectedDeviceIds: [],
      userRequestId: 0,
      summaryRecalculating: false,
      loading: false,
      loadError: '',
      loadCancelled: false,
      loadElapsedSeconds: 0,
      loadElapsedTimer: null,
      loadProgress: null,
      progressSamples: [],
      progressPolling: false,
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
      return applyColumnPreferences(this.defaultAppFields, this.settingsStore, this.tableKeys.apps);
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
      return applyColumnPreferences(this.defaultSessionFields, this.settingsStore, this.tableKeys.sessions);
    },
    user() {
      return this.fleetStore.userDetails[this.username] || null;
    },
    authIsAdmin() {
      return useAuthStore().isAdmin;
    },
    canBrowseUsers() {
      const authStore = useAuthStore();
      return authStore.isAdmin || authStore.allowedPages.includes('fleet-users');
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
    canShiftNextDay() {
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!end.isValid()) {
        return false;
      }
      return end.isBefore(moment().startOf('day'), 'day');
    },
    loadingLabel() {
      const base =
        this.loadElapsedSeconds > 0
          ? `${this.$tr('Loading...')} ${this.loadElapsedSeconds}s`
          : this.$tr('Loading...');
      if (this.loadProgress && this.loadProgress.total_days > 0) {
        return `${base} (${this.loadProgress.days_done}/${this.loadProgress.total_days})`;
      }
      return base;
    },
    progressEtaSeconds() {
      const progress = this.loadProgress;
      const samples = this.progressSamples;
      if (!progress || samples.length < 2) {
        return null;
      }
      const first = samples[0];
      const last = samples[samples.length - 1];
      const advanced = last.done - first.done;
      const elapsedMs = last.t - first.t;
      if (advanced <= 0 || elapsedMs <= 0) {
        return null;
      }
      const remaining = Math.max(0, Number(progress.total_days || 0) - last.done);
      if (remaining === 0) {
        return 0;
      }
      const secondsPerDay = elapsedMs / 1000 / advanced;
      return Math.round(remaining * secondsPerDay);
    },
    progressDetailLine() {
      const progress = this.loadProgress;
      if (!progress || !progress.total_days) {
        return '';
      }
      const parts = [
        this.$tr('Day {done} of {total} loaded', {
          done: progress.days_done,
          total: progress.total_days,
        }),
      ];
      if (progress.current_day) {
        parts.push(progress.current_day);
      }
      const eta = this.progressEtaSeconds;
      if (eta !== null && eta > 5) {
        const minutes = Math.floor(eta / 60);
        const seconds = eta % 60;
        parts.push(
          `${this.$tr('approx. {time} remaining', {
            time: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
          })}`
        );
      }
      return parts.join(' — ');
    },
  },
  watch: {
    username: async function () {
      this.syncDatesFromQuery();
      await this.refresh();
    },
    '$route.query': function (newQuery, oldQuery) {
      if (
        (newQuery?.start || '') !== (oldQuery?.start || '') ||
        (newQuery?.end || '') !== (oldQuery?.end || '')
      ) {
        if (this.syncDatesFromQuery()) {
          this.refresh();
        }
      }
    },
  },
  async mounted() {
    if (this.canBrowseUsers) {
      await this.loadUsers();
    }
    await this.refresh();
  },
  beforeDestroy() {
    this.stopLoadTimer();
  },
  methods: {
    validQueryDate(value) {
      if (typeof value !== 'string') {
        return null;
      }
      return moment(value, 'YYYY-MM-DD', true).isValid() ? value : null;
    },
    syncDatesFromQuery() {
      const start = this.validQueryDate(this.$route?.query?.start);
      const end = this.validQueryDate(this.$route?.query?.end) || start;
      if (!start) {
        return false;
      }
      if (this.startDate === start && this.endDate === end) {
        return false;
      }
      this.startDate = start;
      this.endDate = end;
      return true;
    },
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
    async shiftRangeDays(days) {
      const start = moment(this.startDate);
      const end = moment(this.endDate);
      if (!start.isValid() || !end.isValid()) {
        return;
      }
      if (days > 0 && !this.canShiftNextDay) {
        return;
      }

      this.startDate = start.add(days, 'days').format('YYYY-MM-DD');
      this.endDate = end.add(days, 'days').format('YYYY-MM-DD');
      await this.refresh();
    },
    buildParams() {
      const start = this.rangeBoundary(this.startDate);
      const end = this.rangeBoundary(this.endDate).add(1, 'day');
      const params: Record<string, string> = {
        start: start.toISOString(),
        end: end.toISOString(),
      };
      if (!this.isAllDevicesSelected()) {
        params.device_ids = this.selectedDeviceIds.join(',');
      }
      params.exclude_inactive_session_afk = 'true';
      return params;
    },
    rangeBoundary(date) {
      const [hour, minute] = String(this.settingsStore.startOfDay || '04:00')
        .split(':')
        .map(value => Number(value));
      return moment(date)
        .hour(Number.isFinite(hour) ? hour : 4)
        .minute(Number.isFinite(minute) ? minute : 0)
        .second(0)
        .millisecond(0);
    },
    startLoadTimer() {
      this.stopLoadTimer();
      this.loadElapsedSeconds = 0;
      this.loadProgress = null;
      this.progressSamples = [];
      this.loadElapsedTimer = window.setInterval(() => {
        this.loadElapsedSeconds += 1;
        if (this.loadElapsedSeconds % 2 === 0) {
          this.pollLoadProgress();
        }
      }, 1000);
    },
    async pollLoadProgress() {
      // One tiny GET (an in-memory lookup server-side) every 2s while loading.
      if (!this.loading || this.progressPolling) {
        return;
      }
      this.progressPolling = true;
      try {
        const progress = await this.fleetStore.loadUserSummaryProgress(
          this.username,
          this.buildParams()
        );
        if (!this.loading) {
          return;
        }
        if (progress && progress.total_days > 0) {
          this.loadProgress = progress;
          const done = Number(progress.days_done || 0);
          const last = this.progressSamples[this.progressSamples.length - 1];
          if (!last || last.done !== done) {
            this.progressSamples.push({ t: Date.now(), done });
            if (this.progressSamples.length > 30) {
              this.progressSamples.shift();
            }
          }
        }
      } catch (error) {
        // Progress is best-effort; never disturb the main load because of it.
      } finally {
        this.progressPolling = false;
      }
    },
    stopLoadTimer() {
      if (this.loadElapsedTimer) {
        window.clearInterval(this.loadElapsedTimer);
        this.loadElapsedTimer = null;
      }
    },
    isCancelledError(error) {
      const message = String(error?.message || error || '').toLowerCase();
      return (
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError' ||
        message.includes('cancel') ||
        message.includes('abort')
      );
    },
    cancelUserLoad() {
      // Invalidate any in-flight request so its response is ignored.
      this.userRequestId += 1;
      this.loadCancelled = true;
      this.loading = false;
      this.stopLoadTimer();
      const client = getClient();
      if (typeof client.abort === 'function') {
        client.abort('Fleet user load cancelled');
      } else if (client.controller) {
        client.controller.abort();
      }
    },
    async refresh() {
      // NOTE: no early-return while loading. Clicking "Next day" during a load
      // must start a fresh request for the NEW date — the old blocking guard
      // silently skipped the reload and left the previous day's data on
      // screen. Overlapping requests are resolved latest-wins instead.
      const requestId = ++this.userRequestId;

      // Keep the URL in sync so reload/back restores the same day.
      const query = { ...this.$route.query, start: this.startDate, end: this.endDate };
      if (query.start !== this.$route.query.start || query.end !== this.$route.query.end) {
        this.$router.replace({ query }).catch(() => undefined);
      }

      this.loading = true;
      this.loadError = '';
      this.loadCancelled = false;
      this.startLoadTimer();
      try {
        const user = await this.fleetStore.loadUser(this.username, this.buildParams());
        if (requestId !== this.userRequestId) {
          return;
        }
        this.selectedDeviceIds = user.selected_devices || [];
      } catch (error) {
        if (requestId !== this.userRequestId) {
          return;
        }
        if (this.isCancelledError(error)) {
          this.loadCancelled = true;
          return;
        }
        console.error('Unable to load fleet user:', error);
        this.loadError = this.$tr('Unable to load user data');
      } finally {
        if (requestId === this.userRequestId) {
          this.loading = false;
          this.stopLoadTimer();
        }
      }
    },
    async recalculateSummary() {
      this.summaryRecalculating = true;
      try {
        await this.fleetStore.recalculateUserSummary(this.username, this.buildParams());
        await this.refresh();
      } finally {
        this.summaryRecalculating = false;
      }
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

.fleet-user-range-shortcuts {
  display: flex;
  justify-content: flex-start;
}

.fleet-user-range-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

  .fleet-user-range-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
