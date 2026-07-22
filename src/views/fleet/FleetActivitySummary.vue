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
        b-form-checkbox(v-model="subtractAfkTime" size="sm")
          | {{ $tr('Subtract AFK time') }}
        b-form-checkbox(
          v-model="countAudibleBrowserTime"
          :disabled="!subtractAfkTime"
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
        div.fleet-timeline-chart(v-if="timelineDatasets.length > 0")
          div.fleet-y-axis(:style="{ color: chartTextColor }")
            div.fleet-y-axis-unit {{ $tr('Hours') }}
            div(
              v-for="tick in timelineYAxisTicks"
              :key="tick.value"
              class="fleet-y-axis-tick"
              :style="{ top: tick.top }"
            ) {{ tick.label }}
          div.fleet-chart-scroll
            div.fleet-chart(:style="{ minWidth: timelineChartMinWidth }")
              bar(
                :chart-data="timelineChartData"
                :chart-options="timelineChartOptions"
                :plugins="timelineChartPlugins"
                :height="440"
              )
        div.fleet-summary-empty(v-else) {{ $tr('No data') }}

    div.col-12.mb-3
      div.fleet-summary-panel.fleet-summary-panel--category-tree
        h6.mb-3 {{ $tr('Category Tree') }}
        aw-categorytree(
          :events="categorizedWindowEvents"
          show_colors
          horizontal
          show_apps
        )

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
    const settingsStore = useSettingsStore();
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore,
      loading: false,
      loadError: '',
      showFilters: false,
      showAfkTime: settingsStore.fleetSummaryShowAfkTime,
      countAudibleBrowserTime: !settingsStore.fleetSummaryIgnoreAudibleBrowserTime,
      textFilter: '',
      activeWindowEvents: [],
      timelineChartArea: null,
      loadRequestId: 0,
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
    subtractAfkTime: {
      get() {
        return !this.showAfkTime;
      },
      set(value) {
        this.showAfkTime = !value;
      },
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
        (!this.subtractAfkTime ? 1 : 0) +
        (this.subtractAfkTime && !this.countAudibleBrowserTime ? 1 : 0) +
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
      }

      const start = this.rangeStart.clone().startOf(unit);
      const bins = [];
      let cursor = start;
      const maxBins = unit === 'day' ? 400 : 240;

      while (cursor.isBefore(this.rangeEnd) && bins.length < maxBins) {
        const rawBinStart = cursor.clone();
        const rawBinEnd = cursor.clone().add(1, unit);
        const binStart = moment.max(rawBinStart, this.rangeStart);
        const binEnd = moment.min(rawBinEnd, this.rangeEnd);
        if (binEnd.isAfter(binStart)) {
          bins.push({
            start: binStart.clone(),
            end: binEnd.clone(),
            label: this.formatBinLabel(binStart, binEnd, unit),
          });
        }
        cursor = rawBinEnd;
      }

      return bins;
    },
    timelineSeries() {
      if (this.timelineBins.length === 0 || this.categorizedWindowEvents.length === 0) {
        return { datasets: [], afkData: [] };
      }

      const topCategoryKeys = this.topCategoryEvents
        .slice(0, 8)
        .map(event => categoryKey(event.data.$category));
      const topCategorySet = new Set(topCategoryKeys);
      const datasetByCategory = {};
      const afkData = Array.from({ length: this.timelineBins.length }, () => 0);

      const createDetail = () => ({
        duration: 0,
        afkDuration: 0,
        apps: new Map(),
        titles: new Map(),
        categories: new Map(),
      });
      const ensureDetail = (dataset, index) => {
        if (!dataset.details[index]) {
          dataset.details[index] = createDetail();
        }
        return dataset.details[index];
      };
      const addDetailValue = (values, label, seconds) => {
        const normalizedLabel = String(label || UNKNOWN);
        values.set(normalizedLabel, Number(values.get(normalizedLabel) || 0) + seconds);
      };
      const scaleDetail = (detail, scale) => {
        if (!detail) {
          return;
        }
        detail.duration *= scale;
        detail.afkDuration *= scale;
        [detail.apps, detail.titles, detail.categories].forEach(values => {
          values.forEach((duration, label) => values.set(label, duration * scale));
        });
      };

      const ensureDataset = (key, category) => {
        if (!datasetByCategory[key]) {
          datasetByCategory[key] = {
            key,
            category,
            data: Array.from({ length: this.timelineBins.length }, () => 0),
            details: Array.from({ length: this.timelineBins.length }, () => null),
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
            const hours = seconds / 3600;
            dataset.data[index] += hours;
            if (event.data?.$afk) {
              afkData[index] += hours;
            }

            const detail = ensureDetail(dataset, index);
            detail.duration += seconds;
            if (event.data?.$afk) {
              detail.afkDuration += seconds;
            }
            addDetailValue(
              detail.apps,
              event.data.app || event.data.process_name || UNKNOWN,
              seconds
            );
            addDetailValue(detail.titles, event.data.title || '(no title)', seconds);
            addDetailValue(detail.categories, eventCategory.join(' > '), seconds);
          }
        });
      }

      const datasets = Object.values(datasetByCategory) as any[];
      this.timelineBins.forEach((bin, index) => {
        const binTotal = _.sumBy(datasets, dataset => Number(dataset.data[index] || 0));
        const binCapacity = this.binCapacityHours(bin);

        if (binTotal > binCapacity && binCapacity > 0) {
          const scale = binCapacity / binTotal;
          datasets.forEach(dataset => {
            dataset.data[index] *= scale;
            scaleDetail(dataset.details[index], scale);
          });
          afkData[index] *= scale;
        }

        const visibleTotal = _.sumBy(datasets, dataset => Number(dataset.data[index] || 0));
        afkData[index] = Math.min(afkData[index], visibleTotal, binCapacity);
      });

      return {
        datasets: datasets.map((dataset: any) => {
          const isOther = dataset.key === 'Other';
          const category = dataset.category;
          return {
            label: category.join(' > '),
            backgroundColor: isOther ? '#adb5bd' : this.categoryStore.get_category_color(category),
            data: dataset.data.map(value => Math.round(value * 1000) / 1000),
            $timelineDetails: dataset.details.map(detail =>
              this.serializeTimelineDetail(detail, isOther)
            ),
          };
        }),
        afkData: afkData.map(value => Math.round(value * 1000) / 1000),
      };
    },
    timelineDatasets() {
      return this.timelineSeries.datasets;
    },
    timelineAfkData() {
      return this.timelineSeries.afkData;
    },
    timelineChartPlugins() {
      return [
        this.timelineAfkOverlayPlugin,
        this.timelineAxisTooltipPlugin,
        this.timelineChartAreaPlugin,
      ];
    },
    timelineChartData() {
      return {
        labels: this.timelineBins.map(bin => bin.label),
        datasets: this.timelineDatasets,
      };
    },
    timelineChartMinWidth() {
      const binCount = Math.max(1, this.timelineBins.length);
      const pxPerBin =
        binCount > 180 ? 26 : binCount > 90 ? 34 : binCount > 45 ? 42 : binCount > 20 ? 52 : 72;
      return `${Math.max(1040, binCount * pxPerBin)}px`;
    },
    timelineYAxisMax() {
      if (this.timelineBins.length === 0) {
        return undefined;
      }
      return Math.ceil(Math.max(...this.timelineBins.map(bin => this.binCapacityHours(bin))));
    },
    timelineYTickStep() {
      const max = Number(this.timelineYAxisMax || 0);
      if (max <= 1) {
        return 0.25;
      }
      if (max <= 6) {
        return 1;
      }
      if (max <= 12) {
        return 2;
      }
      if (max <= 24) {
        return 4;
      }
      if (max <= 48) {
        return 8;
      }

      const roughStep = max / 6;
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const normalized = roughStep / magnitude;
      if (normalized <= 1) {
        return magnitude;
      }
      if (normalized <= 2) {
        return 2 * magnitude;
      }
      if (normalized <= 5) {
        return 5 * magnitude;
      }
      return 10 * magnitude;
    },
    timelineYAxisTicks() {
      const max = Number(this.timelineYAxisMax || 0);
      if (max <= 0) {
        return [];
      }

      const step = Number(this.timelineYTickStep || 1);
      const values = [];
      for (let value = 0; value <= max + step / 10; value += step) {
        values.push(Math.min(max, value));
      }
      if (values[values.length - 1] !== max) {
        values.push(max);
      }

      const chartArea = this.timelineChartArea || {};
      const areaTop = Number(chartArea.top ?? 20);
      const areaBottom = Number(chartArea.bottom ?? 380);
      const areaHeight = Math.max(1, areaBottom - areaTop);

      return _.uniq(values)
        .map(value => {
          const tickTop = areaTop + areaHeight * (1 - value / max);
          return {
            value,
            label: this.formatTimelineAxisTick(value),
            top: `${tickTop}px`,
          };
        })
        .reverse();
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
      const afkData = this.timelineAfkData;
      const afkLabel = this.$tr('AFK time');
      const totalTimeLabel = this.$tr('Total time');
      const formatTooltipDetail = this.formatTimelineTooltipDetail.bind(this);
      const plugins: any = {
        tooltip: {
          mode: 'point',
          intersect: false,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatDuration(context.parsed.y)}`;
            },
            afterLabel(context) {
              const dataset: any = context.dataset;
              return formatTooltipDetail(
                dataset?.$timelineDetails?.[context.dataIndex],
                dataset?.label
              );
            },
            footer(items) {
              const index = items?.[0]?.dataIndex;
              const chart: any = items?.[0]?.chart;
              if (chart?.$fleetAxisHoverIndex !== index) {
                return '';
              }

              const totalHours = _.sumBy(chart.data.datasets || [], (dataset: any) => {
                const values = Array.isArray(dataset.data) ? dataset.data : [];
                return Number(values[index] || 0);
              });
              const afkHours = Number(afkData?.[index] || 0);
              const lines = [`${totalTimeLabel}: ${formatDuration(totalHours)}`];
              if (afkHours > 0) {
                lines.push(`${afkLabel}: ${formatDuration(afkHours)}`);
              }
              return lines;
            },
          },
        },
        legend: {
          display: false,
        },
        fleetTimelineAfkOverlay: {
          afkData,
          color: this.settingsStore.afkOverlayColor || '#ff4d4f',
        },
      };

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins,
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
            max: this.timelineYAxisMax,
            grid: {
              color: this.chartGridColor,
              drawBorder: false,
              drawTicks: false,
            },
            ticks: {
              display: false,
              color: this.chartTextColor,
              stepSize: this.timelineYTickStep,
              callback(value) {
                const hours = Number(value || 0);
                return hours >= 1 ? `${hours}h` : `${Math.round(hours * 60)}m`;
              },
            },
          },
        },
      };
    },
    timelineAfkOverlayPlugin() {
      return {
        id: 'fleetTimelineAfkOverlay',
        afterDatasetsDraw: (chart, _args, pluginOptions: any) => {
          const afkData = Array.isArray(pluginOptions?.afkData) ? pluginOptions.afkData : [];
          const overlayColor = pluginOptions?.color || '#ff4d4f';
          const { ctx, chartArea } = chart;
          const xScale = chart.scales?.x;
          const yScale = chart.scales?.y;
          if (!ctx || !chartArea || !xScale || !yScale) {
            return;
          }

          const barMetas = chart.getSortedVisibleDatasetMetas().filter(meta => meta.type === 'bar');

          afkData.forEach((afkHours, index) => {
            const visibleAfkHours = Number(afkHours || 0);
            if (visibleAfkHours <= 0) {
              return;
            }

            const totalHours = _.sumBy(chart.data.datasets || [], (dataset: any) => {
              const values = Array.isArray(dataset.data) ? dataset.data : [];
              return Number(values[index] || 0);
            });
            if (totalHours <= 0) {
              return;
            }

            const sampleBar = barMetas
              .map(meta => meta.data?.[index])
              .find(element => element && !element.hidden);
            const barWidth = Number(sampleBar?.width || 0);
            if (barWidth <= 0) {
              return;
            }

            const x = Number(sampleBar?.x || xScale.getPixelForValue(index));
            const baseY = yScale.getPixelForValue(0);
            const totalY = yScale.getPixelForValue(totalHours);
            const barHeight = Math.abs(baseY - totalY);
            if (barHeight <= 0) {
              return;
            }

            const overlayHeight = barHeight * Math.min(1, visibleAfkHours / totalHours);
            const left = x - barWidth / 2;
            const right = x + barWidth / 2;
            const bottom = Math.min(baseY, chartArea.bottom);
            const overlayTop = bottom - overlayHeight;
            this.drawAfkTimelineOverlay(ctx, left, overlayTop, right, bottom, overlayColor);
          });
        },
      };
    },
    timelineAxisTooltipPlugin() {
      return {
        id: 'fleetTimelineAxisTooltip',
        afterEvent: (chart, args) => {
          this.handleTimelineAxisTooltipEvent(chart, args);
        },
      };
    },
    timelineChartAreaPlugin() {
      return {
        id: 'fleetTimelineChartArea',
        afterLayout: chart => {
          const area = chart.chartArea;
          if (!area) {
            return;
          }

          const nextArea = {
            top: Math.round(area.top),
            right: Math.round(area.right),
            bottom: Math.round(area.bottom),
            left: Math.round(area.left),
          };
          const currentArea = this.timelineChartArea || {};
          if (
            currentArea.top === nextArea.top &&
            currentArea.right === nextArea.right &&
            currentArea.bottom === nextArea.bottom &&
            currentArea.left === nextArea.left
          ) {
            return;
          }

          const update = () => {
            this.timelineChartArea = nextArea;
          };
          if (typeof window !== 'undefined' && window.requestAnimationFrame) {
            window.requestAnimationFrame(update);
          } else {
            update();
          }
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
      const requestId = this.loadRequestId + 1;
      this.loadRequestId = requestId;
      this.loading = true;
      this.loadError = '';

      try {
        if (!this.categoryStore.classes || this.categoryStore.classes.length === 0) {
          this.categoryStore.load();
        }

        const buckets = await this.loadSummaryBuckets();

        if (requestId !== this.loadRequestId || requestKey !== this.reloadKey) {
          return;
        }

        this.activeWindowEvents = this.buildActiveWindowEvents(buckets);
      } catch (error) {
        console.error('Unable to load fleet activity summary:', error);
        this.loadError = this.$tr('Unable to load activity summary');
        this.activeWindowEvents = [];
      } finally {
        if (requestId === this.loadRequestId) {
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
      const activeContext = this.buildActiveIntervalsBySession(buckets, browserEvents);
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
          const activeIntervals = activeContext.intervalsBySession.get(key);
          let segments = [{ ...interval, afk: false }];
          if (this.showAfkTime) {
            segments = this.splitIntervalByActiveState(
              interval,
              activeIntervals,
              activeContext.sessionsWithAfkData.has(key)
            );
          } else {
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
              $afk: Boolean(segment.afk),
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
    splitIntervalByActiveState(interval, activeIntervals = [], hasAfkData = false) {
      if (!hasAfkData) {
        return [{ ...interval, afk: false }];
      }
      if (!activeIntervals || activeIntervals.length === 0) {
        return [{ ...interval, afk: true }];
      }

      const boundaries = new Set([interval.start.valueOf(), interval.end.valueOf()]);
      for (const activeInterval of activeIntervals) {
        const start = moment.max(interval.start, activeInterval.start);
        const end = moment.min(interval.end, activeInterval.end);
        if (end.isAfter(start)) {
          boundaries.add(start.valueOf());
          boundaries.add(end.valueOf());
        }
      }

      const points = Array.from(boundaries).sort((left, right) => Number(left) - Number(right));
      const segments = [];

      for (let index = 0; index < points.length - 1; index += 1) {
        const start = moment(Number(points[index]));
        const end = moment(Number(points[index + 1]));
        if (!end.isAfter(start)) {
          continue;
        }

        const active = activeIntervals.some(activeInterval => {
          return this.overlapSeconds(start, end, activeInterval.start, activeInterval.end) > 0;
        });
        const previous = segments[segments.length - 1];
        if (previous && previous.afk === !active && previous.end.isSame(start)) {
          previous.end = end;
          continue;
        }
        segments.push({ start, end, afk: !active });
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
          afkDuration: 0,
        };
        const duration = Number(event.duration || 0);
        item.duration += duration;
        if (event.data?.$afk) {
          item.afkDuration += duration;
        }
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
          if (item.afkDuration > 0) {
            item.data.$afkDuration = item.afkDuration;
          }
          delete item.colorSegmentsByCategory;
          delete item.afkDuration;
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
    serializeTimelineDetail(detail, includeCategories = false) {
      if (!detail || detail.duration <= 0) {
        return null;
      }

      const toSortedList = values =>
        _.orderBy(
          Array.from(values.entries()).map(([label, duration]) => ({
            label,
            duration: Math.round(Number(duration || 0)),
          })),
          ['duration'],
          ['desc']
        ).filter(item => item.duration > 0);

      return {
        duration: Math.round(Number(detail.duration || 0)),
        afkDuration: Math.round(Number(detail.afkDuration || 0)),
        apps: toSortedList(detail.apps),
        titles: toSortedList(detail.titles),
        categories: includeCategories ? toSortedList(detail.categories) : [],
      };
    },
    formatTimelineTooltipDetail(detail, datasetLabel = '') {
      if (!detail || detail.duration <= 0) {
        return [];
      }

      const lines = [];
      if (datasetLabel === 'Other') {
        this.addTimelineTooltipSection(lines, this.$tr('Top Categories'), detail.categories, 4);
      }
      this.addTimelineTooltipSection(lines, this.$tr('Top Applications'), detail.apps, 4);
      this.addTimelineTooltipSection(lines, this.$tr('Top Window Titles'), detail.titles, 4, 72);

      return lines;
    },
    addTimelineTooltipSection(lines, title, entries, limit = 4, maxLabelLength = 48) {
      const visibleEntries = (entries || []).slice(0, limit);
      if (visibleEntries.length === 0) {
        return;
      }

      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(title);
      visibleEntries.forEach(entry => {
        lines.push(
          `${this.truncateTimelineTooltipLabel(entry.label, maxLabelLength)}: ${seconds_to_duration(
            entry.duration
          )}`
        );
      });
    },
    truncateTimelineTooltipLabel(label, maxLength = 48) {
      const text = String(label || UNKNOWN);
      if (text.length <= maxLength) {
        return text;
      }
      return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
    },
    categoryName(event) {
      return (event.data.$category || ['Uncategorized']).join(' > ');
    },
    formatTimelineAxisTick(value) {
      const hours = Number(value || 0);
      return hours >= 1 ? `${hours}h` : `${Math.round(hours * 60)}m`;
    },
    handleTimelineAxisTooltipEvent(chart, args) {
      const event = args?.event;
      const chartArea = chart?.chartArea;
      const xScale = chart?.scales?.x;
      if (!event || !chartArea || !xScale || !chart?.tooltip) {
        return;
      }

      if (event.type === 'mouseout') {
        this.clearTimelineAxisTooltip(chart, args, event);
        return;
      }

      const x = Number(event.x);
      const y = Number(event.y);
      const insidePlot =
        x >= chartArea.left && x <= chartArea.right && y >= chartArea.top && y < chartArea.bottom;
      if (insidePlot) {
        delete chart.$fleetAxisHoverIndex;
        chart.canvas.style.cursor = '';
        return;
      }

      const insideAxisLabels =
        x >= chartArea.left && x <= chartArea.right && y >= chartArea.bottom && y <= chart.height;
      if (!insideAxisLabels) {
        this.clearTimelineAxisTooltip(chart, args, event);
        return;
      }

      const index = this.timelineIndexFromPixel(chart, x);
      const activeElements = this.timelineActiveElementsForIndex(chart, index);
      if (activeElements.length === 0) {
        this.clearTimelineAxisTooltip(chart, args, event);
        return;
      }

      if (chart.$fleetAxisHoverIndex === index) {
        chart.canvas.style.cursor = 'help';
        return;
      }

      chart.$fleetAxisHoverIndex = index;
      chart.canvas.style.cursor = 'help';
      const tooltipX = xScale.getPixelForValue(index);
      const tooltipY = Math.min(chart.height, chartArea.bottom + 8);
      chart.tooltip.setActiveElements(activeElements, { x: tooltipX, y: tooltipY });
      chart.setActiveElements(activeElements);
      args.changed = true;
    },
    timelineIndexFromPixel(chart, x) {
      const labels = chart?.data?.labels || [];
      const xScale = chart?.scales?.x;
      if (!xScale || labels.length === 0) {
        return -1;
      }

      let index = Number(xScale.getValueForPixel(x));
      if (!Number.isFinite(index)) {
        index = _.minBy(_.range(labels.length), candidateIndex =>
          Math.abs(Number(xScale.getPixelForValue(candidateIndex)) - x)
        );
      }
      index = Math.round(index);

      if (index < 0 || index >= labels.length) {
        return -1;
      }

      const center = Number(xScale.getPixelForValue(index));
      const prev = index > 0 ? Number(xScale.getPixelForValue(index - 1)) : center;
      const next = index < labels.length - 1 ? Number(xScale.getPixelForValue(index + 1)) : center;
      const neighborDistance = Math.max(Math.abs(center - prev), Math.abs(next - center), 16);
      const maxDistance = Math.max(12, neighborDistance / 2);
      return Math.abs(x - center) <= maxDistance ? index : -1;
    },
    timelineActiveElementsForIndex(chart, index) {
      if (index < 0) {
        return [];
      }

      return (chart?.data?.datasets || [])
        .map((dataset, datasetIndex) => {
          const values = Array.isArray(dataset.data) ? dataset.data : [];
          const value = Number(values[index] || 0);
          return { datasetIndex, index, value };
        })
        .filter(item => {
          return (
            item.value > 0 && (!chart.isDatasetVisible || chart.isDatasetVisible(item.datasetIndex))
          );
        })
        .map(item => ({
          datasetIndex: item.datasetIndex,
          index: item.index,
        }));
    },
    clearTimelineAxisTooltip(chart, args, event) {
      const hadAxisHover = chart?.$fleetAxisHoverIndex !== undefined;
      delete chart.$fleetAxisHoverIndex;
      if (chart?.canvas) {
        chart.canvas.style.cursor = '';
      }
      if (!hadAxisHover || !chart?.tooltip) {
        return;
      }

      chart.tooltip.setActiveElements([], {
        x: Number(event?.x || 0),
        y: Number(event?.y || 0),
      });
      chart.setActiveElements([]);
      args.changed = true;
    },
    overlapSeconds(start, end, otherStart, otherEnd) {
      const overlapStart = moment.max(start, otherStart);
      const overlapEnd = moment.min(end, otherEnd);
      if (!overlapEnd.isAfter(overlapStart)) {
        return 0;
      }
      return overlapEnd.diff(overlapStart, 'seconds', true);
    },
    binCapacityHours(bin) {
      return Math.max(1 / 60, moment(bin.end).diff(moment(bin.start), 'hours', true));
    },
    drawAfkTimelineOverlay(ctx, left, overlayTop, right, bottom, color) {
      const width = right - left;
      const height = bottom - overlayTop;
      if (width <= 0 || height <= 0) {
        return;
      }

      const spacing = 9;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, overlayTop, width, height);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        left + 0.75,
        overlayTop + 0.75,
        Math.max(0, width - 1.5),
        Math.max(0, height - 1.5)
      );

      for (let x = left - height; x < right + height; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, bottom);
        ctx.lineTo(x + height, overlayTop);
        ctx.stroke();
      }
      ctx.restore();
    },
    formatBinLabel(start, end, unit) {
      const displayEnd = moment(end).clone().subtract(1, 'millisecond');
      if (unit === 'hour') {
        return start.format('HH:mm');
      }
      if (unit === 'day') {
        return start.format('MMM D');
      }

      const endFormat = start.isSame(displayEnd, 'year') ? 'MMM D' : 'MMM D, YYYY';
      return `${start.format('MMM D, YYYY')} - ${displayEnd.format(endFormat)}`;
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

.fleet-timeline-chart {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.fleet-y-axis {
  position: relative;
  flex: 0 0 3.4rem;
  height: 28rem;
  padding-right: 0.45rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.fleet-y-axis-unit {
  position: absolute;
  top: 0;
  left: 0;
  line-height: 1;
  opacity: 0.75;
}

.fleet-y-axis-tick {
  position: absolute;
  right: 0.45rem;
  line-height: 1;
  opacity: 0.8;
  transform: translateY(-50%);
  white-space: nowrap;
}

.fleet-chart-scroll {
  flex: 1 1 auto;
  min-width: 0;
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
