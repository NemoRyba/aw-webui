<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Fleet summary pre-calculation') }}
      small.text-muted {{ $tr('Day boundary') }}: {{ settingsStore.startOfDay }}
    div.mt-2.mt-sm-0
      b-form-checkbox(
        switch
        :checked="autoEnabled"
        :disabled="loading || saving"
        @change="toggleAuto"
      )
        | {{ autoEnabled ? $tr('Enabled') : $tr('Disabled') }}

  b-alert.mt-3(v-if="error" show variant="danger")
    | {{ error }}
  b-alert.mt-3(v-if="message" show variant="success")
    | {{ message }}

  div.row.mt-3
    div.col-md-4
      label.small.text-muted(for="fleet-summary-precompute-day") {{ $tr('Day') }}
      input#fleet-summary-precompute-day.form-control.form-control-sm(
        type="date"
        v-model="manualDate"
        :disabled="loading || precomputing"
      )
    div.col-md-8.mt-3.mt-md-4
      b-button(
        size="sm"
        variant="outline-dark"
        @click="precomputeManualDay"
        :disabled="loading || precomputing"
      )
        | {{ precomputing ? $tr('Calculating...') : $tr('Pre-calculate selected day') }}

  div.mt-3(v-if="runs.length > 0")
    b-table(
      small
      responsive="lg"
      :items="runs"
      :fields="runFields"
    )
      template(v-slot:cell(range)="data")
        | {{ formatRange(data.item.range) }}
      template(v-slot:cell(started_at)="data")
        span(v-if="data.item.started_at") {{ data.item.started_at | friendlytime }}
        span(v-else) -
</template>

<script lang="ts">
import moment from 'moment';

import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';

function previousCompletedDay(startOfDay: string) {
  const [hour, minute] = String(startOfDay || '04:00')
    .split(':')
    .map(value => Number(value));
  const boundary = moment()
    .hour(Number.isFinite(hour) ? hour : 4)
    .minute(Number.isFinite(minute) ? minute : 0)
    .second(0)
    .millisecond(0);
  if (moment().isBefore(boundary)) {
    boundary.subtract(1, 'day');
  }
  return boundary.subtract(1, 'day').format('YYYY-MM-DD');
}

export default {
  name: 'FleetSummaryPrecomputeSettings',
  data() {
    const settingsStore = useSettingsStore();
    return {
      fleetStore: useFleetStore(),
      settingsStore,
      loading: false,
      saving: false,
      precomputing: false,
      error: '',
      message: '',
      manualDate: previousCompletedDay(settingsStore.startOfDay),
    };
  },
  computed: {
    config() {
      return (
        this.fleetStore.summaryPrecomputeConfig || {
          auto_enabled: false,
          start_of_day: this.settingsStore.startOfDay,
          runs: [],
        }
      );
    },
    autoEnabled() {
      return Boolean(this.config.auto_enabled);
    },
    runs() {
      return this.config.runs || [];
    },
    runFields() {
      return [
        { key: 'status', label: this.$tr('Status') },
        { key: 'source', label: this.$tr('Source') },
        { key: 'range', label: this.$tr('Range') },
        { key: 'users_done', label: this.$tr('Users') },
        { key: 'started_at', label: this.$tr('Started') },
      ];
    },
  },
  async mounted() {
    await this.loadConfig();
  },
  methods: {
    async loadConfig() {
      this.loading = true;
      this.error = '';
      try {
        await this.fleetStore.loadSummaryPrecomputeConfig();
      } catch (error) {
        this.error = this.$tr('Unable to load fleet summary settings');
      } finally {
        this.loading = false;
      }
    },
    async toggleAuto(value) {
      this.saving = true;
      this.error = '';
      this.message = '';
      try {
        await this.fleetStore.saveSummaryPrecomputeConfig({
          auto_enabled: Boolean(value),
          start_of_day: this.settingsStore.startOfDay,
        });
        this.message = this.$tr('Settings saved');
      } catch (error) {
        this.error = this.$tr('Unable to save fleet summary settings');
      } finally {
        this.saving = false;
      }
    },
    selectedRange() {
      const [hour, minute] = String(this.settingsStore.startOfDay || '04:00')
        .split(':')
        .map(value => Number(value));
      const start = moment(this.manualDate)
        .hour(Number.isFinite(hour) ? hour : 4)
        .minute(Number.isFinite(minute) ? minute : 0)
        .second(0)
        .millisecond(0);
      return {
        start: start.toISOString(),
        end: start.clone().add(1, 'day').toISOString(),
      };
    },
    async precomputeManualDay() {
      this.precomputing = true;
      this.error = '';
      this.message = '';
      try {
        const result = await this.fleetStore.precomputeSummary({
          ...this.selectedRange(),
          force: true,
          start_of_day: this.settingsStore.startOfDay,
        });
        await this.fleetStore.loadSummaryPrecomputeConfig();
        const done = result.users_done ?? result.run?.users_done ?? 0;
        const total = result.users_total ?? result.run?.users_total ?? done;
        this.message = this.$tr('Pre-calculation finished for {done} of {total} users', {
          done,
          total,
        });
      } catch (error) {
        this.error = this.$tr('Unable to pre-calculate fleet summary');
      } finally {
        this.precomputing = false;
      }
    },
    formatRange(range) {
      if (!range?.start || !range?.end) {
        return '-';
      }
      const start = moment(range.start);
      const end = moment(range.end).subtract(1, 'millisecond');
      return `${start.format('ll')} - ${end.format('ll')}`;
    },
  },
};
</script>
