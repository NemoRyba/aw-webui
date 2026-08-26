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
        span.small.text-muted(v-if="redmineLoading")
          b-spinner.mr-1(small)
          | {{ $tr('Loading Redmine...') }}
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
            v-for="project in sortedRedmineProjects(data.item.redmine_projects)"
            :key="`${project.project_id}-${project.project_name}`"
          )
            span.redmine-project-name(:title="project.project_name || `#${project.project_id}`")
              | {{ project.project_name || `#${project.project_id}` }}
            span.redmine-project-time
              | {{ project.seconds | friendlyduration }}
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

  b-card.mt-3(v-if="summary")
    div.fleet-summary-table-tools.mb-3
      div
        h5.mb-0 {{ $tr('Daily comparison') }}
        div.text-muted.small(v-if="dailyComparison && dailyComparison.generated_at")
          | {{ $tr('Redmine loaded') }} {{ dailyComparison.generated_at | friendlytime }}
      div.fleet-summary-table-actions
        b-button(
          size="sm"
          variant="danger"
          @click="loadDailyComparison"
          :disabled="dailyLoading || summaryRows.length === 0"
        )
          b-spinner.mr-1(v-if="dailyLoading" small)
          | {{ dailyLoading ? $tr('Loading...') : $tr('Load daily comparison') }}
    b-alert(v-if="dailyError" show variant="warning")
      | {{ dailyError }}
    div.aw-loading(v-if="dailyLoading")
      | {{ $tr('Loading...') }}
    div(v-else-if="dailyComparison")
      b-alert(v-if="dailyDays.length === 0" show variant="info")
        | {{ $tr('No daily data found in the selected range.') }}
      div.fleet-daily-grid-header(v-if="dailyDays.length > 0")
        span {{ $tr('Username') }}
        span {{ $tr('Active session time') }}
        span {{ $tr('Redmine booked time') }}
        span {{ $tr('Difference') }}
        span {{ $tr('Bookings') }}
      div.fleet-daily-day(v-for="day in dailyDays" :key="day.date")
        div.fleet-daily-day-header
          span.fleet-daily-day-date {{ formatDailyDate(day.date) }}
          b-button.fleet-daily-day-reload(
            size="sm"
            variant="outline-secondary"
            :disabled="Boolean(dailyReloadingDays[day.date])"
            :title="$tr('Reload this day')"
            @click="reloadDay(day)"
          )
            b-spinner(v-if="dailyReloadingDays[day.date]" small)
            icon(v-else name="sync" scale="0.8")
        div.fleet-daily-user-row(v-for="row in day.users" :key="day.date + '-' + row.username")
          router-link.fleet-daily-cell-user(
            :to="{ path: '/fleet/users/' + encodeURIComponent(row.username), query: { start: day.date, end: day.date } }"
          ) {{ row.username }}
          span.fleet-daily-cell {{ row.active_seconds | friendlyduration }}
          span.fleet-daily-cell
            template(v-if="row.redmine_seconds !== null") {{ row.redmine_seconds | friendlyduration }}
            span.text-muted(v-else :title="$tr('No Redmine user mapped')") -
          span.fleet-daily-cell
            template(v-if="row.delta_seconds !== null") {{ formatSignedDuration(row.delta_seconds) }}
            span(v-else) -
          div.fleet-daily-cell-entries
            div.fleet-daily-entry(v-for="(entry, index) in row.entries" :key="index")
              span.fleet-daily-entry-project(:title="entry.project_name || `#${entry.project_id}`")
                | {{ entry.project_name || `#${entry.project_id}` }}
              span.fleet-daily-entry-time {{ entry.seconds | friendlyduration }}
              span.fleet-daily-entry-comment(v-if="entry.comments") {{ entry.comments }}
            span.text-muted(v-if="row.entries.length === 0 && row.matched") {{ $tr('No bookings') }}
            span.text-muted(v-else-if="row.entries.length === 0") {{ $tr('No Redmine user mapped') }}
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
      dailyComparison: null,
      dailyLoading: false,
      dailyError: '',
      dailyRequestId: 0,
      dailyReloadingDays: {},
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
    dailyDays() {
      return this.dailyComparison?.days || [];
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
    // NOTE: users granted only "Eigene Zusammenfassung" never reach this page -
    // the router sends them to /fleet/me (FleetMySummary.vue), a page built for
    // one person rather than this table filtered down to a single row.
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
      this.dailyRequestId += 1;
      this.dailyComparison = null;
      this.dailyLoading = false;
      this.dailyError = '';
      this.dailyReloadingDays = {};
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
        // Load Redmine automatically; a failure shows the warning alert but
        // never breaks the Auswertung itself.
        this.loadRedmineComparison();
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
    async loadDailyComparison() {
      if (this.summaryRows.length === 0) {
        return;
      }
      const requestId = this.dailyRequestId + 1;
      this.dailyRequestId = requestId;
      const params = {
        ...this.buildParams(),
        usernames: this.summaryRows.map(row => row.username),
      };
      this.dailyLoading = true;
      this.dailyError = '';
      try {
        const comparison = await this.fleetStore.loadRedmineDailyComparison(params);
        if (requestId !== this.dailyRequestId) {
          return;
        }
        this.dailyComparison = comparison;
        if (comparison.error) {
          this.dailyError = comparison.error;
        } else if (!comparison.enabled) {
          this.dailyError = comparison.message || this.$tr('Redmine integration is disabled');
        }
      } catch (error) {
        if (requestId === this.dailyRequestId) {
          const errorData = error?.response?.data || {};
          this.dailyError =
            errorData.error ||
            errorData.message ||
            errorData.detail ||
            this.$tr('Unable to load Redmine comparison');
        }
      } finally {
        if (requestId === this.dailyRequestId) {
          this.dailyLoading = false;
        }
      }
    },
    async reloadDay(day) {
      if (!day?.range?.start || !day?.range?.end) {
        return;
      }
      this.$set(this.dailyReloadingDays, day.date, true);
      try {
        const response = await this.fleetStore.loadRedmineDailyComparison({
          start: day.range.start,
          end: day.range.end,
          exclude_inactive_session_afk: 'true',
          usernames: this.summaryRows.map(row => row.username),
          force: true,
        });
        if (!this.dailyComparison) {
          return;
        }
        const otherDays = (this.dailyComparison.days || []).filter(
          existing => existing.date !== day.date
        );
        const refreshed = (response?.days || []).filter(fresh => fresh.date === day.date);
        const days = [...otherDays, ...refreshed];
        days.sort((left, right) => (left.date < right.date ? 1 : -1));
        this.dailyComparison = { ...this.dailyComparison, days };
        if (response?.error) {
          this.dailyError = response.error;
        }
      } catch (error) {
        const errorData = error?.response?.data || {};
        this.dailyError =
          errorData.error || errorData.message || this.$tr('Unable to load Redmine comparison');
      } finally {
        this.$set(this.dailyReloadingDays, day.date, false);
      }
    },
    formatDailyDate(date) {
      const parsed = moment(date, 'YYYY-MM-DD', true);
      if (!parsed.isValid()) {
        return date;
      }
      return parsed.format('dddd, ll');
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

.fleet-daily-day {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(128, 128, 128, 0.25);
}

.fleet-daily-day-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.fleet-daily-day-date {
  font-weight: 600;
}

.fleet-daily-grid-header,
.fleet-daily-user-row {
  display: grid;
  grid-template-columns: minmax(6rem, 9rem) 7.5rem 7.5rem 6.5rem minmax(0, 1fr);
  gap: 0.4rem 0.9rem;
  align-items: start;
}

.fleet-daily-grid-header {
  margin-top: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--gray);
}

.fleet-daily-user-row {
  padding: 0.25rem 0;
  font-variant-numeric: tabular-nums;
}

.fleet-daily-user-row + .fleet-daily-user-row {
  border-top: 1px dashed rgba(128, 128, 128, 0.18);
}

.fleet-daily-cell-user {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.fleet-daily-cell {
  white-space: nowrap;
}

.fleet-daily-cell-entries {
  min-width: 0;
}

.fleet-daily-day-reload {
  margin-left: auto;
  padding: 0.1rem 0.45rem;
}

.fleet-daily-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.fleet-daily-entry-project {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.fleet-daily-entry-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.fleet-daily-entry-comment {
  color: var(--gray);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

@media (max-width: 767.98px) {
  .fleet-daily-grid-header {
    display: none;
  }

  .fleet-daily-user-row {
    grid-template-columns: 1fr 1fr;
  }

  .fleet-daily-cell-entries {
    grid-column: 1 / -1;
  }
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
