<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Zusammenfassung') }}
      div.text-muted.small(v-if="rangeLabel") {{ rangeLabel }}
    b-button-group.ml-auto(size="sm")
      b-button(variant="outline-dark" @click="refresh" :disabled="!canLoadSummary || loading || precomputing")
        icon(name="sync")
        span.ml-1 {{ $tr('Refresh') }}
      b-button(variant="outline-dark" @click="recalculate" :disabled="!canLoadSummary || loading || precomputing")
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
        b-button(variant="primary" @click="refresh" :disabled="!canLoadSummary || loading || precomputing")
          b-spinner.mr-1(v-if="loading || redmineLoading" small)
          | {{ loading ? $tr('Loading...') : $tr('Load evaluation') }}

    hr

    div.fleet-summary-picker-header
      div
        h5.mb-0 {{ $tr('Users') }}
        small.text-muted {{ selectedUsernames.length }} / {{ userOptions.length }}
      div.fleet-summary-table-actions
        b-form-input(
          v-model.trim="userSearch"
          size="sm"
          :placeholder="$tr('Search users')"
        )
        b-button(size="sm" variant="outline-secondary" @click="selectAllUsers" :disabled="usersLoading")
          | {{ $tr('Select all') }}
        b-button(size="sm" variant="outline-secondary" @click="clearSelectedUsers" :disabled="usersLoading")
          | {{ $tr('Select none') }}
    div.aw-loading.mt-3(v-if="usersLoading")
      | {{ $tr('Loading...') }}
    b-alert.mt-3(v-else-if="usersLoadError" show variant="danger")
      | {{ usersLoadError }}
    div.fleet-summary-user-grid.mt-3(v-else)
      b-form-checkbox.fleet-summary-user-option(
        v-for="user in filteredUserOptions"
        :key="user.username"
        :checked="isUserSelected(user.username)"
        @change="toggleUserSelection(user.username, $event)"
      )
        span.fleet-summary-user-name {{ user.username }}
        span.fleet-summary-user-meta(v-if="user.last_seen")
          | {{ user.last_seen | friendlytime }}

  b-alert(v-if="loadError" show variant="danger")
    | {{ loadError }}
  b-alert(v-if="summary || loading" v-show="redmineLoadError" show variant="warning")
    | {{ redmineLoadError }}

  b-card(v-if="summary || loading")
    div.fleet-summary-table-tools.mb-3
      div
        h5.mb-0 {{ $tr('Evaluation') }}
        div.text-muted.small(v-if="redmineLoadedAt")
          | {{ $tr('Redmine loaded') }} {{ redmineLoadedAt | friendlytime }}
      div.fleet-summary-table-actions
        b-button(
          size="sm"
          variant="outline-dark"
          @click="loadRedmineComparison"
          :disabled="redmineLoading || summaryRows.length === 0"
        )
          b-spinner.mr-1(v-if="redmineLoading" small)
          | {{ redmineLoading ? $tr('Loading Redmine...') : $tr('Load Redmine') }}
      column-order-editor.ml-auto(
        :table-key="tableKey"
        :fields="defaultFields"
        :allow-visibility="true"
        :default-hidden-columns="defaultHiddenColumns"
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
      template(v-slot:cell(redmine_seconds)="data")
        span(v-if="redmineLoading && isUserSelected(data.item.username)")
          b-spinner(small)
        span(v-else-if="data.item.redmine_seconds !== null")
          | {{ data.item.redmine_seconds | friendlyduration }}
        span(v-else) -
      template(v-slot:cell(redmine_projects)="data")
        div.redmine-project-list(v-if="data.item.redmine_projects.length")
          div.redmine-project-row(
            v-for="project in visibleRedmineProjects(data.item.redmine_projects)"
            :key="`${project.project_id}-${project.project_name}`"
          )
            span.redmine-project-name(:title="project.project_name || `#${project.project_id}`")
              | {{ project.project_name || `#${project.project_id}` }}
            span.redmine-project-time
              | {{ project.seconds | friendlyduration }}
          div.small.text-muted(v-if="remainingRedmineProjectCount(data.item.redmine_projects)")
            | {{ $tr('+ {count} more', { count: remainingRedmineProjectCount(data.item.redmine_projects) }) }}
        span(v-else) -
      template(v-slot:cell(delta_seconds)="data")
        span(v-if="data.item.delta_seconds !== null")
          | {{ formatSignedDuration(data.item.delta_seconds) }}
        span(v-else) -
      template(v-slot:cell(redmine_status)="data")
        b-badge(:variant="redmineStatusVariant(data.item.redmine_status)")
          | {{ $tr(data.item.redmine_status) }}
        div.small.text-muted.redmine-match-reason(v-if="data.item.redmine_match_reason")
          | {{ data.item.redmine_match_reason }}
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
import { orderFields, visibleFields } from '~/util/columnOrder';
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
      usersLoading: false,
      precomputing: false,
      redmineLoading: false,
      loadError: '',
      usersLoadError: '',
      redmineLoadError: '',
      userSearch: '',
      selectedUsernames: [],
      allUserOptions: [],
      selectionInitialized: false,
      selectionDebounceTimer: null,
      redmineLoadedAt: '',
      redmineComparisonResult: null,
      redmineRequestId: 0,
      hasLoadedSummary: false,
      summaryRequestId: 0,
      tableKey: 'fleet-summary-users',
    };
  },
  computed: {
    summary() {
      return this.hasLoadedSummary ? this.fleetStore.summary : null;
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
        { key: 'username', label: this.$tr('Username'), sortable: true, hideable: false },
        { key: 'active_seconds', label: this.$tr('Active session time'), sortable: true },
        { key: 'redmine_seconds', label: this.$tr('Redmine booked time'), sortable: true },
        {
          key: 'redmine_projects',
          label: this.$tr('Redmine projects'),
          tdClass: 'fleet-summary-projects-cell',
        },
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
    defaultHiddenColumns() {
      return ['not_afk_active_seconds', 'active_sessions', 'calculated_at', 'last_seen'];
    },
    fields() {
      const orderedFields = orderFields(
        this.defaultFields,
        this.settingsStore.columnOrdersData?.[this.tableKey]
      );
      const visibility = this.settingsStore.columnVisibilityData || {};
      const hiddenColumns = Object.prototype.hasOwnProperty.call(visibility, this.tableKey)
        ? visibility[this.tableKey]
        : this.defaultHiddenColumns;
      return visibleFields(orderedFields, hiddenColumns);
    },
    userOptions() {
      return this.allUserOptions;
    },
    filteredUserOptions() {
      const query = this.userSearch.toLowerCase();
      if (!query) {
        return this.userOptions;
      }
      return this.userOptions.filter(user =>
        String(user.username || '')
          .toLowerCase()
          .includes(query)
      );
    },
    redmineComparison() {
      return this.redmineComparisonResult;
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
    canLoadSummary() {
      return (
        this.selectedUsernames.length > 0 &&
        moment(this.startDate, 'YYYY-MM-DD', true).isValid() &&
        moment(this.endDate, 'YYYY-MM-DD', true).isValid() &&
        !this.usersLoading
      );
    },
    canShiftNextDay() {
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!end.isValid()) {
        return false;
      }
      return end.isBefore(moment().startOf('day'), 'day');
    },
  },
  watch: {
    startDate() {
      this.clearLoadedResults();
    },
    endDate() {
      this.clearLoadedResults();
    },
  },
  async mounted() {
    this.clearLoadedResults();
    await this.loadUsers();
  },
  beforeDestroy() {
    this.clearSelectionDebounce();
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
        redmine_match_source: redmineRow?.match_source || '',
        redmine_match_reason: redmineRow?.match_reason || '',
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
        usernames: this.selectedUsernames,
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
    },
    defaultSelectUsers() {
      const usernames = this.userOptions.map(user => user.username);
      if (!this.selectionInitialized) {
        this.selectedUsernames = usernames;
        this.selectionInitialized = true;
        return;
      }
      const available = new Set(usernames);
      this.selectedUsernames = this.selectedUsernames.filter(username => available.has(username));
    },
    mergeUserOptions(users) {
      const byUsername = new Map();
      for (const user of this.allUserOptions || []) {
        if (user?.username) {
          byUsername.set(user.username, user);
        }
      }
      for (const user of users || []) {
        if (user?.username) {
          byUsername.set(user.username, {
            ...(byUsername.get(user.username) || {}),
            ...user,
          });
        }
      }
      this.allUserOptions = Array.from(byUsername.values()).sort((left, right) =>
        String(left.username || '').localeCompare(String(right.username || ''))
      );
    },
    isUserSelected(username) {
      return this.selectedUsernameSet.has(username);
    },
    selectAllUsers() {
      this.selectedUsernames = this.userOptions.map(user => user.username);
      this.selectionInitialized = true;
      this.clearLoadedResults();
    },
    clearSelectedUsers() {
      this.selectedUsernames = [];
      this.selectionInitialized = true;
      this.clearLoadedResults();
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
      this.clearLoadedResults();
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
    clearLoadedResults() {
      this.summaryRequestId += 1;
      this.redmineRequestId += 1;
      this.hasLoadedSummary = false;
      this.loading = false;
      this.redmineLoading = false;
      this.loadError = '';
      this.redmineLoadError = '';
      this.redmineLoadedAt = '';
      this.redmineComparisonResult = null;
      this.fleetStore.$patch({
        summary: null,
        redmineComparison: null,
      });
    },
    async loadUsers() {
      this.usersLoading = true;
      this.usersLoadError = '';
      try {
        const users = await this.fleetStore.loadUsers();
        this.mergeUserOptions(users);
        this.defaultSelectUsers();
      } catch (error) {
        this.usersLoadError = this.$tr('Unable to load fleet users');
      } finally {
        this.usersLoading = false;
      }
    },
    async refresh() {
      if (!this.canLoadSummary) {
        return;
      }
      const requestId = this.summaryRequestId + 1;
      this.summaryRequestId = requestId;
      const params = this.buildParams();
      this.loading = true;
      this.hasLoadedSummary = false;
      this.redmineRequestId += 1;
      this.redmineComparisonResult = null;
      this.loadError = '';
      this.redmineLoadError = '';
      this.redmineLoadedAt = '';
      this.fleetStore.$patch({
        summary: null,
        redmineComparison: null,
      });
      try {
        const summary = await this.fleetStore.loadSummary(params);
        if (requestId !== this.summaryRequestId) {
          return;
        }
        this.mergeUserOptions(summary?.users || []);
        this.hasLoadedSummary = true;
      } catch (error) {
        if (requestId === this.summaryRequestId) {
          this.loadError = this.$tr('Unable to load fleet summary');
        }
      } finally {
        if (requestId === this.summaryRequestId) {
          this.loading = false;
        }
      }
    },
    async recalculate() {
      if (!this.canLoadSummary) {
        return;
      }
      this.precomputing = true;
      this.loadError = '';
      try {
        await this.fleetStore.precomputeSummary({
          ...this.buildParams(),
          usernames: this.selectedUsernames,
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
      if (this.summaryRows.length === 0) {
        this.redmineRequestId += 1;
        this.redmineLoading = false;
        this.redmineComparisonResult = null;
        this.fleetStore.$patch({ redmineComparison: null });
        this.redmineLoadedAt = '';
        this.redmineLoadError = '';
        return;
      }

      const requestId = this.redmineRequestId + 1;
      this.redmineRequestId = requestId;
      const params = {
        ...this.buildParams(),
        usernames: this.summaryRows.map(row => row.username),
      };
      this.redmineLoading = true;
      this.redmineLoadError = '';
      try {
        const comparison = await this.fleetStore.loadRedmineComparison(params);
        if (requestId !== this.redmineRequestId) {
          return;
        }
        this.redmineComparisonResult = comparison;
        this.redmineLoadedAt = comparison.generated_at;
        if (comparison.error) {
          this.redmineLoadError = comparison.error;
        } else if (!comparison.enabled) {
          this.redmineLoadError = comparison.message || this.$tr('Redmine integration is disabled');
        }
      } catch (error) {
        if (requestId === this.redmineRequestId) {
          const errorData = error?.response?.data || {};
          this.redmineLoadError =
            errorData.error ||
            errorData.message ||
            errorData.detail ||
            this.$tr('Unable to load Redmine comparison');
        }
      } finally {
        if (requestId === this.redmineRequestId) {
          this.redmineLoading = false;
        }
      }
    },
    formatSignedDuration(seconds) {
      const value = Number(seconds || 0);
      if (value === 0) {
        return seconds_to_duration(0);
      }
      return `${value > 0 ? '+' : '-'}${seconds_to_duration(Math.abs(value))}`;
    },
    sortedRedmineProjects(projects) {
      return [...(projects || [])].sort(
        (left, right) => Number(right.seconds || 0) - Number(left.seconds || 0)
      );
    },
    visibleRedmineProjects(projects) {
      return this.sortedRedmineProjects(projects).slice(0, 3);
    },
    remainingRedmineProjectCount(projects) {
      return Math.max(0, this.sortedRedmineProjects(projects).length - 3);
    },
    redmineStatusVariant(redmineStatus) {
      const variants = {
        matched: 'success',
        missing_email: 'warning',
        manual_missing: 'danger',
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

.fleet-summary-picker-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.fleet-summary-user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.5rem 1rem;
}

.fleet-summary-user-option {
  min-width: 0;
}

.fleet-summary-user-name {
  display: block;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.fleet-summary-user-meta {
  display: block;
  color: var(--gray);
  font-size: 0.8rem;
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

.redmine-project-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  max-width: 22rem;
}

.redmine-project-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: start;
}

.redmine-project-name {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.redmine-project-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.redmine-match-reason {
  max-width: 18rem;
  overflow-wrap: anywhere;
}

::v-deep .fleet-summary-projects-cell {
  max-width: 24rem;
  white-space: normal;
}
</style>
