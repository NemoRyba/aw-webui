<template lang="pug">
div.fleet-activity-summary.mb-3
  div.d-flex.align-items-center.mb-3
    div
      h5.mb-0 {{ $tr('Summary') }}
      div.text-muted.small(v-if="rangeLabel") {{ rangeLabel }}
    b-button-group.ml-auto
      b-button(
        size="sm"
        variant="outline-dark"
        :pressed.sync="showFilters"
      )
        icon(name="filter")
        span.d-none.d-md-inline.ml-1
          | {{ $tr('Filters') }}
          b-badge.ml-1(pill variant="secondary" v-if="filterCount > 0") {{ filterCount }}
      b-button(size="sm" variant="outline-dark" @click="loadRawEvents" :disabled="loading")
        icon(name="sync")
        span.d-none.d-md-inline.ml-1 {{ $tr('Refresh') }}

  div.fleet-summary-filters.mb-3(v-if="showFilters")
    div.row
      div.col-lg-5.mb-2.mb-lg-0
        label.small.text-muted(for="fleet-summary-search") {{ $tr('Search activity') }}
        b-form-input#fleet-summary-search(
          v-model.trim="textFilter"
          size="sm"
          type="search"
          :placeholder="$tr('Filter app, title, URL, device...')"
        )
      div.col-lg-7
        label.small.text-muted.d-block {{ $tr('Toggles') }}
        b-form-checkbox(v-model="showAfkTime" size="sm")
          | {{ $tr('Show AFK time') }}
        b-form-checkbox(
          v-model="countAudibleBrowserTime"
          :disabled="showAfkTime"
          size="sm"
        )
          | {{ $tr('Count audible browser tab as active') }}
    div.fleet-filter-meta.small.text-muted.mt-2(v-if="activeWindowEvents.length > 0")
      | {{ $tr('Events counted: {count}', { count: filteredWindowEvents.length }) }}

  b-alert(v-if="loadError" show variant="danger")
    | {{ loadError }}

  div.aw-loading(v-if="loading")
    | {{ $tr('Loading...') }}

  b-alert(v-else-if="activeWindowEvents.length === 0" show variant="info")
    | {{ $tr('No activity summary data found for the selected range.') }}

  b-alert(v-else-if="filteredWindowEvents.length === 0" show variant="info")
    | {{ $tr('No activity summary data matches the current filters.') }}

  div.row(v-else)
    div.col-12.mb-3
      div.fleet-summary-panel.fleet-summary-panel--timeline
        h6.mb-3 {{ $tr('Timeline (barchart)') }}
        div.fleet-chart-scroll
          div.fleet-chart(:style="{ minWidth: timelineChartMinWidth }")
            bar(
              v-if="timelineDatasets.length > 0"
              :chart-data="timelineChartData"
              :chart-options="timelineChartOptions"
              :height="440"
            )
            div.fleet-summary-empty(v-else) {{ $tr('No data') }}

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        h6.mb-3 {{ $tr('Top Applications') }}
        aw-summary(
          :fields="topAppEvents"
          :namefunc="event => event.data.app"
          :colorfunc="event => event.data.app"
          with_limit
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        h6.mb-3 {{ $tr('Top Window Titles') }}
        aw-summary(
          :fields="topTitleEvents"
          :namefunc="event => event.data.title"
          :hoverfunc="event => event.data.app"
          :colorfunc="event => event.data.app"
          with_limit
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        h6.mb-3 {{ $tr('Top Categories') }}
        aw-summary(
          :fields="topCategoryEvents"
          :namefunc="categoryName"
          :colorfunc="categoryName"
          with_limit
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        h6.mb-3 {{ $tr('Category Tree') }}
        aw-categorytree(:events="topCategoryEvents")

    div.col-md-12.col-xl-4.mb-3
      div.fleet-summary-panel.fleet-summary-panel--sunburst
        h6.mb-3 {{ $tr('Category Sunburst') }}
        aw-sunburst-categories(
          v-if="topCategoriesHierarchy"
          :data="topCategoriesHierarchy"
          style="height: 20em"
        )
        div.fleet-summary-empty(v-else) {{ $tr('No data') }}
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { ChartOptions } from 'chart.js';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs/legacy';
import 'vue-awesome/icons/filter';
import 'vue-awesome/icons/sync';

import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { build_category_hierarchy, classifyEvents } from '~/util/classes';
import { getBucketIdentity } from '~/util/bucketIdentity';
import { seconds_to_duration } from '~/util/time';
import { detectPreferredTheme } from '~/util/theme';

const CATEGORY_KEY_SEPARATOR = '>>>';
const UNKNOWN = 'Unknown';
const BROWSER_APP_NAMES = new Set(
  [
    'Google Chrome',
    'Google-chrome',
    'chrome.exe',
    'google-chrome-stable',
    'Chromium',
    'Chromium-browser',
    'chromium-browser',
    'Chromium-browser-chromium',
    'chromium.exe',
    'Firefox',
    'Firefox.exe',
    'firefox',
    'firefox.exe',
    'Firefox Developer Edition',
    'Firefox-esr',
    'Firefox Beta',
    'Nightly',
    'LibreWolf-Portable.exe',
    'LibreWolf',
    'LibreWolf.exe',
    'Librewolf',
    'Librewolf.exe',
    'Waterfox',
    'Waterfox.exe',
    'opera.exe',
    'Opera',
    'Brave-browser',
    'brave-browser',
    'Brave Browser',
    'brave.exe',
    'msedge.exe',
    'Microsoft Edge',
    'Microsoft Edge Beta',
    'Microsoft-Edge-Stable',
    'Microsoft-edge',
    'microsoft-edge',
    'Arc.exe',
    'Arc',
    'Vivaldi-stable',
    'Vivaldi-snapshot',
    'vivaldi.exe',
    'Vivaldi',
    'Orion',
    'Yandex',
    'Zen',
    'Zen Browser',
    'Zen-browser',
    'zen.exe',
    'Floorp',
    'floorp.exe',
  ].map(name => name.toLowerCase())
);
const BROWSER_APP_TOKENS = [
  'chrome',
  'chromium',
  'firefox',
  'librewolf',
  'waterfox',
  'opera',
  'brave',
  'msedge',
  'vivaldi',
  'orion',
  'yandex',
  'floorp',
];
const BROWSER_COPY_FIELDS = ['url', '$domain', 'audible', 'browser_title'];

function hasIdentityValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== 'string') {
    return true;
  }
  const normalized = value.trim();
  return normalized !== '' && normalized.toLowerCase() !== 'unknown';
}

function categoryKey(category: string[]): string {
  return (category && category.length > 0 ? category : ['Uncategorized']).join(
    CATEGORY_KEY_SEPARATOR
  );
}

function categoryFromKey(key: string): string[] {
  return key.split(CATEGORY_KEY_SEPARATOR);
}

function pickSubnameAsName(category) {
  category.name = category.subname;
  category.children = (category.children || []).map(pickSubnameAsName);
  return category;
}

export default {
  name: 'FleetActivitySummary',
  components: { Bar },
  props: {
    user: { type: Object, required: true },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore: useSettingsStore(),
      loading: false,
      loadError: '',
      showFilters: false,
      showAfkTime: false,
      countAudibleBrowserTime: true,
      textFilter: '',
      activeWindowEvents: [],
    };
  },
  computed: {
    rangeStart() {
      return moment(this.user?.range?.start);
    },
    rangeEnd() {
      return moment(this.user?.range?.end);
    },
    rangeLabel() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return '';
      }

      const end = this.rangeEnd.clone().subtract(1, 'millisecond');
      return `${this.rangeStart.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`;
    },
    selectedDeviceIds() {
      if (this.user?.selected_devices && this.user.selected_devices.length > 0) {
        return this.user.selected_devices.map(deviceId => String(deviceId));
      }
      return (this.user?.available_devices || []).map(device => String(device.device_id));
    },
    selectedDeviceSet() {
      return new Set(this.selectedDeviceIds);
    },
    reloadKey() {
      return [
        this.user?.username || '',
        this.user?.range?.start || '',
        this.user?.range?.end || '',
        this.selectedDeviceIds.join('|'),
        this.showAfkTime ? 'show-afk' : 'exclude-afk',
        this.countAudibleBrowserTime ? 'audible-active' : 'audible-ignored',
      ].join('::');
    },
    normalizedTextFilter() {
      return String(this.textFilter || '')
        .trim()
        .toLowerCase();
    },
    filterCount() {
      return (
        (this.showAfkTime ? 1 : 0) +
        (!this.showAfkTime && !this.countAudibleBrowserTime ? 1 : 0) +
        (this.normalizedTextFilter ? 1 : 0)
      );
    },
    filteredWindowEvents() {
      if (!this.normalizedTextFilter) {
        return this.activeWindowEvents;
      }
      return this.activeWindowEvents.filter(event =>
        this.eventMatchesText(event, this.normalizedTextFilter)
      );
    },
    topAppEvents() {
      return this.groupDurationEvents(this.summaryWindowEvents, 'app', event => {
        return event.data.app || event.data.process_name || UNKNOWN;
      });
    },
    topTitleEvents() {
      return this.groupDurationEvents(
        this.summaryWindowEvents,
        'title',
        event => event.data.title || '(no title)',
        event => ({
          app: event.data.app || event.data.process_name || UNKNOWN,
        })
      );
    },
    categorizedWindowEvents() {
      if (!this.categoryStore.classes || this.categoryStore.classes.length === 0) {
        return [];
      }

      const events = classifyEvents(
        _.cloneDeep(this.filteredWindowEvents),
        this.categoryStore.classes
      );
      return events.map(event => {
        const category = event.data.$category || ['Uncategorized'];
        event.data.$category = category;
        event.data.$color = this.categoryStore.get_category_color(category);
        event.data.$score = this.categoryStore.get_category_score(category);
        return event;
      });
    },
    summaryWindowEvents() {
      if (this.categorizedWindowEvents.length > 0 || this.filteredWindowEvents.length === 0) {
        return this.categorizedWindowEvents;
      }
      return this.filteredWindowEvents;
    },
    topCategoryEvents() {
      return this.groupDurationEvents(this.categorizedWindowEvents, '$category', event => {
        return categoryKey(event.data.$category);
      }).map(event => {
        const category = categoryFromKey(event.data.$category);
        event.data.$category = category;
        event.data.$color = this.categoryStore.get_category_color(category);
        event.data.$score = this.categoryStore.get_category_score(category);
        return event;
      });
    },
    topCategoriesHierarchy() {
      if (!this.topCategoryEvents || this.topCategoryEvents.length === 0) {
        return null;
      }

      const categories = this.topCategoryEvents.map(event => {
        return { name: event.data.$category, size: event.duration };
      });

      return {
        name: 'All',
        children: build_category_hierarchy(categories).map(category => pickSubnameAsName(category)),
      };
    },
    timelineBins() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return [];
      }

      const totalDays = Math.max(1, this.rangeEnd.diff(this.rangeStart, 'days', true));
      let unit = 'day';
      if (totalDays <= 2) {
        unit = 'hour';
      } else if (totalDays > 370) {
        unit = 'month';
      } else if (totalDays > 70) {
        unit = 'week';
      }

      const start =
        unit === 'week'
          ? this.rangeStart.clone().startOf('isoWeek')
          : this.rangeStart.clone().startOf(unit);
      const bins = [];
      let cursor = start;

      while (cursor.isBefore(this.rangeEnd) && bins.length < 180) {
        const binStart = cursor.clone();
        const binEnd = cursor.clone().add(1, unit);
        bins.push({
          start: binStart,
          end: binEnd,
          label: this.formatBinLabel(binStart, unit),
        });
        cursor = binEnd;
      }

      return bins;
    },
    timelineDatasets() {
      if (this.timelineBins.length === 0 || this.categorizedWindowEvents.length === 0) {
        return [];
      }

      const topCategoryKeys = this.topCategoryEvents
        .slice(0, 8)
        .map(event => categoryKey(event.data.$category));
      const topCategorySet = new Set(topCategoryKeys);
      const datasetByCategory = {};

      const ensureDataset = (key, category) => {
        if (!datasetByCategory[key]) {
          datasetByCategory[key] = {
            key,
            category,
            data: Array.from({ length: this.timelineBins.length }, () => 0),
          };
        }
        return datasetByCategory[key];
      };

      for (const event of this.categorizedWindowEvents) {
        const eventStart = moment(event.timestamp);
        const eventEnd = eventStart.clone().add(event.duration, 'seconds');
        const eventCategory = event.data.$category || ['Uncategorized'];
        const key = categoryKey(eventCategory);
        const datasetKey = topCategorySet.has(key) ? key : 'Other';
        const dataset = ensureDataset(
          datasetKey,
          datasetKey === 'Other' ? ['Other'] : eventCategory
        );

        this.timelineBins.forEach((bin, index) => {
          const seconds = this.overlapSeconds(eventStart, eventEnd, bin.start, bin.end);
          if (seconds > 0) {
            dataset.data[index] += seconds / 3600;
          }
        });
      }

      return Object.values(datasetByCategory).map((dataset: any) => {
        const isOther = dataset.key === 'Other';
        const category = dataset.category;
        return {
          label: category.join(' > '),
          backgroundColor: isOther ? '#adb5bd' : this.categoryStore.get_category_color(category),
          data: dataset.data.map(value => Math.round(value * 1000) / 1000),
        };
      });
    },
    timelineChartData() {
      return {
        labels: this.timelineBins.map(bin => bin.label),
        datasets: this.timelineDatasets,
      };
    },
    timelineChartMinWidth() {
      const binCount = Math.max(1, this.timelineBins.length);
      const pxPerBin = binCount > 90 ? 34 : binCount > 45 ? 42 : binCount > 20 ? 52 : 72;
      return `${Math.max(1040, binCount * pxPerBin)}px`;
    },
    activeTheme() {
      const theme = this.settingsStore.theme || 'auto';
      return theme === 'auto' ? detectPreferredTheme() : theme;
    },
    chartTextColor() {
      return this.activeTheme === 'dark' ? '#e9ebf0' : '#3c4257';
    },
    chartGridColor() {
      return this.activeTheme === 'dark' ? 'rgba(233, 235, 240, 0.18)' : 'rgba(0, 0, 0, 0.1)';
    },
    timelineChartOptions(): ChartOptions {
      const formatDuration = value => seconds_to_duration(Number(value || 0) * 3600);
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            mode: 'point',
            intersect: false,
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${formatDuration(context.parsed.y)}`;
              },
            },
          },
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              color: this.chartTextColor,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: this.chartTextColor,
            },
            grid: {
              color: this.chartGridColor,
            },
          },
          y: {
            stacked: true,
            min: 0,
            grid: {
              color: this.chartGridColor,
            },
            ticks: {
              color: this.chartTextColor,
              callback(value) {
                const hours = Number(value || 0);
                return hours >= 1 ? `${hours}h` : `${Math.round(hours * 60)}m`;
              },
            },
          },
        },
      };
    },
  },
  watch: {
    reloadKey: {
      immediate: true,
      handler() {
        this.loadRawEvents();
      },
    },
  },
  methods: {
    async loadRawEvents() {
      if (!this.user || !this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return;
      }

      const requestKey = this.reloadKey;
      this.loading = true;
      this.loadError = '';

      try {
        if (!this.categoryStore.classes || this.categoryStore.classes.length === 0) {
          this.categoryStore.load();
        }

        const buckets = await this.loadSummaryBuckets();

        if (requestKey !== this.reloadKey) {
          return;
        }

        this.activeWindowEvents = this.buildActiveWindowEvents(buckets);
      } catch (error) {
        console.error('Unable to load fleet activity summary:', error);
        this.loadError = this.$tr('Unable to load activity summary');
        this.activeWindowEvents = [];
      } finally {
        if (requestKey === this.reloadKey) {
          this.loading = false;
        }
      }
    },
    async loadSummaryBuckets() {
      await this.bucketsStore.ensureLoaded();
      const candidateBuckets = (this.bucketsStore.buckets || []).filter(bucket =>
        this.isSummaryBucketCandidate(bucket)
      );

      return Promise.all(
        candidateBuckets.map(bucket =>
          this.bucketsStore.getBucketWithEvents({
            id: bucket.id,
            start: this.rangeStart.format(),
            end: this.rangeEnd.format(),
          })
        )
      );
    },
    isSummaryBucketCandidate(bucket) {
      if (
        !this.isWindowBucket(bucket) &&
        bucket?.type !== 'afkstatus' &&
        !this.isBrowserBucket(bucket)
      ) {
        return false;
      }

      const identity = getBucketIdentity(bucket);
      if (hasIdentityValue(identity.username) && identity.username !== this.user.username) {
        return false;
      }
      if (
        this.selectedDeviceSet.size > 0 &&
        hasIdentityValue(identity.deviceId) &&
        !this.selectedDeviceSet.has(identity.deviceId)
      ) {
        return false;
      }

      return true;
    },
    buildActiveWindowEvents(buckets) {
      const browserEvents = this.buildBrowserEvents(buckets);
      const activeContext = this.showAfkTime
        ? { intervalsBySession: new Map(), sessionsWithAfkData: new Set() }
        : this.buildActiveIntervalsBySession(buckets, browserEvents);
      const events = [];

      for (const bucket of buckets || []) {
        if (!this.isWindowBucket(bucket)) {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity)) {
            continue;
          }

          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          const key = this.sessionKey(identity);
          let segments = [interval];
          if (!this.showAfkTime) {
            const activeIntervals = activeContext.intervalsBySession.get(key);
            if (activeIntervals && activeIntervals.length > 0) {
              segments = this.intersectWithIntervals(interval, activeIntervals);
            } else if (activeContext.sessionsWithAfkData.has(key)) {
              segments = [];
            }
          }

          for (const segment of segments) {
            const duration = segment.end.diff(segment.start, 'seconds', true);
            if (duration <= 1) {
              continue;
            }

            const data = {
              ...(event.data || {}),
              username: identity.username,
              device_id: identity.deviceId,
              device_name: identity.deviceName,
              session_id: identity.sessionId,
              app: event.data?.app || event.data?.process_name || UNKNOWN,
              title: event.data?.title || '(no title)',
            };

            events.push({
              ...event,
              timestamp: segment.start.format(),
              duration,
              data,
            });
          }
        }
      }

      return _.sortBy(this.enrichWindowSegmentsWithBrowserData(events, browserEvents), event =>
        moment(event.timestamp).valueOf()
      );
    },
    buildActiveIntervalsBySession(buckets, browserEvents = []) {
      const intervalsBySession = new Map();
      const sessionsWithAfkData = new Set();

      for (const bucket of buckets || []) {
        if (bucket?.type !== 'afkstatus') {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity)) {
            continue;
          }
          const key = this.sessionKey(identity);
          sessionsWithAfkData.add(key);
          if ((event.data || {}).status !== 'not-afk') {
            continue;
          }

          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          const intervals = intervalsBySession.get(key) || [];
          intervals.push(interval);
          intervalsBySession.set(key, intervals);
        }
      }

      if (this.countAudibleBrowserTime) {
        this.addAudibleBrowserIntervalsToSessions(
          buckets,
          browserEvents,
          intervalsBySession,
          sessionsWithAfkData
        );
      }

      for (const [key, intervals] of intervalsBySession.entries()) {
        intervalsBySession.set(key, this.mergeIntervals(intervals));
      }

      return { intervalsBySession, sessionsWithAfkData };
    },
    addAudibleBrowserIntervalsToSessions(
      buckets,
      browserEvents,
      intervalsBySession,
      sessionsWithAfkData
    ) {
      const audibleBrowserIntervals = (browserEvents || [])
        .filter(event => this.isAudibleBrowserEvent(event))
        .map(event => this.clipEventInterval(event))
        .filter(interval => interval);

      if (audibleBrowserIntervals.length === 0) {
        return;
      }

      for (const bucket of buckets || []) {
        if (!this.isWindowBucket(bucket)) {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity) || !this.isBrowserWindowEvent(event)) {
            continue;
          }

          const key = this.sessionKey(identity);
          if (!sessionsWithAfkData.has(key)) {
            continue;
          }

          const windowInterval = this.clipEventInterval(event);
          if (!windowInterval) {
            continue;
          }

          const audibleSegments = this.intersectWithIntervals(
            windowInterval,
            audibleBrowserIntervals
          );
          if (audibleSegments.length === 0) {
            continue;
          }

          const intervals = intervalsBySession.get(key) || [];
          intervals.push(...audibleSegments);
          intervalsBySession.set(key, intervals);
        }
      }
    },
    buildBrowserEvents(buckets) {
      const events = [];

      for (const bucket of buckets || []) {
        if (!this.isBrowserBucket(bucket)) {
          continue;
        }

        for (const event of bucket.events || []) {
          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          const data = { ...(event.data || {}) };
          if (data.title && !data.browser_title) {
            data.browser_title = data.title;
          }
          if (data.url && !data.$domain) {
            data.$domain = this.domainFromUrl(data.url);
          }

          events.push({
            ...event,
            timestamp: interval.start.format(),
            duration: interval.end.diff(interval.start, 'seconds', true),
            data,
          });
        }
      }

      return _.sortBy(events, event => moment(event.timestamp).valueOf());
    },
    enrichWindowSegmentsWithBrowserData(windowEvents, browserEvents) {
      if (!browserEvents || browserEvents.length === 0) {
        return windowEvents;
      }

      return _.flatMap(windowEvents, event => {
        if (!this.isBrowserWindowEvent(event)) {
          return [event];
        }
        return this.enrichWindowSegmentWithBrowserData(event, browserEvents);
      });
    },
    enrichWindowSegmentWithBrowserData(event, browserEvents) {
      const baseStart = moment(event.timestamp);
      const baseEnd = baseStart.clone().add(Number(event.duration || 0), 'seconds');
      const boundaries = new Set([baseStart.valueOf(), baseEnd.valueOf()]);
      const overlaps = [];

      for (const browserEvent of browserEvents) {
        const browserStart = moment(browserEvent.timestamp);
        const browserEnd = browserStart.clone().add(Number(browserEvent.duration || 0), 'seconds');

        if (browserEnd.isSameOrBefore(baseStart)) {
          continue;
        }
        if (browserStart.isSameOrAfter(baseEnd)) {
          break;
        }

        const start = moment.max(baseStart, browserStart);
        const end = moment.min(baseEnd, browserEnd);
        if (!end.isAfter(start)) {
          continue;
        }

        boundaries.add(start.valueOf());
        boundaries.add(end.valueOf());
        overlaps.push({
          event: browserEvent,
          start: browserStart,
          end: browserEnd,
        });
      }

      if (overlaps.length === 0) {
        return [event];
      }

      const points = Array.from(boundaries).sort((left, right) => Number(left) - Number(right));
      const segments = [];

      for (let index = 0; index < points.length - 1; index += 1) {
        const start = moment(Number(points[index]));
        const end = moment(Number(points[index + 1]));
        const browserEvent = this.pickBrowserEventForSegment(start, end, overlaps);
        const data = { ...(event.data || {}) };

        if (browserEvent) {
          this.copyBrowserData(data, browserEvent.data || {});
        }

        this.pushMergedSegment(segments, {
          ...event,
          timestamp: start.format(),
          duration: end.diff(start, 'seconds', true),
          data,
        });
      }

      return segments;
    },
    pickBrowserEventForSegment(start, end, overlaps) {
      let picked = null;

      for (const overlap of overlaps) {
        if (!end.isAfter(overlap.start) || !start.isBefore(overlap.end)) {
          continue;
        }
        if (!picked || moment(overlap.event.timestamp).isAfter(moment(picked.timestamp))) {
          picked = overlap.event;
        }
      }

      return picked;
    },
    copyBrowserData(targetData, browserData) {
      const data = { ...browserData };
      if (data.title && !data.browser_title) {
        data.browser_title = data.title;
      }
      if (data.url && !data.$domain) {
        data.$domain = this.domainFromUrl(data.url);
      }

      for (const key of BROWSER_COPY_FIELDS) {
        if (data[key] !== undefined && targetData[key] === undefined) {
          targetData[key] = data[key];
        }
      }
    },
    pushMergedSegment(segments, segment) {
      const last = segments[segments.length - 1];
      const segmentEnd = moment(segment.timestamp).add(Number(segment.duration || 0), 'seconds');
      if (
        last &&
        moment(last.timestamp)
          .add(Number(last.duration || 0), 'seconds')
          .isSame(moment(segment.timestamp)) &&
        _.isEqual(last.data, segment.data)
      ) {
        last.duration += segment.duration;
        return;
      }

      if (segmentEnd.isAfter(moment(segment.timestamp))) {
        segments.push(segment);
      }
    },
    clipEventInterval(event) {
      const eventStart = moment(event.timestamp);
      const eventEnd = eventStart.clone().add(Number(event.duration || 0), 'seconds');
      const start = moment.max(eventStart, this.rangeStart);
      const end = moment.min(eventEnd, this.rangeEnd);

      if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
        return null;
      }

      return { start, end };
    },
    intersectWithIntervals(interval, activeIntervals) {
      const segments = [];
      for (const activeInterval of activeIntervals) {
        const start = moment.max(interval.start, activeInterval.start);
        const end = moment.min(interval.end, activeInterval.end);
        if (end.isAfter(start)) {
          segments.push({ start, end });
        }
      }
      return segments;
    },
    mergeIntervals(intervals) {
      const sortedIntervals = _.sortBy(intervals, interval => interval.start.valueOf());
      const merged = [];

      for (const interval of sortedIntervals) {
        const last = merged[merged.length - 1];
        if (!last || interval.start.isAfter(last.end)) {
          merged.push({ start: interval.start.clone(), end: interval.end.clone() });
          continue;
        }
        if (interval.end.isAfter(last.end)) {
          last.end = interval.end.clone();
        }
      }

      return merged;
    },
    eventIdentity(bucket, event) {
      const bucketIdentity = getBucketIdentity(bucket);
      const data = event?.data || {};
      const pick = (dataKey, fallback) => {
        return hasIdentityValue(data[dataKey]) ? String(data[dataKey]) : fallback;
      };

      return {
        username: pick('username', bucketIdentity.username),
        deviceId: pick('device_id', bucketIdentity.deviceId),
        deviceName: pick('device_name', bucketIdentity.deviceName),
        sessionId: pick('session_id', bucketIdentity.sessionId),
      };
    },
    matchesIdentity(identity) {
      if (identity.username !== this.user.username) {
        return false;
      }
      if (this.selectedDeviceSet.size === 0) {
        return true;
      }
      return this.selectedDeviceSet.has(identity.deviceId);
    },
    sessionKey(identity) {
      return [identity.username, identity.deviceId, identity.sessionId].join('::');
    },
    isWindowBucket(bucket) {
      return (
        bucket?.type === 'currentwindow' &&
        !String(bucket?.id || '').startsWith('aw-watcher-android')
      );
    },
    isBrowserBucket(bucket) {
      return bucket?.type === 'web.tab.current';
    },
    isAudibleBrowserEvent(event) {
      const audible = (event.data || {}).audible;
      return audible === true || audible === 'true' || audible === 1;
    },
    isBrowserWindowEvent(event) {
      return this.isBrowserApp(event.data?.app || event.data?.process_name || '');
    },
    isBrowserApp(app) {
      const normalized = String(app || '')
        .trim()
        .toLowerCase();
      if (!normalized) {
        return false;
      }
      if (BROWSER_APP_NAMES.has(normalized)) {
        return true;
      }
      return BROWSER_APP_TOKENS.some(token => normalized.includes(token));
    },
    domainFromUrl(url) {
      try {
        return new URL(url).hostname;
      } catch (_error) {
        return '';
      }
    },
    eventMatchesText(event, query) {
      const values = [];
      this.collectSearchValues(event?.data || {}, values);
      return values.join(' ').toLowerCase().includes(query);
    },
    collectSearchValues(value, values) {
      if (value === null || value === undefined) {
        return;
      }

      if (['string', 'number', 'boolean'].includes(typeof value)) {
        values.push(String(value));
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => this.collectSearchValues(item, values));
        return;
      }

      if (typeof value === 'object') {
        Object.keys(value).forEach(key => {
          values.push(key);
          this.collectSearchValues(value[key], values);
        });
      }
    },
    groupDurationEvents(events, key, labelFunc, extraDataFunc = (_event: any) => ({})) {
      const grouped = new Map();

      for (const event of events || []) {
        const label = String(labelFunc(event) || UNKNOWN);
        const item = grouped.get(label) || {
          timestamp: event.timestamp,
          duration: 0,
          data: {
            [key]: label,
            ...extraDataFunc(event),
          },
          colorSegmentsByCategory: new Map(),
        };
        item.duration += Number(event.duration || 0);
        this.addColorSegmentData(item, event);
        grouped.set(label, item);
      }

      return _.orderBy(
        Array.from(grouped.values()).map(item => {
          if (item.colorSegmentsByCategory.size > 0) {
            item.data.$colorSegments = _.orderBy(
              Array.from(item.colorSegmentsByCategory.values()),
              ['duration'],
              ['desc']
            );
            item.data.$color = item.data.$colorSegments[0].color;
          }
          delete item.colorSegmentsByCategory;
          return item;
        }),
        ['duration'],
        ['desc']
      );
    },
    addColorSegmentData(groupedItem, event) {
      const category = event.data?.$category;
      if (!category || category.length === 0) {
        return;
      }

      const key = categoryKey(category);
      const existing = groupedItem.colorSegmentsByCategory.get(key) || {
        label: category.join(' > '),
        color: event.data.$color || this.categoryStore.get_category_color(category),
        duration: 0,
      };
      existing.duration += Number(event.duration || 0);
      groupedItem.colorSegmentsByCategory.set(key, existing);
    },
    categoryName(event) {
      return (event.data.$category || ['Uncategorized']).join(' > ');
    },
    overlapSeconds(start, end, otherStart, otherEnd) {
      const overlapStart = moment.max(start, otherStart);
      const overlapEnd = moment.min(end, otherEnd);
      if (!overlapEnd.isAfter(overlapStart)) {
        return 0;
      }
      return overlapEnd.diff(overlapStart, 'seconds', true);
    },
    formatBinLabel(start, unit) {
      if (unit === 'hour') {
        return start.format('HH:mm');
      }
      if (unit === 'week') {
        return start.format('MMM D');
      }
      if (unit === 'month') {
        return start.format('MMM YYYY');
      }
      return start.format('MMM D');
    },
  },
};
</script>

<style scoped lang="scss">
@import '../../style/globals';

.fleet-activity-summary {
  padding: 1rem;
  border: 1px solid $lightBorderColor;
  border-radius: 0.5rem;
  background: #fff;
}

.fleet-summary-panel {
  height: 100%;
  min-height: 15rem;
  padding: 0.75rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.45rem;
  background: #fbfcfe;
}

.fleet-summary-panel--timeline {
  min-height: 32rem;
}

.fleet-summary-filters {
  padding: 0.75rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.45rem;
  background: #f5f7fb;
}

.fleet-filter-meta {
  line-height: 1.4;
}

.fleet-summary-panel--sunburst {
  overflow: hidden;
}

.fleet-chart-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.35rem;
}

.fleet-chart {
  height: 28rem;
}

.fleet-summary-empty {
  color: #999;
  font-size: 1.2rem;
}
</style>
