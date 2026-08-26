<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.flex-wrap.mb-3
    div
      h3.mb-0 {{ $tr('My summary') }}
      div.text-muted.small {{ subtitle }}
    b-button-group.ml-auto(size="sm")
      b-button(variant="outline-dark" @click="load" :disabled="!canLoad || loading || precomputing")
        icon(name="sync")
        span.ml-1 {{ $tr('Refresh') }}
      b-button(
        variant="outline-dark"
        :title="$tr('Recalculates this range from the raw events instead of the cache.')"
        @click="recalculate"
        :disabled="!canLoad || loading || precomputing"
      )
        b-spinner(v-if="precomputing" small)
        icon(v-else name="sync")
        span.ml-1 {{ precomputing ? $tr('Calculating...') : $tr('Recalculate') }}

  b-card.mb-3
    div.my-summary-presets
      b-button(
        v-for="preset in rangePresets"
        :key="preset.key"
        size="sm"
        :variant="preset.key === activePreset ? 'primary' : 'outline-secondary'"
        @click="applyPreset(preset.key)"
      ) {{ preset.label }}
    div.my-summary-dates.mt-3
      div.my-summary-date
        label.small.text-muted(for="my-summary-start") {{ $tr('Start') }}
        input#my-summary-start.form-control.form-control-sm(type="date" v-model="startDate")
      div.my-summary-date
        label.small.text-muted(for="my-summary-end") {{ $tr('End') }}
        input#my-summary-end.form-control.form-control-sm(type="date" v-model="endDate")
      b-button.my-summary-load(
        variant="primary"
        size="sm"
        @click="load"
        :disabled="!canLoad || loading"
      )
        b-spinner.mr-1(v-if="loading" small)
        | {{ loading ? $tr('Loading...') : $tr('Load evaluation') }}
    div.small.text-muted.mt-2 {{ $tr('Only your own data is shown on this page.') }}

  b-alert(v-if="loadError" show variant="danger") {{ loadError }}
  b-alert(v-if="redmineNotice" show variant="warning") {{ redmineNotice }}

  div.aw-loading(v-if="loading") {{ $tr('Loading...') }}

  template(v-else-if="hasLoaded")
    b-alert(v-if="!myRow" show variant="info")
      | {{ $tr('No data found in the selected range.') }}

    template(v-else)
      div.my-summary-tiles.mb-3
        div.my-summary-tile
          div.my-summary-tile-label {{ $tr('Active session time') }}
          div.my-summary-tile-value {{ activeSeconds | friendlyduration }}
          div.my-summary-tile-hint(v-if="notAfkSeconds !== null")
            | {{ $tr('Active after AFK subtraction') }}: {{ notAfkSeconds | friendlyduration }}
        div.my-summary-tile
          div.my-summary-tile-label {{ $tr('Redmine booked time') }}
          div.my-summary-tile-value(v-if="redmineSeconds !== null")
            | {{ redmineSeconds | friendlyduration }}
          div.my-summary-tile-value.text-muted(v-else) -
          div.my-summary-tile-hint(v-if="redmineLoading")
            b-spinner.mr-1(small)
            | {{ $tr('Loading Redmine...') }}
          div.my-summary-tile-hint(v-else-if="redmineSeconds === null")
            | {{ $tr('No Redmine user mapped') }}
        div.my-summary-tile
          div.my-summary-tile-label {{ $tr('Difference') }}
          div.my-summary-tile-value(v-if="deltaSeconds !== null" :class="deltaClass")
            | {{ formatSignedDuration(deltaSeconds) }}
          div.my-summary-tile-value.text-muted(v-else) -
          div.my-summary-tile-hint(v-if="deltaSeconds !== null") {{ deltaHint }}
        div.my-summary-tile
          div.my-summary-tile-label {{ $tr('Days with activity') }}
          div.my-summary-tile-value {{ activeDayCount }}
          div.my-summary-tile-hint(v-if="averagePerActiveDay !== null")
            | {{ $tr('Average per day with activity') }}: {{ averagePerActiveDay | friendlyduration }}

      b-card.mb-3
        div.my-summary-card-head
          div
            h5.mb-0 {{ $tr('My days') }}
            div.text-muted.small(v-if="dailyComparison && dailyComparison.generated_at")
              | {{ $tr('Redmine loaded') }} {{ dailyComparison.generated_at | friendlytime }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :disabled="dailyLoading"
            @click="loadDailyComparison"
          )
            b-spinner.mr-1(v-if="dailyLoading" small)
            icon.mr-1(v-else name="sync" scale="0.85")
            | {{ dailyLoading ? $tr('Loading...') : $tr('Load daily comparison') }}

        b-alert(v-if="dailyError" show variant="warning") {{ dailyError }}
        div.aw-loading(v-if="dailyLoading") {{ $tr('Loading...') }}
        b-alert(v-else-if="!dailyComparison && !dailyAutoLoads" show variant="info")
          | {{ $tr('The range is long, so the daily breakdown is not loaded automatically.') }}
        b-alert(v-else-if="dailyComparison && myDays.length === 0" show variant="info")
          | {{ $tr('No daily data found in the selected range.') }}
        div(v-else-if="myDays.length > 0")
          div.my-day(v-for="day in myDays" :key="day.date")
            div.my-day-head
              router-link.my-day-date(
                :to="{ path: ownUserPath, query: { start: day.date, end: day.date } }"
                :title="$tr('Open day')"
              ) {{ formatDayDate(day.date) }}
              span.my-day-delta(v-if="day.delta_seconds !== null" :class="deltaClassFor(day.delta_seconds)")
                | {{ formatSignedDuration(day.delta_seconds) }}
              b-button.my-day-reload(
                size="sm"
                variant="outline-secondary"
                :disabled="Boolean(dailyReloadingDays[day.date])"
                :title="$tr('Reload this day')"
                @click="reloadDay(day)"
              )
                b-spinner(v-if="dailyReloadingDays[day.date]" small)
                icon(v-else name="sync" scale="0.8")
            div.my-day-bars
              div.my-day-bar
                span.my-day-bar-label {{ $tr('Active') }}
                div.my-day-bar-track
                  div.my-day-bar-fill.is-active(:style="{ width: barWidth(day.active_seconds) }")
                span.my-day-bar-value {{ day.active_seconds | friendlyduration }}
              div.my-day-bar
                span.my-day-bar-label {{ $tr('Booked') }}
                div.my-day-bar-track
                  div.my-day-bar-fill.is-booked(:style="{ width: barWidth(day.redmine_seconds) }")
                span.my-day-bar-value(v-if="day.redmine_seconds !== null")
                  | {{ day.redmine_seconds | friendlyduration }}
                span.my-day-bar-value.text-muted(v-else) -
            div.my-day-entries
              div.my-day-entry(v-for="(entry, index) in day.entries" :key="index")
                span.my-day-entry-project(:title="entry.project_name || ('#' + entry.project_id)")
                  | {{ entry.project_name || ('#' + entry.project_id) }}
                span.my-day-entry-time {{ entry.seconds | friendlyduration }}
                span.my-day-entry-comment(v-if="entry.comments") {{ entry.comments }}
              span.text-muted.small(v-if="day.entries.length === 0 && day.matched")
                | {{ $tr('No bookings') }}
              span.text-muted.small(v-else-if="day.entries.length === 0")
                | {{ $tr('No Redmine user mapped') }}

      b-card(v-if="myProjects.length > 0")
        h5.mb-3 {{ $tr('My projects') }}
        div.my-project(v-for="project in myProjects" :key="project.project_id + '-' + project.project_name")
          span.my-project-name(:title="project.project_name || ('#' + project.project_id)")
            | {{ project.project_name || ('#' + project.project_id) }}
          div.my-project-track
            div.my-project-fill(:style="{ width: projectWidth(project.seconds) }")
          span.my-project-time {{ project.seconds | friendlyduration }}
          span.my-project-share {{ projectShare(project.seconds) }}
</template>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/sync';

import { useAuthStore } from '~/stores/auth';
import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { ownFleetUserPath } from '~/util/landingPage';
import { seconds_to_duration } from '~/util/time';

// Loading a per-day breakdown costs one cached day-chunk lookup per day plus
// one Redmine query. That is cheap for a single user over a normal range, but
// a year-long range would still make the page look stuck, so past this many
// days the breakdown becomes an explicit click.
const DAILY_AUTOLOAD_MAX_DAYS = 62;
// Booking to the minute is not realistic; treat small gaps as "matches".
const DELTA_OK_SECONDS = 15 * 60;
const DELTA_WARN_SECONDS = 60 * 60;

export default {
  name: 'FleetMySummary',
  components: {
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      authStore: useAuthStore(),
      settingsStore: useSettingsStore(),
      startDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      loading: false,
      precomputing: false,
      redmineLoading: false,
      dailyLoading: false,
      loadError: '',
      redmineError: '',
      dailyError: '',
      hasLoaded: false,
      summaryRequestId: 0,
      redmineRequestId: 0,
      dailyRequestId: 0,
      summaryResult: null,
      redmineResult: null,
      dailyComparison: null,
      dailyReloadingDays: {},
    };
  },
  computed: {
    ownUsername() {
      return String(this.authStore.username || '');
    },
    ownUserPath() {
      return ownFleetUserPath(this.ownUsername);
    },
    subtitle() {
      return this.rangeLabel ? this.ownUsername + ' · ' + this.rangeLabel : this.ownUsername;
    },
    rangeLabel() {
      const start = moment(this.startDate, 'YYYY-MM-DD', true);
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!start.isValid() || !end.isValid()) {
        return '';
      }
      if (start.isSame(end, 'day')) {
        return start.format('dddd, ll');
      }
      return start.format('ll') + ' - ' + end.format('ll');
    },
    rangePresets() {
      return [
        { key: 'today', label: this.$tr('Today') },
        { key: 'yesterday', label: this.$tr('Yesterday') },
        { key: 'this-week', label: this.$tr('This week') },
        { key: 'last-week', label: this.$tr('Last week') },
        { key: 'this-month', label: this.$tr('This month') },
        { key: 'last-month', label: this.$tr('Last month') },
      ];
    },
    activePreset() {
      for (const preset of this.rangePresets) {
        const range = this.presetRange(preset.key);
        if (range.start === this.startDate && range.end === this.endDate) {
          return preset.key;
        }
      }
      return '';
    },
    rangeDays() {
      const start = moment(this.startDate, 'YYYY-MM-DD', true);
      const end = moment(this.endDate, 'YYYY-MM-DD', true);
      if (!start.isValid() || !end.isValid()) {
        return 0;
      }
      return end.diff(start, 'days') + 1;
    },
    dailyAutoLoads() {
      return this.rangeDays > 0 && this.rangeDays <= DAILY_AUTOLOAD_MAX_DAYS;
    },
    canLoad() {
      return (
        Boolean(this.ownUsername) &&
        moment(this.startDate, 'YYYY-MM-DD', true).isValid() &&
        moment(this.endDate, 'YYYY-MM-DD', true).isValid() &&
        this.rangeDays > 0
      );
    },
    myRow() {
      const users = this.summaryResult?.users || [];
      return users.find(user => this.isOwnUsername(user.username)) || users[0] || null;
    },
    myRedmineRow() {
      const users = this.redmineResult?.users || [];
      return users.find(user => this.isOwnUsername(user.username)) || users[0] || null;
    },
    activeSeconds() {
      return Number(this.myRow?.totals?.active_seconds || 0);
    },
    notAfkSeconds() {
      const value = this.myRow?.totals?.not_afk_active_seconds;
      return value === undefined || value === null ? null : Number(value || 0);
    },
    redmineSeconds() {
      const value = this.myRedmineRow?.redmine_seconds;
      return value === undefined || value === null ? null : Number(value || 0);
    },
    deltaSeconds() {
      return this.redmineSeconds === null ? null : this.activeSeconds - this.redmineSeconds;
    },
    deltaClass() {
      return this.deltaClassFor(this.deltaSeconds);
    },
    deltaHint() {
      const delta = Number(this.deltaSeconds || 0);
      if (Math.abs(delta) <= DELTA_OK_SECONDS) {
        return this.$tr('Booked time matches the tracked time.');
      }
      return delta > 0
        ? this.$tr('Less booked than tracked.')
        : this.$tr('More booked than tracked.');
    },
    myDays() {
      const days = this.dailyComparison?.days || [];
      const rows = [];
      for (const day of days) {
        const row = (day.users || []).find(user => this.isOwnUsername(user.username));
        if (!row) {
          continue;
        }
        rows.push({
          date: day.date,
          range: day.range,
          active_seconds: Number(row.active_seconds || 0),
          redmine_seconds:
            row.redmine_seconds === null || row.redmine_seconds === undefined
              ? null
              : Number(row.redmine_seconds || 0),
          delta_seconds:
            row.delta_seconds === null || row.delta_seconds === undefined
              ? null
              : Number(row.delta_seconds || 0),
          matched: Boolean(row.matched),
          entries: row.entries || [],
        });
      }
      return rows;
    },
    activeDayCount() {
      return this.myDays.filter(day => day.active_seconds > 0).length;
    },
    averagePerActiveDay() {
      const count = this.activeDayCount;
      if (!count) {
        return null;
      }
      const total = this.myDays.reduce((sum, day) => sum + day.active_seconds, 0);
      return Math.round(total / count);
    },
    dayBarMax() {
      let max = 0;
      for (const day of this.myDays) {
        max = Math.max(max, day.active_seconds, Number(day.redmine_seconds || 0));
      }
      return max;
    },
    myProjects() {
      return [...(this.myRedmineRow?.projects || [])].sort(
        (left, right) => Number(right.seconds || 0) - Number(left.seconds || 0)
      );
    },
    projectTotalSeconds() {
      return this.myProjects.reduce((sum, project) => sum + Number(project.seconds || 0), 0);
    },
    redmineNotice() {
      if (this.redmineError) {
        return this.redmineError;
      }
      if (!this.hasLoaded || this.redmineLoading || !this.myRedmineRow) {
        return '';
      }
      const redmineStatus = String(this.myRedmineRow.status || '');
      if (redmineStatus && redmineStatus !== 'matched' && redmineStatus !== 'not_loaded') {
        return this.$tr('No Redmine account is mapped to your user, so booked hours are missing.');
      }
      return '';
    },
  },
  watch: {
    startDate() {
      this.clearResults();
    },
    endDate() {
      this.clearResults();
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    isOwnUsername(username) {
      return String(username || '').toLowerCase() === this.ownUsername.toLowerCase();
    },
    presetRange(key) {
      const today = moment();
      switch (key) {
        case 'today':
          return { start: today.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
        case 'yesterday': {
          const yesterday = moment().subtract(1, 'day');
          return { start: yesterday.format('YYYY-MM-DD'), end: yesterday.format('YYYY-MM-DD') };
        }
        case 'this-week':
          return {
            start: moment().startOf('isoWeek').format('YYYY-MM-DD'),
            end: today.format('YYYY-MM-DD'),
          };
        case 'last-week': {
          const start = moment().subtract(1, 'week').startOf('isoWeek');
          return {
            start: start.format('YYYY-MM-DD'),
            end: start.clone().endOf('isoWeek').format('YYYY-MM-DD'),
          };
        }
        case 'this-month':
          return {
            start: moment().startOf('month').format('YYYY-MM-DD'),
            end: today.format('YYYY-MM-DD'),
          };
        case 'last-month': {
          const start = moment().subtract(1, 'month').startOf('month');
          return {
            start: start.format('YYYY-MM-DD'),
            end: start.clone().endOf('month').format('YYYY-MM-DD'),
          };
        }
        default:
          return { start: this.startDate, end: this.endDate };
      }
    },
    applyPreset(key) {
      const range = this.presetRange(key);
      this.startDate = range.start;
      this.endDate = range.end;
      this.$nextTick(() => this.load());
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
    buildParams() {
      return {
        start: this.rangeBoundary(this.startDate).toISOString(),
        end: this.rangeBoundary(this.endDate).add(1, 'day').toISOString(),
        exclude_inactive_session_afk: 'true',
        // The server rewrites this to the logged-in user anyway (own-summary
        // grant); sending it keeps the request honest for admins too.
        usernames: [this.ownUsername],
      };
    },
    clearResults() {
      this.summaryRequestId += 1;
      this.redmineRequestId += 1;
      this.dailyRequestId += 1;
      this.hasLoaded = false;
      this.loading = false;
      this.redmineLoading = false;
      this.dailyLoading = false;
      this.loadError = '';
      this.redmineError = '';
      this.dailyError = '';
      this.summaryResult = null;
      this.redmineResult = null;
      this.dailyComparison = null;
      this.dailyReloadingDays = {};
    },
    async load() {
      if (!this.canLoad) {
        return;
      }
      const requestId = this.summaryRequestId + 1;
      this.summaryRequestId = requestId;
      this.redmineRequestId += 1;
      this.dailyRequestId += 1;
      this.loading = true;
      this.hasLoaded = false;
      this.loadError = '';
      this.redmineError = '';
      this.dailyError = '';
      this.summaryResult = null;
      this.redmineResult = null;
      this.dailyComparison = null;
      try {
        const summary = await this.fleetStore.loadSummary(this.buildParams());
        if (requestId !== this.summaryRequestId) {
          return;
        }
        this.summaryResult = summary;
        this.hasLoaded = true;
        // Redmine and the per-day breakdown are what this page is for, so they
        // load with it; a failure warns but never hides the tracked time.
        this.loadRedmineComparison();
        if (this.dailyAutoLoads) {
          this.loadDailyComparison();
        }
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
      if (!this.canLoad) {
        return;
      }
      this.precomputing = true;
      this.loadError = '';
      try {
        await this.fleetStore.precomputeSummary({
          ...this.buildParams(),
          force: true,
          start_of_day: this.settingsStore.startOfDay,
        });
        await this.load();
      } catch (error) {
        this.loadError = this.$tr('Unable to recalculate fleet summary');
      } finally {
        this.precomputing = false;
      }
    },
    async loadRedmineComparison() {
      const requestId = this.redmineRequestId + 1;
      this.redmineRequestId = requestId;
      this.redmineLoading = true;
      this.redmineError = '';
      try {
        const comparison = await this.fleetStore.loadRedmineComparison(this.buildParams());
        if (requestId !== this.redmineRequestId) {
          return;
        }
        this.redmineResult = comparison;
        if (comparison.error) {
          this.redmineError = comparison.error;
        } else if (!comparison.enabled) {
          this.redmineError = comparison.message || this.$tr('Redmine integration is disabled');
        }
      } catch (error) {
        if (requestId === this.redmineRequestId) {
          this.redmineError = this.extractError(error);
        }
      } finally {
        if (requestId === this.redmineRequestId) {
          this.redmineLoading = false;
        }
      }
    },
    async loadDailyComparison() {
      if (!this.canLoad) {
        return;
      }
      const requestId = this.dailyRequestId + 1;
      this.dailyRequestId = requestId;
      this.dailyLoading = true;
      this.dailyError = '';
      try {
        const comparison = await this.fleetStore.loadRedmineDailyComparison(this.buildParams());
        if (requestId !== this.dailyRequestId) {
          return;
        }
        this.dailyComparison = comparison;
        // Redmine being switched off is reported once, at the top of the page;
        // the days themselves are still real, so they are not an error here.
        if (comparison.error) {
          this.dailyError = comparison.error;
        }
      } catch (error) {
        if (requestId === this.dailyRequestId) {
          this.dailyError = this.extractError(error);
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
          usernames: [this.ownUsername],
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
        this.dailyError = this.extractError(error);
      } finally {
        this.$set(this.dailyReloadingDays, day.date, false);
      }
    },
    extractError(error) {
      const errorData = error?.response?.data || {};
      return (
        errorData.error ||
        errorData.message ||
        errorData.detail ||
        this.$tr('Unable to load Redmine comparison')
      );
    },
    barWidth(seconds) {
      const max = this.dayBarMax;
      if (!max || !seconds) {
        return '0%';
      }
      return Math.max(2, Math.round((Number(seconds) / max) * 100)) + '%';
    },
    projectWidth(seconds) {
      const max = Number(this.myProjects[0]?.seconds || 0);
      if (!max || !seconds) {
        return '0%';
      }
      return Math.max(2, Math.round((Number(seconds) / max) * 100)) + '%';
    },
    projectShare(seconds) {
      const total = this.projectTotalSeconds;
      if (!total) {
        return '';
      }
      return Math.round((Number(seconds || 0) / total) * 100) + '%';
    },
    deltaClassFor(seconds) {
      if (seconds === null || seconds === undefined) {
        return 'text-muted';
      }
      const value = Math.abs(Number(seconds));
      if (value <= DELTA_OK_SECONDS) {
        return 'text-success';
      }
      return value <= DELTA_WARN_SECONDS ? 'text-warning' : 'text-danger';
    },
    formatDayDate(date) {
      const parsed = moment(date, 'YYYY-MM-DD', true);
      return parsed.isValid() ? parsed.format('dddd, ll') : date;
    },
    formatSignedDuration(seconds) {
      const value = Number(seconds || 0);
      if (value === 0) {
        return seconds_to_duration(0);
      }
      return (value > 0 ? '+' : '-') + seconds_to_duration(Math.abs(value));
    },
  },
};
</script>

<style scoped lang="scss">
.my-summary-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.my-summary-dates {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.my-summary-date {
  min-width: 10rem;
}

.my-summary-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.75rem;
}

.my-summary-tile {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 0.35rem;
  background: rgba(128, 128, 128, 0.04);
}

.my-summary-tile-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--gray);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.my-summary-tile-value {
  margin-top: 0.2rem;
  font-size: 1.45rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.my-summary-tile-hint {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--gray);
  overflow-wrap: anywhere;
}

.my-summary-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.my-summary-card-head > :last-child {
  margin-left: auto;
}

.my-day {
  padding: 0.75rem 0;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.my-day:first-child {
  border-top: none;
  padding-top: 0;
}

.my-day-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem;
}

.my-day-date {
  font-weight: 600;
}

.my-day-delta {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.my-day-reload {
  margin-left: auto;
  padding: 0.1rem 0.45rem;
}

.my-day-bars {
  margin-top: 0.4rem;
  display: grid;
  gap: 0.25rem;
}

.my-day-bar {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) 6rem;
  align-items: center;
  gap: 0.6rem;
}

.my-day-bar-label {
  font-size: 0.78rem;
  color: var(--gray);
}

.my-day-bar-track {
  height: 0.6rem;
  border-radius: 0.3rem;
  background: rgba(128, 128, 128, 0.18);
  overflow: hidden;
}

.my-day-bar-fill {
  height: 100%;
  border-radius: 0.3rem;
}

.my-day-bar-fill.is-active {
  background: #2f80ed;
}

.my-day-bar-fill.is-booked {
  background: #6fcf97;
}

.my-day-bar-value {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  text-align: right;
}

.my-day-entries {
  margin-top: 0.45rem;
  padding-left: 5.1rem;
}

.my-day-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.my-day-entry-project {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.my-day-entry-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.my-day-entry-comment {
  color: var(--gray);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.my-project {
  display: grid;
  grid-template-columns: minmax(8rem, 16rem) minmax(0, 1fr) 6rem 3rem;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0;
}

.my-project-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.my-project-track {
  height: 0.6rem;
  border-radius: 0.3rem;
  background: rgba(128, 128, 128, 0.18);
  overflow: hidden;
}

.my-project-fill {
  height: 100%;
  border-radius: 0.3rem;
  background: #9b51e0;
}

.my-project-time {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.my-project-share {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--gray);
  font-size: 0.85rem;
}

@media (max-width: 767.98px) {
  .my-day-bar {
    grid-template-columns: 4rem minmax(0, 1fr) 5rem;
  }

  .my-day-entries {
    padding-left: 0;
  }

  .my-project {
    grid-template-columns: minmax(0, 1fr) 5rem;
  }

  .my-project-track {
    display: none;
  }
}
</style>
