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
    div.col-md-3
      label.small.text-muted(for="fleet-summary-precompute-start") {{ $tr('Start') }}
      input#fleet-summary-precompute-start.form-control.form-control-sm(
        type="date"
        v-model="manualStartDate"
        :max="manualEndDate"
        :disabled="loading || precomputing"
      )
    div.col-md-3.mt-2.mt-md-0
      label.small.text-muted(for="fleet-summary-precompute-end") {{ $tr('End') }}
      input#fleet-summary-precompute-end.form-control.form-control-sm(
        type="date"
        v-model="manualEndDate"
        :min="manualStartDate"
        :disabled="loading || precomputing"
      )
    div.col-md-6.mt-3.mt-md-4
      b-button(
        size="sm"
        variant="outline-dark"
        @click="precomputeManualRange"
        :disabled="loading || precomputing || selectedDays.length === 0"
      )
        | {{ precomputing ? progressLabel : precomputeButtonLabel }}

  b-progress.mt-3(
    v-if="precomputing && rangeDaysTotal > 1"
    :max="rangeDaysTotal"
    :value="rangeDaysDone"
    height="0.35rem"
  )

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
      manualStartDate: previousCompletedDay(settingsStore.startOfDay),
      manualEndDate: previousCompletedDay(settingsStore.startOfDay),
      rangeDaysDone: 0,
      rangeDaysTotal: 0,
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
    selectedDays() {
      const start = moment(this.manualStartDate, 'YYYY-MM-DD', true);
      const end = moment(this.manualEndDate, 'YYYY-MM-DD', true);
      if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) {
        return [];
      }
      const days = [];
      const cursor = start.clone();
      while (!cursor.isAfter(end, 'day')) {
        days.push(cursor.format('YYYY-MM-DD'));
        cursor.add(1, 'day');
      }
      return days;
    },
    precomputeButtonLabel() {
      if (this.selectedDays.length <= 1) {
        return this.$tr('Pre-calculate selected day');
      }
      return this.$tr('Pre-calculate selected range');
    },
    progressLabel() {
      if (this.rangeDaysTotal <= 1) {
        return this.$tr('Calculating...');
      }
      return this.$tr('Calculating day {done} of {total}...', {
        done: Math.min(this.rangeDaysDone + 1, this.rangeDaysTotal),
        total: this.rangeDaysTotal,
      });
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
    selectedRange(day) {
      const [hour, minute] = String(this.settingsStore.startOfDay || '04:00')
        .split(':')
        .map(value => Number(value));
      const start = moment(day)
        .hour(Number.isFinite(hour) ? hour : 4)
        .minute(Number.isFinite(minute) ? minute : 0)
        .second(0)
        .millisecond(0);
      return {
        start: start.toISOString(),
        end: start.clone().add(1, 'day').toISOString(),
      };
    },
    async precomputeManualRange() {
      const days = this.selectedDays;
      if (days.length === 0) {
        this.error = this.$tr('Select a valid date range');
        return;
      }

      this.precomputing = true;
      this.error = '';
      this.message = '';
      this.rangeDaysDone = 0;
      this.rangeDaysTotal = days.length;
      try {
        let usersDone = 0;
        let usersTotal = 0;
        let completedDays = 0;
        const errors = [];
        for (const day of days) {
          const result = await this.fleetStore.precomputeSummary({
            ...this.selectedRange(day),
            force: true,
            start_of_day: this.settingsStore.startOfDay,
          });
          if (result.status === 'busy') {
            errors.push(
              result.message || this.$tr('A fleet summary precompute is already running.')
            );
            break;
          }
          usersDone += result.users_done ?? result.run?.users_done ?? 0;
          usersTotal += result.users_total ?? result.run?.users_total ?? 0;
          completedDays += 1;
          this.rangeDaysDone = completedDays;
        }
        await this.fleetStore.loadSummaryPrecomputeConfig();

        if (errors.length) {
          this.error = errors.join(' ');
          return;
        }
        if (days.length <= 1) {
          this.message = this.$tr('Pre-calculation finished for {done} of {total} users', {
            done: usersDone,
            total: usersTotal || usersDone,
          });
        } else {
          this.message = this.$tr(
            'Pre-calculation finished for {days} days and {done} of {total} user summaries',
            {
              days: completedDays,
              done: usersDone,
              total: usersTotal || usersDone,
            }
          );
        }
      } catch (error) {
        this.error = this.$tr('Unable to pre-calculate fleet summary');
      } finally {
        this.precomputing = false;
        this.rangeDaysDone = 0;
        this.rangeDaysTotal = 0;
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
