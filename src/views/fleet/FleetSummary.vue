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
  b-alert(v-if="redmineLoadError" show variant="warning")
    | {{ redmineLoadError }}

  div.fleet-summary-total-strip.mb-3(v-if="summary")
    div.fleet-summary-total
      div.text-muted.small {{ $tr('Selected users') }}
      div.fleet-summary-total-value {{ selectedSummaryRows.length }} / {{ summaryRows.length }}
    div.fleet-summary-total
      div.text-muted.small {{ $tr('ActivityWatch active session time') }}
      div.fleet-summary-total-value {{ selectedActiveSeconds | friendlyduration }}
    div.fleet-summary-total
      div.text-muted.small
        | {{ $tr('Redmine booked time') }}
        b-spinner.ml-2(v-if="redmineLoading" small)
      div.fleet-summary-total-value(v-if="redmineComparison && redmineComparison.enabled")
        | {{ selectedRedmineSeconds | friendlyduration }}
      div.fleet-summary-total-value(v-else) -
    div.fleet-summary-total
      div.text-muted.small {{ $tr('Difference') }}
      div.fleet-summary-total-value(v-if="redmineComparison && redmineComparison.enabled")
        | {{ formatSignedDuration(selectedDeltaSeconds) }}
      div.fleet-summary-total-value(v-else) -

  b-card
    div.fleet-summary-table-tools.mb-3
      div
        h5.mb-0 {{ $tr('Users') }}
        div.text-muted.small(v-if="redmineLoadedAt")
          | {{ $tr('Redmine loaded') }} {{ redmineLoadedAt | friendlytime }}
      div.fleet-summary-table-actions
        b-button(size="sm" variant="outline-secondary" @click="selectAllUsers")
          | {{ $tr('Select all') }}
        b-button(size="sm" variant="outline-secondary" @click="clearSelectedUsers")
          | {{ $tr('Select none') }}
        b-button(
          size="sm"
          variant="outline-dark"
          @click="loadRedmineComparison"
          :disabled="redmineLoading || selectedUsernames.length === 0"
        )
          b-spinner.mr-1(v-if="redmineLoading" small)
          | {{ redmineLoading ? $tr('Loading Redmine...') : $tr('Load Redmine') }}
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
      template(v-slot:cell(selected)="data")
        b-form-checkbox(
          :checked="isUserSelected(data.item.username)"
          @change="toggleUserSelection(data.item.username, $event)"
        )
      template(v-slot:cell(username)="data")
        router-link(:to="'/fleet/users/' + encodeURIComponent(data.item.username)")
          | {{ data.item.username }}
      template(v-slot:cell(active_seconds)="data")
        | {{ data.item.active_seconds | friendlyduration }}
      template(v-slot:cell(redmine_seconds)="data")
        span(v-if="redmineLoading && isUserSelected(data.item.username)")
          b-spinner(small)
        span(v-else-if="data.item.redmine_seconds !== null")
          | {{ data.item.redmine_seconds | friendlyduration }}
        span(v-else) -
      template(v-slot:cell(redmine_projects)="data")
        span(v-if="data.item.redmine_projects.length")
          | {{ formatRedmineProjects(data.item.redmine_projects) }}
        span(v-else) -
      template(v-slot:cell(delta_seconds)="data")
        span(v-if="data.item.delta_seconds !== null")
          | {{ formatSignedDuration(data.item.delta_seconds) }}
        span(v-else) -
      template(v-slot:cell(redmine_status)="data")
        b-badge(:variant="redmineStatusVariant(data.item.redmine_status)")
          | {{ $tr(data.item.redmine_status) }}
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
import { seconds_to_duration } from '~/util/time';

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
      redmineLoading: false,
      loadError: '',
      redmineLoadError: '',
      selectedUsernames: [],
      selectionInitialized: false,
      selectionDebounceTimer: null,
      redmineLoadedAt: '',
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
        { key: 'selected', label: '' },
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'active_seconds', label: this.$tr('Active session time'), sortable: true },
        { key: 'redmine_seconds', label: this.$tr('Redmine booked time'), sortable: true },
        { key: 'redmine_projects', label: this.$tr('Redmine projects') },
        { key: 'delta_seconds', label: this.$tr('Difference'), sortable: true },
        { key: 'redmine_status', label: this.$tr('Redmine'), sortable: true },
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
    redmineComparison() {
      return this.fleetStore.redmineComparison;
    },
    redmineRowsByUsername() {
      const rows = {};
      for (const row of this.redmineComparison?.users || []) {
        rows[row.username] = row;
      }
      return rows;
    },
    selectedUsernameSet() {
      return new Set(this.selectedUsernames);
    },
    summaryRows() {
      return (this.summary?.users || []).map(user => ({
        ...user,
        ...this.summaryRowMetrics(user),
      }));
    },
    selectedSummaryRows() {
      return this.summaryRows.filter(row => this.selectedUsernameSet.has(row.username));
    },
    selectedActiveSeconds() {
      return this.selectedSummaryRows.reduce((total, row) => total + row.active_seconds, 0);
    },
    selectedRedmineSeconds() {
      return this.selectedSummaryRows.reduce((total, row) => total + (row.redmine_seconds || 0), 0);
    },
    selectedDeltaSeconds() {
      return this.selectedActiveSeconds - this.selectedRedmineSeconds;
    },
    canShiftNextDay() {
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!end.isValid()) {
        return false;
      }
      return end.isBefore(moment().startOf('day'), 'day');
    },
  },
  beforeDestroy() {
    this.clearSelectionDebounce();
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    summaryRowMetrics(user) {
      const redmineRow = this.redmineRowsByUsername[user.username] || null;
      const activeSeconds = Number(user.totals?.active_seconds || 0);
      const redmineSeconds =
        redmineRow &&
        redmineRow.redmine_seconds !== null &&
        redmineRow.redmine_seconds !== undefined
          ? Number(redmineRow.redmine_seconds || 0)
          : null;
      return {
        active_seconds: activeSeconds,
        not_afk_active_seconds:
          user.totals?.not_afk_active_seconds === undefined
            ? null
            : Number(user.totals.not_afk_active_seconds || 0),
        redmine_seconds: redmineSeconds,
        redmine_projects: redmineRow?.projects || [],
        delta_seconds: redmineSeconds === null ? null : activeSeconds - redmineSeconds,
        redmine_status: redmineRow?.status || 'not_loaded',
        calculated_at: user.summary_cache?.calculated_at || null,
      };
    },
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
    defaultSelectUsers() {
      const usernames = (this.summary?.users || []).map(user => user.username);
      if (!this.selectionInitialized) {
        this.selectedUsernames = usernames;
        this.selectionInitialized = true;
        return;
      }
      const available = new Set(usernames);
      this.selectedUsernames = this.selectedUsernames.filter(username => available.has(username));
    },
    isUserSelected(username) {
      return this.selectedUsernameSet.has(username);
    },
    selectAllUsers() {
      this.selectedUsernames = (this.summary?.users || []).map(user => user.username);
      this.selectionInitialized = true;
      this.queueRedmineComparisonLoad();
    },
    clearSelectedUsers() {
      this.selectedUsernames = [];
      this.selectionInitialized = true;
      this.redmineLoadError = '';
      this.redmineLoadedAt = '';
      this.fleetStore.$patch({ redmineComparison: null });
      this.clearSelectionDebounce();
    },
    toggleUserSelection(username, selected) {
      const next = new Set(this.selectedUsernames);
      if (selected) {
        next.add(username);
      } else {
        next.delete(username);
      }
      this.selectedUsernames = Array.from(next);
      this.selectionInitialized = true;
      this.queueRedmineComparisonLoad();
    },
    clearSelectionDebounce() {
      if (this.selectionDebounceTimer) {
        window.clearTimeout(this.selectionDebounceTimer);
        this.selectionDebounceTimer = null;
      }
    },
    queueRedmineComparisonLoad() {
      this.clearSelectionDebounce();
      this.selectionDebounceTimer = window.setTimeout(() => {
        this.loadRedmineComparison();
      }, 500);
    },
    async refresh() {
      this.loading = true;
      this.loadError = '';
      let loadedSummary = false;
      try {
        await this.fleetStore.loadSummary(this.buildParams());
        this.defaultSelectUsers();
        this.fleetStore.$patch({ redmineComparison: null });
        this.redmineLoadedAt = '';
        loadedSummary = true;
      } catch (error) {
        this.loadError = this.$tr('Unable to load fleet summary');
      } finally {
        this.loading = false;
      }
      if (loadedSummary) {
        this.loadRedmineComparison();
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
    async loadRedmineComparison() {
      this.clearSelectionDebounce();
      if (this.selectedUsernames.length === 0) {
        this.fleetStore.$patch({ redmineComparison: null });
        this.redmineLoadedAt = '';
        this.redmineLoadError = '';
        return;
      }

      this.redmineLoading = true;
      this.redmineLoadError = '';
      try {
        const comparison = await this.fleetStore.loadRedmineComparison({
          ...this.buildParams(),
          usernames: this.selectedUsernames,
        });
        this.redmineLoadedAt = comparison.generated_at;
        if (comparison.error) {
          this.redmineLoadError = comparison.error;
        } else if (!comparison.enabled) {
          this.redmineLoadError = comparison.message || this.$tr('Redmine integration is disabled');
        }
      } catch (error) {
        const errorData = error?.response?.data || {};
        this.redmineLoadError =
          errorData.error ||
          errorData.message ||
          errorData.detail ||
          this.$tr('Unable to load Redmine comparison');
      } finally {
        this.redmineLoading = false;
      }
    },
    formatSignedDuration(seconds) {
      const value = Number(seconds || 0);
      if (value === 0) {
        return seconds_to_duration(0);
      }
      return `${value > 0 ? '+' : '-'}${seconds_to_duration(Math.abs(value))}`;
    },
    formatRedmineProjects(projects) {
      const visibleProjects = [...(projects || [])]
        .sort((left, right) => Number(right.seconds || 0) - Number(left.seconds || 0))
        .slice(0, 3)
        .map(project => {
          const name = project.project_name || `#${project.project_id}`;
          return `${name}: ${seconds_to_duration(Number(project.seconds || 0))}`;
        });
      const remaining = Math.max(0, (projects || []).length - visibleProjects.length);
      if (remaining > 0) {
        visibleProjects.push(this.$tr('+ {count} more', { count: remaining }));
      }
      return visibleProjects.join(', ');
    },
    redmineStatusVariant(redmineStatus) {
      const variants = {
        matched: 'success',
        missing_email: 'warning',
        no_redmine_user: 'warning',
        not_loaded: 'secondary',
      };
      return variants[redmineStatus] || 'secondary';
    },
  },
};
</script>

<style scoped lang="scss">
.fleet-summary-range-shortcuts {
  display: flex;
  justify-content: flex-start;
}

.fleet-summary-total-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.fleet-summary-total {
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.45rem;
  background: rgba(127, 127, 127, 0.06);
}

.fleet-summary-total-value {
  font-size: 1.25rem;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.fleet-summary-table-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.fleet-summary-table-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
