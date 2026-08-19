<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Zusammenfassung') }}
      div.text-muted.small(v-if="rangeLabel") {{ rangeLabel }}
    b-button-group.ml-auto(size="sm")
      b-button(variant="outline-dark" @click="refresh" :disabled="loading || precomputing")
        icon(name="sync")
        span.ml-1 {{ $tr('Refresh') }}
      b-button(variant="outline-dark" @click="recalculate" :disabled="loading || precomputing")
        icon(name="sync")
        span.ml-1 {{ precomputing ? $tr('Calculating...') : $tr('Recalculate') }}

  b-card.mb-3
    div.fleet-summary-range-shortcuts.mb-2
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
        label.small.text-muted(for="fleet-summary-start") {{ $tr('Start') }}
        input#fleet-summary-start.form-control(type="date" v-model="startDate")
      div.col-md-4.mt-2.mt-md-0
        label.small.text-muted(for="fleet-summary-end") {{ $tr('End') }}
        input#fleet-summary-end.form-control(type="date" v-model="endDate")
      div.col-md-4.mt-3.mt-md-4
        b-button(variant="primary" @click="refresh" :disabled="loading || precomputing")
          | {{ $tr('Apply range') }}

  b-alert(v-if="loadError" show variant="danger")
    | {{ loadError }}

  b-card
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Users') }}
      column-order-editor.ml-auto(
        :table-key="tableKey"
        :fields="defaultFields"
      )
    div.aw-loading(v-if="loading")
      | {{ $tr('Loading...') }}
    b-table(
      v-else
      small
      hover
      responsive="lg"
      :items="summaryRows"
      :fields="fields"
      :empty-text="$tr('No users found')"
    )
      template(v-slot:cell(username)="data")
        router-link(:to="'/fleet/users/' + encodeURIComponent(data.item.username)")
          | {{ data.item.username }}
      template(v-slot:cell(active_seconds)="data")
        | {{ data.item.active_seconds | friendlyduration }}
      template(v-slot:cell(not_afk_active_seconds)="data")
        span(v-if="data.item.not_afk_active_seconds !== null")
          | {{ data.item.not_afk_active_seconds | friendlyduration }}
        span(v-else) -
      template(v-slot:cell(active_sessions)="data")
        | {{ data.item.active_sessions }}
      template(v-slot:cell(calculated_at)="data")
        span(v-if="data.item.calculated_at") {{ data.item.calculated_at | friendlytime }}
        span(v-else) -
      template(v-slot:cell(last_seen)="data")
        span(v-if="data.item.last_seen") {{ data.item.last_seen | friendlytime }}
        span(v-else) -
</template>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/sync';

import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetSummary',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      startDate: moment().format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      loading: false,
      precomputing: false,
      loadError: '',
      tableKey: 'fleet-summary-users',
    };
  },
  computed: {
    summary() {
      return this.fleetStore.summary;
    },
    rangeLabel() {
      if (!this.summary?.range?.start || !this.summary?.range?.end) {
        return '';
      }
      const start = moment(this.summary.range.start);
      const end = moment(this.summary.range.end).subtract(1, 'millisecond');
      return `${start.format('ll')} - ${end.format('ll')}`;
    },
    defaultFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'active_seconds', label: this.$tr('Active session time'), sortable: true },
        {
          key: 'not_afk_active_seconds',
          label: this.$tr('Active after AFK subtraction'),
          sortable: true,
        },
        { key: 'active_sessions', label: this.$tr('Live sessions'), sortable: true },
        { key: 'calculated_at', label: this.$tr('Calculated'), sortable: true },
        { key: 'last_seen', label: this.$tr('Last seen'), sortable: true },
      ];
    },
    fields() {
      return orderFields(this.defaultFields, this.settingsStore.columnOrdersData?.[this.tableKey]);
    },
    summaryRows() {
      return (this.summary?.users || []).map(user => ({
        ...user,
        active_seconds: Number(user.totals?.active_seconds || 0),
        not_afk_active_seconds:
          user.totals?.not_afk_active_seconds === undefined
            ? null
            : Number(user.totals.not_afk_active_seconds || 0),
        calculated_at: user.summary_cache?.calculated_at || null,
      }));
    },
    canShiftNextDay() {
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!end.isValid()) {
        return false;
      }
      return end.isBefore(moment().startOf('day'), 'day');
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    buildParams() {
      const start = this.rangeBoundary(this.startDate);
      const end = this.rangeBoundary(this.endDate).add(1, 'day');
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        exclude_inactive_session_afk: 'true',
      };
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
    async refresh() {
      this.loading = true;
      this.loadError = '';
      try {
        await this.fleetStore.loadSummary(this.buildParams());
      } catch (error) {
        this.loadError = this.$tr('Unable to load fleet summary');
      } finally {
        this.loading = false;
      }
    },
    async recalculate() {
      this.precomputing = true;
      this.loadError = '';
      try {
        await this.fleetStore.precomputeSummary({
          ...this.buildParams(),
          force: true,
          start_of_day: this.settingsStore.startOfDay,
        });
        await this.refresh();
      } catch (error) {
        this.loadError = this.$tr('Unable to recalculate fleet summary');
      } finally {
        this.precomputing = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.fleet-summary-range-shortcuts {
  display: flex;
  justify-content: flex-start;
}
</style>
