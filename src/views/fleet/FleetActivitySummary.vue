<template lang="pug">
div.fleet-activity-summary.mb-3(:class="{ 'fleet-activity-summary--dark': activeTheme === 'dark' }")
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
        b-form-checkbox(
          v-model="subtractAfkTime"
          size="sm"
          @change="queueFleetActivitySummaryFilterStateSave"
        )
          | {{ $tr('Subtract AFK time') }}
        div.d-flex.flex-wrap.align-items-center.mt-1
          b-form-checkbox(
            v-model="ignoreShortAfkPeriods"
            :disabled="!subtractAfkTime"
            size="sm"
            @change="queueFleetActivitySummaryFilterStateSave"
          )
            | {{ $tr('Ignore short AFK periods up to') }}
          b-input-group.fleet-short-afk-input.ml-sm-2.mt-1.mt-sm-0(size="sm")
            b-form-input(
              v-model.number="shortAfkThresholdValue"
              type="number"
              min="1"
              step="1"
              :disabled="!subtractAfkTime || !ignoreShortAfkPeriods"
              :aria-label="$tr('Short AFK threshold')"
              @input="queueFleetActivitySummaryFilterStateSave"
              @change="queueFleetActivitySummaryFilterStateSave"
            )
            b-form-select(
              v-model="shortAfkThresholdUnit"
              :options="shortAfkThresholdUnitOptions"
              :disabled="!subtractAfkTime || !ignoreShortAfkPeriods"
              :aria-label="$tr('Short AFK unit')"
              @change="queueFleetActivitySummaryFilterStateSave"
            )
          span.fleet-short-afk-max.small.text-muted.ml-sm-2.mt-1.mt-sm-0(
            v-if="maxActiveSessionAfkPeriodLabel"
          )
            | {{ $tr('Max active-session AFK') }}: {{ maxActiveSessionAfkPeriodLabel }}
        b-form-checkbox(
          v-model="countAudibleBrowserTime"
          :disabled="!subtractAfkTime"
          size="sm"
          @change="queueFleetActivitySummaryFilterStateSave"
        )
          | {{ $tr('Count audible browser tab as active') }}
        b-form-checkbox(
          v-model="treatAfkDataGapsAsActive"
          :disabled="!subtractAfkTime"
          size="sm"
          @change="queueFleetActivitySummaryFilterStateSave"
        )
          | {{ $tr('Count AFK watcher gaps as active only inside active sessions') }}
        div.fleet-ignored-category-filter.mt-3
          div.d-flex.flex-wrap.align-items-center.justify-content-between.mb-1
            label.small.text-muted.mb-0 {{ $tr('Ignored categories') }}
            b-button(
              v-if="ignoredCategoryKeys.length > 0"
              size="sm"
              variant="outline-secondary"
              @click="clearIgnoredCategories"
            )
              | {{ $tr('Clear ignored categories') }}
          div.fleet-ignored-category-list(v-if="ignoredCategoryOptions.length > 0")
            b-form-checkbox(
              v-for="option in ignoredCategoryOptions"
              :key="option.value"
              v-model="ignoredCategoryKeys"
              :value="option.value"
              size="sm"
              @change="queueFleetActivitySummaryFilterStateSave"
            )
              | {{ option.text }}
          div.small.text-muted(v-else)
            | {{ $tr('No categories available in current range') }}
          div.small.text-muted.mt-1
            | {{ $tr('Ignored categories are removed from activity summaries and charts.') }}
    div.fleet-filter-meta.small.text-muted.mt-2(v-if="activeWindowEvents.length > 0")
      | {{ $tr('Events counted: {count}', { count: countedWindowEventCount }) }}

  b-alert(v-if="loadError" show variant="danger")
    | {{ loadError }}

  div.aw-loading(v-if="loading")
    | {{ $tr('Loading...') }}

  b-alert(v-else-if="activeWindowEvents.length === 0" show variant="info")
    | {{ $tr('No activity summary data found for the selected range.') }}

  b-alert(v-else-if="summaryWindowEvents.length === 0" show variant="info")
    | {{ $tr('No activity summary data matches the current filters.') }}

  div.row(v-else)
    div.col-12.mb-3
      div.fleet-session-summary-strip
        div.fleet-session-summary-metrics
          div.fleet-session-summary-metric
            div.text-muted.small {{ $tr('Active session time') }}
            div.fleet-session-summary-value {{ activeSessionDurationLabel }}
          div.fleet-session-summary-metric(v-if="showNotAfkActiveSummary")
            div.text-muted.small {{ $tr('Active after AFK subtraction') }}
            div.fleet-session-summary-value.fleet-session-summary-value--secondary {{ notAfkActiveSessionDurationLabel }}
        div.fleet-session-summary-help.text-muted.small
          | {{ activeSessionSummaryHelp }}

    div.col-12.mb-3
      div.fleet-summary-panel.fleet-summary-panel--timeline
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Timeline (barchart)') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('timeline')"
            :disabled="loading || isPanelRefreshing('timeline')"
          )
            icon(name="sync")
            span.d-none.d-md-inline.ml-1 {{ $tr('Refresh') }}
        div.fleet-timeline-chart(v-if="timelineDatasets.length > 0")
          div.fleet-y-axis(:style="{ color: chartTextColor }")
            div.fleet-y-axis-unit {{ $tr('Hours') }}
            div(
              v-for="tick in timelineYAxisTicks"
              :key="tick.value"
              class="fleet-y-axis-tick"
              :style="{ top: tick.top }"
            ) {{ tick.label }}
          div.fleet-chart-scroll(ref="timelineChartScroll" @scroll="handleTimelineChartScroll")
            div.fleet-chart(:style="{ minWidth: timelineChartMinWidth }")
              bar(
                :key="'timeline-chart-' + panelRefreshKeys.timeline"
                :chart-data="timelineChartData"
                :chart-options="timelineChartOptions"
                :plugins="timelineChartPlugins"
                :height="440"
              )
        div.fleet-summary-empty(v-else) {{ $tr('No data') }}

    div.col-12.mb-3(v-if="showDetailedWatcherTimeline")
      div.fleet-summary-panel.fleet-summary-panel--daily-watchers
        div.d-flex.flex-wrap.align-items-center.justify-content-between.mb-2
          div
            h6.mb-1 {{ $tr('Watcher timeline') }}
            div.small.text-muted
              | {{ $tr('Events shown: {count}', { count: dailyTimelineEventCount }) }}
          div.fleet-daily-timeline-tools
            b-button(
              size="sm"
              variant="outline-secondary"
              :title="$tr('Refresh this panel')"
              @click="refreshPanel('dailyTimeline')"
              :disabled="loading || isPanelRefreshing('dailyTimeline')"
            )
              icon(name="sync")
              span.d-none.d-md-inline.ml-1 {{ $tr('Refresh') }}
            div.fleet-daily-swimlane
              span.small.text-muted.mr-2 {{ $tr('Swimlanes') }}:
              b-form-select(
                v-model="dailyTimelineSwimlane"
                size="sm"
                :options="dailyTimelineSwimlaneOptions"
              )
            b-button(size="sm" variant="outline-secondary" @click="selectAllDailyWatchers" :disabled="dailyWatcherOptions.length === 0")
              | {{ $tr('All') }}
            b-button(size="sm" variant="outline-secondary" @click="clearDailyWatchers" :disabled="dailyWatcherOptions.length === 0")
              | {{ $tr('None') }}
        div.small.text-muted.mb-2(v-if="dailyWatcherOptions.length === 0")
          | {{ $tr('No watchers available for the current selection.') }}
        div.fleet-daily-watcher-controls.mb-3(v-else)
          b-form-checkbox(
            v-for="watcher in dailyWatcherOptions"
            :key="watcher.value"
            v-model="selectedDailyWatcherKeys"
            :value="watcher.value"
          )
            | {{ watcher.text }}
        fleet-system-metrics-wave.mb-3(
          v-if="selectedSystemMetricDeviceIds.length > 0"
          :key="'system-metrics-' + selectedSystemMetricDeviceIds.join('|') + '-' + panelRefreshKeys.dailyTimeline"
          :device-ids="selectedSystemMetricDeviceIds"
          :start="rangeStartIso"
          :end="rangeEndIso"
          :max-points="540"
          :default-visible="true"
          :show-toggle="false"
          compact
        )
        vis-timeline(
          v-if="selectedDailyTimelineBuckets.length > 0"
          :key="dailyTimelineKey"
          :buckets="selectedDailyTimelineBuckets"
          :showRowLabels="false"
          :queriedInterval="dailyTimelineInterval"
          :windowInterval="dailyTimelineInterval"
          :swimlane="dailyTimelineSwimlane"
          :updateTimelineWindow="true"
        )
        div.fleet-summary-empty(v-else) {{ $tr('No data') }}

    div.col-12.mb-3
      div.fleet-summary-panel.fleet-summary-panel--category-tree
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Category Tree') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('categoryTree')"
            :disabled="loading || isPanelRefreshing('categoryTree')"
          )
            icon(name="sync")
            span.d-none.d-md-inline.ml-1 {{ $tr('Refresh') }}
        aw-categorytree(
          :key="'category-tree-' + panelRefreshKeys.categoryTree"
          :events="categorizedWindowEvents"
          show_colors
          horizontal
          show_apps
          categorize_uncategorized_apps
          @categorize-app="openFleetCategoryRuleModal"
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Top Applications') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('topApps')"
            :disabled="loading || isPanelRefreshing('topApps')"
          )
            icon(name="sync")
        aw-summary(
          :key="'top-apps-' + panelRefreshKeys.topApps"
          :fields="topAppEvents"
          :namefunc="event => event.data.app"
          :colorfunc="event => event.data.app"
          with_limit
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Top Window Titles') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('topTitles')"
            :disabled="loading || isPanelRefreshing('topTitles')"
          )
            icon(name="sync")
        aw-summary(
          :key="'top-titles-' + panelRefreshKeys.topTitles"
          :fields="topTitleEvents"
          :namefunc="event => event.data.title"
          :hoverfunc="event => event.data.app"
          :colorfunc="event => event.data.app"
          with_limit
        )

    div.col-md-6.col-xl-4.mb-3
      div.fleet-summary-panel
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Top Categories') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('topCategories')"
            :disabled="loading || isPanelRefreshing('topCategories')"
          )
            icon(name="sync")
        aw-summary(
          :key="'top-categories-' + panelRefreshKeys.topCategories"
          :fields="topCategoryEvents"
          :namefunc="categoryName"
          :colorfunc="categoryName"
          with_limit
        )

    div.col-md-12.col-xl-4.mb-3
      div.fleet-summary-panel.fleet-summary-panel--sunburst
        div.fleet-panel-header.mb-3
          h6.mb-0 {{ $tr('Category Sunburst') }}
          b-button(
            size="sm"
            variant="outline-secondary"
            :title="$tr('Refresh this panel')"
            @click="refreshPanel('sunburst')"
            :disabled="loading || isPanelRefreshing('sunburst')"
          )
            icon(name="sync")
        aw-sunburst-categories(
          v-if="topCategoriesHierarchy"
          :key="'sunburst-' + panelRefreshKeys.sunburst"
          :data="topCategoriesHierarchy"
          style="height: 20em"
        )
        div.fleet-summary-empty(v-else) {{ $tr('No data') }}

  div.fleet-chart-tooltip(
    v-show="timelineTooltip.visible"
    :class="{ 'fleet-chart-tooltip--dark': activeTheme === 'dark' }"
    :style="timelineTooltipStyle"
    @mouseenter="holdTimelineTooltip"
    @mouseleave="releaseTimelineTooltip"
    @wheel.stop="noop"
  )
    div(
      v-for="(line, index) in timelineTooltip.lines"
      :key="index"
      :class="['fleet-chart-tooltip-line', 'fleet-chart-tooltip-line--' + line.type]"
    )
      span(v-if="line.type !== 'spacer'") {{ line.text }}

  div.fleet-chart-detail-window(
    v-if="timelineDetailWindow.visible"
    :class="{ 'fleet-chart-detail-window--dark': activeTheme === 'dark' }"
    :style="timelineDetailWindowStyle"
  )
    div.fleet-chart-detail-window__titlebar(
      @mousedown="startTimelineDetailWindowDrag"
      @touchstart="startTimelineDetailWindowDrag"
    )
      div
        div.fleet-chart-detail-window__title {{ $tr('Timeline details') }}
        div.fleet-chart-detail-window__subtitle(v-if="timelineDetailWindow.subtitle")
          | {{ timelineDetailWindow.subtitle }}
      button.fleet-chart-detail-window__close(
        type="button"
        :aria-label="$tr('Close')"
        @click="closeTimelineDetailWindow"
      ) X
    div.fleet-chart-detail-window__body
      div(
        v-for="(line, index) in timelineDetailWindow.lines"
        :key="index"
        :class="['fleet-chart-tooltip-line', 'fleet-chart-tooltip-line--' + line.type]"
      )
        span(v-if="line.type !== 'spacer'") {{ line.text }}
    div.fleet-chart-detail-window__resize-handle(
      role="separator"
      aria-orientation="both"
      :aria-label="$tr('Resize window')"
      :title="$tr('Resize window')"
      @mousedown.stop.prevent="startTimelineDetailWindowResize"
      @touchstart.stop.prevent="startTimelineDetailWindowResize"
    )

  b-modal(
    id="fleet-category-rule-modal"
    ref="fleetCategoryRuleModal"
    :title="$tr('Categorize matching events')"
    size="lg"
    hide-footer
  )
    div(v-if="fleetCategoryRuleTarget")
      b-alert(:show="!!fleetCategoryRuleMessage", variant="success")
        | {{ fleetCategoryRuleMessage }}
      b-alert(:show="!!fleetCategoryRuleDisplayError", variant="danger")
        | {{ fleetCategoryRuleDisplayError }}
      b-alert(:show="!!fleetCategoryRuleWarning", variant="warning")
        | {{ fleetCategoryRuleWarning }}

      div.mb-3
        div.small.text-muted {{ $tr('Clicked uncategorized app') }}
        div.fleet-category-rule-target
          strong {{ fleetCategoryRuleTarget.app }}
          span.ml-2.text-muted {{ formatFleetCategoryRuleDuration(fleetCategoryRuleTarget.duration || 0) }}

      div.row
        div.col-md-6
          b-form-group(:label="$tr('Match from')")
            b-form-select(
              v-model="fleetCategoryRuleField"
              :options="fleetCategoryRuleFieldOptions"
              size="sm"
            )
        div.col-md-6
          b-form-group(:label="$tr('Target')")
            b-form-radio-group(
              v-model="fleetCategoryRuleMode"
              :options="fleetCategoryRuleModeOptions"
              size="sm"
              buttons
              button-variant="outline-secondary"
            )

      div.mb-2(v-if="fleetCategoryRuleFieldValue")
        small.text-muted {{ $tr('Field value') }}
        code.fleet-category-rule-value {{ fleetCategoryRuleFieldValue }}

      b-form-group(:label="$tr('Generated regex')")
        b-form-input(
          v-model.trim="fleetCategoryRulePattern"
          :state="fleetCategoryRulePatternState"
          size="sm"
        )
        b-form-invalid-feedback
          | {{ $tr('Invalid pattern') }}
        b-form-text.text-warning(v-if="fleetCategoryRuleBroadPattern")
          | {{ $tr('Pattern too broad') }}

      div.row
        div.col-md-7(v-if="fleetCategoryRuleMode === 'append'")
          b-form-group(:label="$tr('Existing category')")
            b-form-select(
              v-model="fleetCategoryRuleCategory"
              :options="fleetAppendCategoryOptions"
              size="sm"
            )
        div.col-md-7(v-else)
          b-form-group(:label="$tr('New category path')")
            b-form-input(
              v-model.trim="fleetCategoryRuleNewPath"
              :placeholder="$tr('Work > Project')"
              size="sm"
            )
        div.col-md-5.d-flex.align-items-end
          b-form-checkbox.mb-3(v-model="fleetCategoryRuleIgnoreCase")
            | {{ $tr('Case insensitive') }}

      div.d-flex.justify-content-end
        b-button.mr-2(size="sm" variant="outline-secondary" @click="closeFleetCategoryRuleModal")
          | {{ $tr('Cancel') }}
        b-button(
          size="sm"
          variant="primary"
          :disabled="!fleetCategoryRuleCanSave || fleetCategoryRuleSaving"
          @click="saveFleetCategoryRule"
        )
          | {{ fleetCategoryRuleSaving ? $tr('Saving...') : $tr('Save category rule') }}
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
import { getColorFromString } from '~/util/color';
import { getBucketIdentity } from '~/util/bucketIdentity';
import { seconds_to_duration } from '~/util/time';
import { detectPreferredTheme } from '~/util/theme';
import { isRegexBroad, validateRegex } from '~/util/validate';

const CATEGORY_KEY_SEPARATOR = '>>>';
const SYSTEM_METRIC_WATCHER_KEY_PREFIX = '__systemmetrics__::';
const TIMELINE_TOOLTIP_HOVER_DELAY_MS = 3000;
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
const DEFAULT_FLEET_ACTIVITY_SUMMARY_FILTER_STATE = {
  subtractAfkTime: true,
  countAudibleBrowserTime: true,
  ignoreShortAfkPeriods: false,
  shortAfkThresholdValue: null,
  shortAfkThresholdUnit: 'seconds',
  treatAfkDataGapsAsActive: false,
  ignoredCategoryKeys: [],
};

function normalizeFleetActivitySummaryFilterState(value: Record<string, any> = {}) {
  const state: Record<string, any> = {
    ...DEFAULT_FLEET_ACTIVITY_SUMMARY_FILTER_STATE,
  };

  if (typeof value !== 'object' || value === null) {
    return state;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'subtractAfkTime')) {
    state.subtractAfkTime = Boolean(value.subtractAfkTime);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'countAudibleBrowserTime')) {
    state.countAudibleBrowserTime = Boolean(value.countAudibleBrowserTime);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'ignoreShortAfkPeriods')) {
    state.ignoreShortAfkPeriods = Boolean(value.ignoreShortAfkPeriods);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'treatAfkDataGapsAsActive')) {
    state.treatAfkDataGapsAsActive = Boolean(value.treatAfkDataGapsAsActive);
  }
  if (Array.isArray(value.ignoredCategoryKeys)) {
    state.ignoredCategoryKeys = _.uniq(
      value.ignoredCategoryKeys
        .map(category => String(category || '').trim())
        .filter(category => category !== '')
    );
  }
  if (value.shortAfkThresholdUnit === 'minutes' || value.shortAfkThresholdUnit === 'seconds') {
    state.shortAfkThresholdUnit = value.shortAfkThresholdUnit;
  }

  const thresholdValue = Number(value.shortAfkThresholdValue);
  if (Number.isFinite(thresholdValue) && thresholdValue > 0) {
    state.shortAfkThresholdValue = thresholdValue;
  }

  return state;
}

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
  components: {
    Bar,
    'fleet-system-metrics-wave': () => import('~/components/FleetSystemMetricsWave.vue'),
  },
  props: {
    user: { type: Object, required: true },
  },
  data() {
    const settingsStore = useSettingsStore();
    const filterState = normalizeFleetActivitySummaryFilterState(
      settingsStore.fleetActivitySummaryFilterStateData
    );
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      settingsStore,
      loading: false,
      loadError: '',
      showFilters: false,
      showAfkTime: !filterState.subtractAfkTime,
      countAudibleBrowserTime: filterState.countAudibleBrowserTime,
      ignoreShortAfkPeriods: filterState.ignoreShortAfkPeriods,
      shortAfkThresholdValue: filterState.shortAfkThresholdValue,
      shortAfkThresholdUnit: filterState.shortAfkThresholdUnit,
      shortAfkThresholdUsesAutoDefault: filterState.shortAfkThresholdValue === null,
      treatAfkDataGapsAsActive: filterState.treatAfkDataGapsAsActive,
      ignoredCategoryKeys: [...filterState.ignoredCategoryKeys],
      textFilter: '',
      activeWindowEvents: [],
      rawTimelineBuckets: [],
      selectedDailyWatcherKeys: [],
      dailyTimelineSwimlane: null,
      timelineChartArea: null,
      timelineTooltip: {
        visible: false,
        x: 12,
        y: 12,
        lines: [],
        signature: '',
      },
      timelineDetailWindow: {
        visible: false,
        x: 96,
        y: 96,
        width: 0,
        height: 0,
        subtitle: '',
        lines: [],
      },
      timelineDetailDrag: {
        active: false,
        offsetX: 0,
        offsetY: 0,
        width: 0,
        height: 0,
      },
      timelineDetailResize: {
        active: false,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
      },
      timelineTooltipHovered: false,
      timelineTooltipHideTimer: null,
      timelineTooltipShowTimer: null,
      timelineTooltipPending: null,
      fleetFilterStateSaveTimer: null,
      timelineAutoScrollTimer: null,
      timelineAutoScrollPending: false,
      timelineAutoScrollAttempts: 0,
      timelineProgrammaticScroll: false,
      loadRequestId: 0,
      panelRefreshKeys: {
        timeline: 0,
        dailyTimeline: 0,
        categoryTree: 0,
        topApps: 0,
        topTitles: 0,
        topCategories: 0,
        sunburst: 0,
      },
      panelRefreshing: {
        timeline: false,
        dailyTimeline: false,
        categoryTree: false,
        topApps: false,
        topTitles: false,
        topCategories: false,
        sunburst: false,
      },
      fleetCategoryRuleTarget: null,
      fleetCategoryRuleMode: 'append',
      fleetCategoryRuleField: 'app',
      fleetCategoryRulePattern: '',
      fleetCategoryRuleCategory: null,
      fleetCategoryRuleNewPath: '',
      fleetCategoryRuleIgnoreCase: true,
      fleetCategoryRuleSaving: false,
      fleetCategoryRuleMessage: '',
      fleetCategoryRuleError: '',
    };
  },
  computed: {
    rangeStart() {
      return moment(this.user?.range?.start);
    },
    rangeEnd() {
      return moment(this.user?.range?.end);
    },
    rangeStartIso() {
      return this.rangeStart.isValid() ? this.rangeStart.format() : '';
    },
    rangeEndIso() {
      return this.rangeEnd.isValid() ? this.rangeEnd.format() : '';
    },
    rangeLabel() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return '';
      }

      const end = this.rangeEnd.clone().subtract(1, 'millisecond');
      return `${this.rangeStart.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`;
    },
    isSingleDayRange() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return false;
      }
      return this.rangeEnd.diff(this.rangeStart, 'hours', true) <= 24.5;
    },
    showDetailedWatcherTimeline() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return false;
      }
      return this.rangeEnd.diff(this.rangeStart, 'hours', true) <= 72.5;
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
    fleetCategoryRuleModeOptions() {
      return [
        { value: 'append', text: this.$tr('Existing category') },
        { value: 'create', text: this.$tr('New category') },
      ];
    },
    fleetCategoryRuleFieldOptions() {
      const target = this.fleetCategoryRuleTarget || {};
      const candidates = [
        { key: 'app', value: target.app },
        { key: 'process_name', value: target.process_name },
      ].filter(item => String(item.value || '').trim() !== '');

      return _.uniqBy(candidates, item => `${item.key}:${item.value}`).map(item => ({
        value: item.key,
        text: `${item.key}: ${this.truncateTimelineTooltipLabel(item.value, 72)}`,
      }));
    },
    fleetCategoryRuleFieldValue() {
      const target = this.fleetCategoryRuleTarget || {};
      return String(target[this.fleetCategoryRuleField] || target.app || '').trim();
    },
    fleetCategoryRulePatternState() {
      if (!this.fleetCategoryRulePattern) {
        return null;
      }
      return validateRegex(this.fleetCategoryRulePattern);
    },
    fleetCategoryRuleBroadPattern() {
      return this.fleetCategoryRulePatternState && isRegexBroad(this.fleetCategoryRulePattern);
    },
    fleetCategoryRuleNewParts() {
      return String(this.fleetCategoryRuleNewPath || '')
        .split('>')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    },
    fleetCategoryRuleNewExists() {
      if (this.fleetCategoryRuleMode !== 'create' || this.fleetCategoryRuleNewParts.length === 0) {
        return false;
      }
      return this.categoryStore.classes.some(category =>
        _.isEqual(category.name, this.fleetCategoryRuleNewParts)
      );
    },
    fleetAppendCategoryOptions() {
      return [
        { value: null, text: this.$tr('Choose category'), disabled: true },
        ...this.categoryStore.category_select(false).filter(option => {
          return option.value && !_.isEqual(option.value, ['Uncategorized']);
        }),
      ];
    },
    selectedFleetCategoryRuleCategory() {
      if (!this.fleetCategoryRuleCategory) {
        return null;
      }
      return this.categoryStore.classes.find(category =>
        _.isEqual(category.name, this.fleetCategoryRuleCategory)
      );
    },
    fleetCategoryRuleAppendCompatibilityError() {
      const category = this.selectedFleetCategoryRuleCategory;
      if (!category || category.rule?.type !== 'regex') {
        return '';
      }
      const selectKeys = category.rule.select_keys || [];
      if (selectKeys.length > 0 && !selectKeys.includes(this.fleetCategoryRuleField)) {
        return this.$tr(
          'Selected category only matches other fields. Choose a compatible field or create a new category.'
        );
      }
      return '';
    },
    fleetCategoryRuleDisplayError() {
      return this.fleetCategoryRuleError || this.fleetCategoryRuleAppendCompatibilityError;
    },
    fleetCategoryRuleWarning() {
      const category = this.selectedFleetCategoryRuleCategory;
      if (this.fleetCategoryRuleAppendCompatibilityError) {
        return '';
      }
      if (
        this.fleetCategoryRuleMode === 'append' &&
        category?.rule?.type === 'regex' &&
        !(category.rule.select_keys || []).length
      ) {
        return this.$tr(
          'Existing category has no field scope; the new pattern can match any categorized field.'
        );
      }
      if (this.fleetCategoryRuleNewExists) {
        return this.$tr('Category already exists');
      }
      return '';
    },
    fleetCategoryRuleCanSave() {
      if (!this.fleetCategoryRuleTarget || !validateRegex(this.fleetCategoryRulePattern || '')) {
        return false;
      }
      if (this.fleetCategoryRuleAppendCompatibilityError || this.fleetCategoryRuleNewExists) {
        return false;
      }
      if (this.fleetCategoryRuleMode === 'append') {
        return !!this.selectedFleetCategoryRuleCategory;
      }
      return this.fleetCategoryRuleNewParts.length > 0;
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
        this.shouldIgnoreShortAfkPeriods
          ? `ignore-short-afk-${this.shortAfkThresholdSeconds}`
          : 'count-short-afk',
        this.shouldTreatAfkDataGapsAsActive ? 'afk-gaps-active' : 'afk-gaps-unknown',
      ].join('::');
    },
    ignoredCategoryKeySet() {
      return new Set(
        (this.ignoredCategoryKeys || [])
          .map(category => String(category || '').trim())
          .filter(category => category !== '')
      );
    },
    shortAfkThresholdUnitOptions() {
      return [
        { value: 'seconds', text: this.$tr('seconds') },
        { value: 'minutes', text: this.$tr('minutes') },
      ];
    },
    shortAfkThresholdSeconds() {
      const value = Number(this.shortAfkThresholdValue || 0);
      if (!Number.isFinite(value) || value <= 0) {
        return 0;
      }
      const multiplier = this.shortAfkThresholdUnit === 'minutes' ? 60 : 1;
      return Math.round(value * multiplier);
    },
    shouldIgnoreShortAfkPeriods() {
      return (
        this.subtractAfkTime && this.ignoreShortAfkPeriods && this.shortAfkThresholdSeconds > 0
      );
    },
    ignoredShortAfkIntervalsBySession() {
      return this.buildIgnoredShortAfkIntervalsBySession(this.rawTimelineBuckets);
    },
    maxActiveSessionAfkPeriodSeconds() {
      return this.findMaxActiveSessionAfkPeriodSeconds(this.rawTimelineBuckets);
    },
    maxActiveSessionAfkPeriodLabel() {
      const seconds = Number(this.maxActiveSessionAfkPeriodSeconds || 0);
      return seconds > 0 ? this.formatMinutesSeconds(seconds) : '';
    },
    shouldTreatAfkDataGapsAsActive() {
      return this.subtractAfkTime && this.treatAfkDataGapsAsActive;
    },
    afkDataGapIntervalsBySession() {
      return this.buildAfkDataGapIntervalsBySession(this.rawTimelineBuckets);
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
        (this.shouldIgnoreShortAfkPeriods ? 1 : 0) +
        (this.shouldTreatAfkDataGapsAsActive ? 1 : 0) +
        (this.ignoredCategoryKeySet.size > 0 ? 1 : 0) +
        (this.normalizedTextFilter ? 1 : 0)
      );
    },
    countedWindowEventCount() {
      return this.summaryWindowEvents.length;
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
    classifiedWindowEvents() {
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
    ignoredCategoryOptions() {
      const categoryKeys = new Set();
      for (const event of this.classifiedWindowEvents) {
        categoryKeys.add(categoryKey(event.data.$category || ['Uncategorized']));
      }
      for (const key of this.ignoredCategoryKeySet) {
        categoryKeys.add(key);
      }

      return _.orderBy(
        Array.from(categoryKeys).map(key => ({
          value: key,
          text: this.formatCategoryKeyLabel(key),
        })),
        [option => String(option.text || '').toLowerCase()],
        ['asc']
      );
    },
    categorizedWindowEvents() {
      if (this.ignoredCategoryKeySet.size === 0) {
        return this.classifiedWindowEvents;
      }
      return this.classifiedWindowEvents.filter(
        event => !this.isIgnoredCategory(event.data.$category)
      );
    },
    summaryWindowEvents() {
      if (this.categoryStore.classes && this.categoryStore.classes.length > 0) {
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
      const timelineDeviceLabels = new Set(
        this.categorizedWindowEvents.map(event => this.eventDeviceLabel(event))
      );
      const splitByDevice = timelineDeviceLabels.size > 1;
      const datasetByCategory = {};
      const afkData = Array.from({ length: this.timelineBins.length }, () => 0);

      const createDetail = () => ({
        duration: 0,
        rawDuration: 0,
        afkDuration: 0,
        rawAfkDuration: 0,
        apps: new Map(),
        titles: new Map(),
        categories: new Map(),
        devices: new Map(),
        deviceEntries: new Map(),
        eventEntries: [],
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

      const ensureDataset = (key, category, deviceLabel = '') => {
        if (!datasetByCategory[key]) {
          datasetByCategory[key] = {
            key,
            category,
            deviceLabel,
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
        const eventDevice = this.eventDeviceLabel(event);
        const eventDeviceKey = this.eventDeviceKey(event);
        const eventApp = event.data.app || event.data.process_name || UNKNOWN;
        const eventTitle = event.data.title || '(no title)';
        const key = categoryKey(eventCategory);
        const baseDatasetKey = topCategorySet.has(key) ? key : 'Other';
        const datasetKey = splitByDevice
          ? `${baseDatasetKey}::device::${eventDeviceKey}`
          : baseDatasetKey;
        const dataset = ensureDataset(
          datasetKey,
          baseDatasetKey === 'Other' ? ['Other'] : eventCategory,
          splitByDevice ? eventDevice : ''
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
            detail.rawDuration += seconds;
            if (event.data?.$afk) {
              detail.afkDuration += seconds;
              detail.rawAfkDuration += seconds;
            }
            addDetailValue(detail.apps, eventApp, seconds);
            addDetailValue(detail.titles, eventTitle, seconds);
            addDetailValue(detail.categories, eventCategory.join(' > '), seconds);
            addDetailValue(detail.devices, eventDevice, seconds);
            addDetailValue(
              detail.deviceEntries,
              this.timelineDeviceEntryLabel(eventDevice, eventApp, eventTitle),
              seconds
            );
            detail.eventEntries.push(
              this.timelineEventEntry(eventStart, eventDevice, eventApp, eventTitle, seconds)
            );
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
          const category = dataset.category;
          const isOther = category.length === 1 && category[0] === 'Other';
          const categoryLabel = category.join(' > ');
          const deviceLabel = dataset.deviceLabel || '';
          const label = deviceLabel ? `${categoryLabel} · ${deviceLabel}` : categoryLabel;
          const categoryColor = isOther
            ? '#adb5bd'
            : this.categoryStore.get_category_color(category);
          return {
            label,
            backgroundColor: categoryColor,
            borderColor: deviceLabel ? getColorFromString(deviceLabel) : categoryColor,
            borderWidth: deviceLabel ? 1.5 : 0,
            borderSkipped: false,
            data: dataset.data.map(value => Math.round(value * 1000) / 1000),
            $timelineDetails: dataset.details.map(detail =>
              this.serializeTimelineDetail(detail, isOther)
            ),
            $timelineCategoryLabel: categoryLabel,
            $timelineDeviceLabel: deviceLabel,
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
    activeSessionIntervals() {
      const intervals = [];

      for (const bucket of this.rawTimelineBuckets || []) {
        if (!this.isSessionBucket(bucket)) {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity) || (event.data || {}).state !== 'active') {
            continue;
          }

          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          intervals.push(interval);
        }
      }

      return this.mergeIntervals(intervals);
    },
    timelineActiveSessionSecondsByBin() {
      const totals = Array.from({ length: this.timelineBins.length }, () => 0);
      this.activeSessionIntervals.forEach(interval => {
        this.timelineBins.forEach((bin, index) => {
          totals[index] += this.overlapSeconds(interval.start, interval.end, bin.start, bin.end);
        });
      });
      return totals.map(value => Math.round(value));
    },
    timelineNotAfkActiveSessionSecondsByBin() {
      const totals = Array.from({ length: this.timelineBins.length }, () => 0);
      (this.notAfkActiveSessionIntervals || []).forEach(interval => {
        this.timelineBins.forEach((bin, index) => {
          totals[index] += this.overlapSeconds(interval.start, interval.end, bin.start, bin.end);
        });
      });
      return totals.map(value => Math.round(value));
    },
    timelineBinTotals() {
      const totals = Array.from({ length: this.timelineBins.length }, () => 0);
      (this.timelineDatasets || []).forEach((dataset: any) => {
        const values = Array.isArray(dataset.data) ? dataset.data : [];
        values.forEach((value, index) => {
          totals[index] += Number(value || 0);
        });
      });
      return totals.map(value => Math.round(value * 1000) / 1000);
    },
    timelineBinTotalsSignature() {
      return this.timelineBinTotals.join('|');
    },
    timelineChartPlugins() {
      return [
        this.timelineAfkOverlayPlugin,
        this.timelineBarValueLabelPlugin,
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
    localActiveSessionSeconds() {
      if (!this.rawTimelineBuckets || this.rawTimelineBuckets.length === 0) {
        return null;
      }
      return _.sum(
        this.activeSessionIntervals.map(interval =>
          interval.end.diff(interval.start, 'seconds', true)
        )
      );
    },
    activeSessionSeconds() {
      return this.localActiveSessionSeconds ?? this.user?.totals?.active_seconds ?? 0;
    },
    activeSessionDurationLabel() {
      return seconds_to_duration(Number(this.activeSessionSeconds || 0));
    },
    notAfkActiveSessionIntervals() {
      if (!this.rawTimelineBuckets || this.rawTimelineBuckets.length === 0) {
        return null;
      }

      const browserEvents = this.buildBrowserEvents(this.rawTimelineBuckets);
      const activeContext = this.buildActiveIntervalsBySession(
        this.rawTimelineBuckets,
        browserEvents
      );
      const sessionActiveIntervals = this.buildSessionStateIntervalsBySession(
        this.rawTimelineBuckets,
        'active'
      );
      if (sessionActiveIntervals.size === 0) {
        return [];
      }

      const intervals = [];
      for (const [key, activeIntervals] of sessionActiveIntervals.entries()) {
        if (!activeContext.sessionsWithAfkData.has(key)) {
          intervals.push(...activeIntervals);
          continue;
        }

        const notAfkIntervals = activeContext.intervalsBySession.get(key) || [];
        for (const activeInterval of activeIntervals) {
          intervals.push(...this.intersectWithIntervals(activeInterval, notAfkIntervals));
        }
      }

      return this.mergeIntervals(intervals);
    },
    localNotAfkActiveSessionSeconds() {
      const intervals = this.notAfkActiveSessionIntervals;
      if (intervals === null) {
        return null;
      }
      return _.sum(intervals.map(interval => interval.end.diff(interval.start, 'seconds', true)));
    },
    notAfkActiveSessionSeconds() {
      return (
        this.localNotAfkActiveSessionSeconds ?? this.user?.totals?.not_afk_active_seconds ?? null
      );
    },
    notAfkActiveSessionDurationLabel() {
      return seconds_to_duration(Number(this.notAfkActiveSessionSeconds || 0));
    },
    showNotAfkActiveSummary() {
      return this.subtractAfkTime && this.notAfkActiveSessionSeconds !== null;
    },
    activeSessionSummaryHelp() {
      if (this.subtractAfkTime) {
        return this.$tr(
          'Raw active session time is shown first; after-AFK active time follows when AFK data exists. Overlapping active sessions across selected devices are counted once.'
        );
      }
      return this.$tr(
        'AFK time is not subtracted; overlapping active sessions across selected devices are counted once.'
      );
    },
    dailyTimelineInterval() {
      if (!this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return null;
      }
      return [this.rangeStart.clone(), this.rangeEnd.clone()];
    },
    dailyTimelineSwimlaneOptions() {
      return [
        { value: null, text: this.$tr('None') },
        { value: 'category', text: this.$tr('Categories') },
        { value: 'bucketType', text: this.$tr('Bucket Specific') },
      ];
    },
    dailyWatcherOptions() {
      const timelineOptions = this.dailyTimelineBuckets.map(bucket => {
        const identity = this.bucketIdentity(bucket);
        return {
          value: String(bucket.id),
          text: this.buildDailyTimelineBucketLabel(bucket),
          sortDeviceName: identity.deviceName,
          sortSessionId: identity.sessionId,
          sortWatcherLabel: identity.watcherLabel,
          defaultSelected: true,
        };
      });
      const systemMetricOptions = this.systemMetricDevices.map(device => ({
        value: this.systemMetricWatcherKey(device.deviceId),
        text: `${this.$tr('System load')} | ${device.deviceName || device.deviceId}`,
        sortDeviceName: device.deviceName || device.deviceId,
        sortSessionId: 'zz-system',
        sortWatcherLabel: this.$tr('System load'),
        defaultSelected: false,
      }));

      return _.orderBy(
        [...timelineOptions, ...systemMetricOptions],
        [
          (option: any) => String(option.sortDeviceName || '').toLowerCase(),
          (option: any) => String(option.sortSessionId || '').toLowerCase(),
          (option: any) => String(option.sortWatcherLabel || '').toLowerCase(),
        ],
        ['asc', 'asc', 'asc']
      );
    },
    systemMetricDevices() {
      if (!this.showDetailedWatcherTimeline) {
        return [];
      }

      const devicesById = new Map();
      for (const bucket of this.bucketsStore.buckets || []) {
        if (String(bucket?.type || '') !== 'systemmetrics') {
          continue;
        }

        const identity = this.bucketIdentity(bucket);
        if (
          this.selectedDeviceSet.size > 0 &&
          hasIdentityValue(identity.deviceId) &&
          !this.selectedDeviceSet.has(identity.deviceId)
        ) {
          continue;
        }

        const deviceId = hasIdentityValue(identity.deviceId)
          ? identity.deviceId
          : identity.hostname;
        if (!hasIdentityValue(deviceId)) {
          continue;
        }

        devicesById.set(deviceId, {
          deviceId,
          deviceName: hasIdentityValue(identity.deviceName) ? identity.deviceName : deviceId,
        });
      }

      return _.orderBy(
        Array.from(devicesById.values()),
        [device => String(device.deviceName || device.deviceId).toLowerCase()],
        ['asc']
      );
    },
    selectedSystemMetricDeviceIds() {
      const selectedKeys = new Set(this.selectedDailyWatcherKeys.map(value => String(value)));
      return this.systemMetricDevices
        .filter(device => selectedKeys.has(this.systemMetricWatcherKey(device.deviceId)))
        .map(device => String(device.deviceId));
    },
    dailyWatcherSignature() {
      return this.dailyWatcherOptions.map(option => option.value).join('|');
    },
    dailyTimelineBuckets() {
      if (!this.showDetailedWatcherTimeline || !this.dailyTimelineInterval) {
        return [];
      }

      return _.orderBy(
        (this.rawTimelineBuckets || [])
          .filter(bucket => !this.isHiddenTimelineBucket(bucket))
          .map(bucket => this.buildDailyTimelineBucket(bucket))
          .filter(bucket => bucket && bucket.events.length > 0),
        [
          (bucket: any) => this.bucketIdentity(bucket).deviceName.toLowerCase(),
          (bucket: any) => String(bucket.client || '').toLowerCase(),
          (bucket: any) => String(bucket.id || '').toLowerCase(),
        ],
        ['asc', 'asc', 'asc']
      );
    },
    selectedDailyTimelineBuckets() {
      const selectedKeys = new Set(this.selectedDailyWatcherKeys.map(value => String(value)));
      if (selectedKeys.size === 0) {
        return [];
      }
      return this.dailyTimelineBuckets.filter(bucket => selectedKeys.has(String(bucket.id)));
    },
    dailyTimelineKey() {
      return [
        this.user?.username || '',
        this.user?.range?.start || '',
        this.user?.range?.end || '',
        this.selectedDeviceIds.join('|'),
        this.dailyTimelineSwimlane || 'none',
        this.selectedDailyWatcherKeys.join('|'),
        this.shouldIgnoreShortAfkPeriods
          ? `ignore-short-afk-${this.shortAfkThresholdSeconds}`
          : 'count-short-afk',
        this.shouldTreatAfkDataGapsAsActive ? 'afk-gaps-active' : 'afk-gaps-unknown',
        Array.from(this.ignoredCategoryKeySet).join('|'),
        this.panelRefreshKeys.dailyTimeline,
      ].join('::');
    },
    dailyTimelineEventCount() {
      return _.sumBy(this.selectedDailyTimelineBuckets, (bucket: any) => {
        return (bucket.events || []).length;
      });
    },
    timelineChartMinWidth() {
      if (this.isSingleDayRange) {
        return '100%';
      }

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
    timelineTooltipStyle() {
      return {
        left: `${this.timelineTooltip.x}px`,
        top: `${this.timelineTooltip.y}px`,
      };
    },
    timelineDetailWindowStyle() {
      return {
        left: `${this.timelineDetailWindow.x}px`,
        top: `${this.timelineDetailWindow.y}px`,
        width:
          Number(this.timelineDetailWindow.width || 0) > 0
            ? `${this.timelineDetailWindow.width}px`
            : undefined,
        height:
          Number(this.timelineDetailWindow.height || 0) > 0
            ? `${this.timelineDetailWindow.height}px`
            : undefined,
      };
    },
    timelineChartOptions(): ChartOptions {
      const formatDuration = value => seconds_to_duration(Number(value || 0) * 3600);
      const afkData = this.timelineAfkData;
      const afkLabel = this.$tr('AFK time');
      const collectedDeviceTimeLabel = this.$tr('Collected device time');
      const barTotalSummaryLines = this.timelineBarTotalSummaryLines.bind(this);
      const activeSummaryLines = this.timelineActiveSummaryLines.bind(this);
      const formatTooltipDetail = this.formatTimelineTooltipDetail.bind(this);
      const formatAxisTooltipDetail = this.formatTimelineAxisTooltipDetail.bind(this);
      const plugins: any = {
        tooltip: {
          enabled: false,
          mode: 'point',
          intersect: false,
          external: context => {
            this.updateTimelineExternalTooltip(context);
          },
          callbacks: {
            beforeTitle(items) {
              const index = items?.[0]?.dataIndex;
              return [...barTotalSummaryLines(index), ...activeSummaryLines(index)];
            },
            label(context) {
              const dataset: any = context.dataset;
              const visibleSeconds = Number(context.parsed.y || 0) * 3600;
              const detail = dataset?.$timelineDetails?.[context.dataIndex];
              const rawSeconds = Number(detail?.rawDuration || visibleSeconds);
              const label = `${dataset.label}: ${seconds_to_duration(visibleSeconds)}`;
              if (rawSeconds > visibleSeconds + 1) {
                return `${label} (${collectedDeviceTimeLabel}: ${seconds_to_duration(rawSeconds)})`;
              }
              return label;
            },
            afterLabel(context) {
              const dataset: any = context.dataset;
              return formatTooltipDetail(
                dataset?.$timelineDetails?.[context.dataIndex],
                dataset?.$timelineCategoryLabel || dataset?.label
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
              const lines = [];
              if (afkHours > 0) {
                lines.push(`${afkLabel}: ${formatDuration(afkHours)}`);
              }
              lines.push(...formatAxisTooltipDetail(chart.data.datasets || [], index, totalHours));
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
        fleetTimelineBarValueLabels: {
          values: this.timelineBinTotals,
          labels: this.timelineBinTotals.map(value => this.formatTimelineBarValueLabel(value)),
          color: this.chartTextColor,
          backgroundColor:
            this.activeTheme === 'dark' ? 'rgba(16, 21, 31, 0.92)' : 'rgba(247, 248, 251, 0.94)',
          borderColor:
            this.activeTheme === 'dark' ? 'rgba(233, 235, 240, 0.22)' : 'rgba(22, 30, 48, 0.18)',
        },
      };

      return {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 28,
          },
        },
        onClick: (event, elements, chart) => {
          this.handleTimelineChartClick(chart, event, elements);
        },
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
    timelineBarValueLabelPlugin() {
      return {
        id: 'fleetTimelineBarValueLabels',
        afterDatasetsDraw: (chart, _args, pluginOptions: any) => {
          const values = Array.isArray(pluginOptions?.values) ? pluginOptions.values : [];
          const labels = Array.isArray(pluginOptions?.labels) ? pluginOptions.labels : [];
          const { ctx, chartArea } = chart;
          const yScale = chart.scales?.y;
          if (!ctx || !chartArea || !yScale || values.length === 0) {
            return;
          }

          const barMetas = chart.getSortedVisibleDatasetMetas().filter(meta => meta.type === 'bar');
          if (barMetas.length === 0) {
            return;
          }

          ctx.save();
          ctx.font =
            '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          values.forEach((value, index) => {
            const totalHours = Number(value || 0);
            const label = String(labels[index] || '');
            if (totalHours <= 0 || !label) {
              return;
            }

            const sampleBar = barMetas
              .map(meta => meta.data?.[index])
              .find(element => element && !element.hidden);
            if (!sampleBar || Number(sampleBar.width || 0) < 10) {
              return;
            }

            const x = Number(sampleBar.x);
            const totalY = Number(yScale.getPixelForValue(totalHours));
            if (!Number.isFinite(x) || !Number.isFinite(totalY)) {
              return;
            }

            const paddingX = 4;
            const height = 16;
            const width = Math.ceil(ctx.measureText(label).width + paddingX * 2);
            const safeX = Math.max(
              chartArea.left + width / 2,
              Math.min(x, chartArea.right - width / 2)
            );
            const labelTop = Math.max(2, totalY - height - 6);
            const left = safeX - width / 2;

            this.drawTimelineLabelPill(
              ctx,
              left,
              labelTop,
              width,
              height,
              pluginOptions?.backgroundColor || 'rgba(247, 248, 251, 0.94)',
              pluginOptions?.borderColor || 'rgba(22, 30, 48, 0.18)'
            );
            ctx.fillStyle = pluginOptions?.color || '#18202f';
            ctx.fillText(label, safeX, labelTop + height / 2);
          });

          ctx.restore();
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
    dailyWatcherSignature() {
      this.syncDailyTimelineWatchers();
    },
    timelineBinTotalsSignature() {
      if (this.timelineAutoScrollPending) {
        this.scheduleTimelineAutoScroll();
      }
    },
    maxActiveSessionAfkPeriodSeconds: {
      immediate: true,
      handler() {
        if (this.shortAfkThresholdUsesAutoDefault) {
          this.syncShortAfkThresholdDefaultToMax();
        }
      },
    },
    fleetCategoryRuleField() {
      this.fleetCategoryRulePattern = this.generatedFleetCategoryRulePattern();
      this.fleetCategoryRuleMessage = '';
      this.fleetCategoryRuleError = '';
    },
    fleetCategoryRuleMode() {
      this.fleetCategoryRuleMessage = '';
      this.fleetCategoryRuleError = '';
    },
  },
  beforeDestroy() {
    this.clearTimelineTooltipHideTimer();
    this.clearTimelineTooltipShowTimer();
    this.flushFleetFilterStateSave();
    this.clearTimelineAutoScrollTimer();
    this.stopTimelineDetailWindowDrag();
    this.stopTimelineDetailWindowResize();
  },
  methods: {
    noop() {
      return undefined;
    },
    syncShortAfkThresholdDefaultToMax() {
      const input = this.shortAfkThresholdInputForSeconds(this.maxActiveSessionAfkPeriodSeconds);
      if (this.shortAfkThresholdUnit !== input.unit) {
        this.shortAfkThresholdUnit = input.unit;
      }
      if (this.shortAfkThresholdValue !== input.value) {
        this.shortAfkThresholdValue = input.value;
      }
    },
    shortAfkThresholdInputForSeconds(seconds) {
      const totalSeconds = Math.ceil(Math.max(0, Number(seconds || 0)));
      if (totalSeconds <= 0) {
        return { value: null, unit: 'seconds' };
      }
      if (totalSeconds >= 60 && totalSeconds % 60 === 0) {
        return { value: totalSeconds / 60, unit: 'minutes' };
      }
      return { value: totalSeconds, unit: 'seconds' };
    },
    currentFleetActivitySummaryFilterState() {
      const thresholdValue = Number(this.shortAfkThresholdValue || 0);
      return {
        subtractAfkTime: this.subtractAfkTime,
        countAudibleBrowserTime: this.countAudibleBrowserTime,
        ignoreShortAfkPeriods: this.ignoreShortAfkPeriods,
        shortAfkThresholdValue:
          Number.isFinite(thresholdValue) && thresholdValue > 0 ? thresholdValue : null,
        shortAfkThresholdUnit: this.shortAfkThresholdUnit === 'minutes' ? 'minutes' : 'seconds',
        treatAfkDataGapsAsActive: this.treatAfkDataGapsAsActive,
        ignoredCategoryKeys: Array.from(this.ignoredCategoryKeySet),
      };
    },
    queueFleetActivitySummaryFilterStateSave() {
      this.shortAfkThresholdUsesAutoDefault = false;
      this.clearFleetFilterStateSaveTimer();
      this.fleetFilterStateSaveTimer = window.setTimeout(() => {
        this.fleetFilterStateSaveTimer = null;
        this.saveFleetActivitySummaryFilterState();
      }, 300);
    },
    async saveFleetActivitySummaryFilterState() {
      const nextState = this.currentFleetActivitySummaryFilterState();
      const savedState = normalizeFleetActivitySummaryFilterState(
        this.settingsStore.fleetActivitySummaryFilterStateData
      );
      if (_.isEqual(nextState, savedState)) {
        return;
      }

      try {
        await this.settingsStore.update({
          fleetActivitySummaryFilterStateData: nextState,
        });
      } catch (error) {
        console.error('Unable to save Fleet activity summary filter state', error);
      }
    },
    clearIgnoredCategories() {
      if (this.ignoredCategoryKeys.length === 0) {
        return;
      }
      this.ignoredCategoryKeys = [];
      this.queueFleetActivitySummaryFilterStateSave();
    },
    openFleetCategoryRuleModal(target) {
      if (!target?.is_app_detail || !_.isEqual(target.category || [], ['Uncategorized'])) {
        return;
      }
      if (!this.categoryStore.classes || this.categoryStore.classes.length === 0) {
        this.categoryStore.load();
      }

      const app = String(target.app || target.subname || '').trim();
      const processName = String(target.process_name || app).trim();
      this.fleetCategoryRuleTarget = {
        ...target,
        app,
        process_name: processName,
      };
      this.fleetCategoryRuleMode = 'append';
      this.fleetCategoryRuleField = app ? 'app' : 'process_name';
      this.fleetCategoryRulePattern = this.generatedFleetCategoryRulePattern();
      this.fleetCategoryRuleCategory = null;
      this.fleetCategoryRuleNewPath = this.suggestFleetCategoryPath(app || processName);
      this.fleetCategoryRuleIgnoreCase = true;
      this.fleetCategoryRuleSaving = false;
      this.fleetCategoryRuleMessage = '';
      this.fleetCategoryRuleError = '';

      this.$nextTick(() => {
        this.$refs.fleetCategoryRuleModal?.show?.();
      });
    },
    closeFleetCategoryRuleModal() {
      this.$refs.fleetCategoryRuleModal?.hide?.();
    },
    generatedFleetCategoryRulePattern() {
      const value = this.fleetCategoryRuleFieldValue;
      return value ? _.escapeRegExp(value) : '';
    },
    suggestFleetCategoryPath(value) {
      const text = String(value || '')
        .replace(/\.exe$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (!text) {
        return '';
      }
      return text
        .split(/\s+/)
        .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' ');
    },
    buildFleetCategoryRule() {
      const rule: any = {
        type: 'regex',
        regex: this.fleetCategoryRulePattern,
        ignore_case: this.fleetCategoryRuleIgnoreCase,
      };
      if (this.fleetCategoryRuleField) {
        rule.select_keys = [this.fleetCategoryRuleField];
      }
      return rule;
    },
    async saveFleetCategoryRule() {
      if (!this.fleetCategoryRuleCanSave) {
        return;
      }

      this.fleetCategoryRuleSaving = true;
      this.fleetCategoryRuleMessage = '';
      this.fleetCategoryRuleError = '';

      try {
        if (this.fleetCategoryRuleMode === 'create') {
          this.categoryStore.addClass({
            name: this.fleetCategoryRuleNewParts,
            rule: this.buildFleetCategoryRule(),
          });
        } else {
          const category = this.selectedFleetCategoryRuleCategory;
          if (!category) {
            throw new Error(this.$tr('Choose category'));
          }
          const rule = category.rule || { type: 'none' };
          if (rule.type === 'none' || rule.type === null) {
            category.rule = this.buildFleetCategoryRule();
          } else if (rule.type === 'regex') {
            category.rule.regex = `${rule.regex || ''}|${this.fleetCategoryRulePattern}`;
            if (rule.ignore_case === undefined) {
              category.rule.ignore_case = this.fleetCategoryRuleIgnoreCase;
            }
          }
          this.categoryStore.classes_unsaved_changes = true;
        }

        await this.categoryStore.save();
        this.categoryStore.load();
        this.fleetCategoryRuleMessage = this.$tr('Category rule saved');
        [
          'timeline',
          'dailyTimeline',
          'categoryTree',
          'topApps',
          'topTitles',
          'topCategories',
          'sunburst',
        ].forEach(panelKey => this.bumpPanelRefreshKey(panelKey));
        this.$nextTick(() => {
          this.closeFleetCategoryRuleModal();
        });
      } catch (error) {
        this.fleetCategoryRuleError = error?.message || String(error);
      } finally {
        this.fleetCategoryRuleSaving = false;
      }
    },
    clearFleetFilterStateSaveTimer() {
      if (this.fleetFilterStateSaveTimer) {
        window.clearTimeout(this.fleetFilterStateSaveTimer);
        this.fleetFilterStateSaveTimer = null;
      }
    },
    flushFleetFilterStateSave() {
      if (!this.fleetFilterStateSaveTimer) {
        return;
      }

      this.clearFleetFilterStateSaveTimer();
      this.saveFleetActivitySummaryFilterState();
    },
    requestTimelineAutoScroll() {
      this.timelineAutoScrollPending = true;
      this.timelineAutoScrollAttempts = 0;
      this.scheduleTimelineAutoScroll();
    },
    scheduleTimelineAutoScroll(delay = 0) {
      this.clearTimelineAutoScrollTimer();
      this.timelineAutoScrollTimer = window.setTimeout(() => {
        this.timelineAutoScrollTimer = null;
        this.$nextTick(() => {
          const runAutoScroll = () => this.autoScrollTimelineChart();
          if (typeof window !== 'undefined' && window.requestAnimationFrame) {
            window.requestAnimationFrame(runAutoScroll);
          } else {
            runAutoScroll();
          }
        });
      }, delay);
    },
    clearTimelineAutoScrollTimer() {
      if (this.timelineAutoScrollTimer) {
        window.clearTimeout(this.timelineAutoScrollTimer);
        this.timelineAutoScrollTimer = null;
      }
    },
    handleTimelineChartScroll() {
      if (this.timelineProgrammaticScroll) {
        return;
      }
      if (this.timelineAutoScrollPending) {
        this.timelineAutoScrollPending = false;
        this.clearTimelineAutoScrollTimer();
      }
    },
    autoScrollTimelineChart() {
      const scrollEl = this.$refs.timelineChartScroll as HTMLElement;
      if (!this.timelineAutoScrollPending) {
        return;
      }
      const totals = this.timelineBinTotals || [];
      if (!scrollEl || totals.length === 0 || _.sum(totals) <= 0) {
        this.retryTimelineAutoScroll();
        return;
      }

      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 1) {
        this.timelineAutoScrollPending = false;
        scrollEl.scrollLeft = 0;
        return;
      }

      const focusIndex = this.timelineActivityFocusIndex(scrollEl);
      if (!Number.isFinite(focusIndex) || focusIndex < 0) {
        this.timelineAutoScrollPending = false;
        return;
      }

      const pxPerBin = scrollEl.scrollWidth / Math.max(1, this.timelineBinTotals.length);
      const targetCenter = (focusIndex + 0.5) * pxPerBin;
      const nextScrollLeft = Math.max(
        0,
        Math.min(maxScroll, targetCenter - scrollEl.clientWidth / 2)
      );
      this.timelineProgrammaticScroll = true;
      scrollEl.scrollLeft = nextScrollLeft;
      this.timelineAutoScrollPending = false;
      window.setTimeout(() => {
        this.timelineProgrammaticScroll = false;
      }, 0);
    },
    retryTimelineAutoScroll() {
      if (!this.timelineAutoScrollPending) {
        return;
      }
      this.timelineAutoScrollAttempts += 1;
      if (this.timelineAutoScrollAttempts <= 12) {
        this.scheduleTimelineAutoScroll(80);
        return;
      }
      this.timelineAutoScrollPending = false;
    },
    timelineActivityFocusIndex(scrollEl) {
      const values = (this.timelineBinTotals || []).map(value => Math.max(0, Number(value || 0)));
      const total = _.sum(values);
      if (values.length === 0 || total <= 0) {
        return 0;
      }

      const pxPerBin = scrollEl.scrollWidth / Math.max(1, values.length);
      const visibleBins = Math.max(1, Math.ceil(scrollEl.clientWidth / Math.max(1, pxPerBin)));
      const windowBins = Math.min(values.length, visibleBins);
      let bestStart = 0;
      let bestScore = -1;
      let rollingScore = 0;

      values.forEach((value, index) => {
        rollingScore += value;
        if (index >= windowBins) {
          rollingScore -= values[index - windowBins];
        }
        if (index >= windowBins - 1 && rollingScore > bestScore) {
          bestScore = rollingScore;
          bestStart = index - windowBins + 1;
        }
      });

      let weightedIndexSum = 0;
      let weightedDurationSum = 0;
      for (let index = bestStart; index < bestStart + windowBins; index += 1) {
        const value = values[index] || 0;
        weightedIndexSum += index * value;
        weightedDurationSum += value;
      }

      if (weightedDurationSum <= 0) {
        return bestStart + (windowBins - 1) / 2;
      }
      return weightedIndexSum / weightedDurationSum;
    },
    async loadRawEvents(options: any = {}) {
      if (!this.user || !this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return false;
      }

      this.closeTimelineDetailWindow();

      const showGlobalLoading = options.showGlobalLoading !== false;
      const requestKey = this.reloadKey;
      const requestId = this.loadRequestId + 1;
      this.loadRequestId = requestId;
      if (showGlobalLoading) {
        this.loading = true;
      }
      this.loadError = '';

      try {
        if (!this.categoryStore.classes || this.categoryStore.classes.length === 0) {
          this.categoryStore.load();
        }

        const buckets = await this.loadSummaryBuckets();

        if (requestId !== this.loadRequestId || requestKey !== this.reloadKey) {
          return false;
        }

        this.rawTimelineBuckets = buckets;
        this.activeWindowEvents = this.buildActiveWindowEvents(buckets);
        this.syncDailyTimelineWatchers();
        this.requestTimelineAutoScroll();
        return true;
      } catch (error) {
        console.error('Unable to load fleet activity summary:', error);
        this.loadError = this.$tr('Unable to load activity summary');
        this.activeWindowEvents = [];
        this.rawTimelineBuckets = [];
        this.selectedDailyWatcherKeys = [];
        return false;
      } finally {
        if (showGlobalLoading && requestId === this.loadRequestId) {
          this.loading = false;
        }
      }
    },
    async refreshDailyTimelineData() {
      if (!this.user || !this.rangeStart.isValid() || !this.rangeEnd.isValid()) {
        return false;
      }

      const requestKey = this.reloadKey;
      try {
        const buckets = await this.loadSummaryBuckets();
        if (requestKey !== this.reloadKey) {
          return false;
        }
        this.rawTimelineBuckets = buckets;
        this.syncDailyTimelineWatchers();
        return true;
      } catch (error) {
        console.error('Unable to refresh daily watcher timeline:', error);
        this.loadError = this.$tr('Unable to load activity summary');
        return false;
      }
    },
    async refreshPanel(panelKey) {
      if (this.loading || this.isPanelRefreshing(panelKey)) {
        return;
      }

      this.$set(this.panelRefreshing, panelKey, true);
      try {
        const refreshed =
          panelKey === 'dailyTimeline'
            ? await this.refreshDailyTimelineData()
            : await this.loadRawEvents({ showGlobalLoading: false });
        if (refreshed) {
          this.bumpPanelRefreshKey(panelKey);
        }
      } finally {
        this.$set(this.panelRefreshing, panelKey, false);
      }
    },
    isPanelRefreshing(panelKey) {
      return Boolean(this.panelRefreshing[panelKey]);
    },
    bumpPanelRefreshKey(panelKey) {
      this.$set(this.panelRefreshKeys, panelKey, Number(this.panelRefreshKeys[panelKey] || 0) + 1);
    },
    async loadSummaryBuckets() {
      await this.bucketsStore.ensureLoaded();
      const candidateBuckets = (this.bucketsStore.buckets || []).filter(bucket => {
        if (this.showDetailedWatcherTimeline) {
          return this.isDailyTimelineBucketCandidate(bucket);
        }
        return this.isSummaryBucketCandidate(bucket);
      });

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
        !this.isSessionBucket(bucket) &&
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
    isDailyTimelineBucketCandidate(bucket) {
      if (this.isHiddenTimelineBucket(bucket)) {
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
    isHiddenTimelineBucket(bucket) {
      const bucketType = String(bucket?.type || '');
      return bucketType.startsWith('general.stopwatch') || bucketType === 'systemmetrics';
    },
    bucketIdentity(bucket) {
      return getBucketIdentity(bucket);
    },
    buildDailyTimelineBucket(bucket) {
      const events = [];
      const ignoredShortAfkIntervalsBySession =
        bucket?.type === 'afkstatus' ? this.ignoredShortAfkIntervalsBySession : null;
      const afkDataGapIntervalsBySession =
        bucket?.type === 'afkstatus' ? this.afkDataGapIntervalsBySession : null;

      for (const event of bucket.events || []) {
        const identity = this.eventIdentity(bucket, event);
        if (!this.matchesIdentity(identity)) {
          continue;
        }

        const interval = this.clipEventInterval(event);
        if (!interval) {
          continue;
        }

        let data = event.data || {};
        if (
          this.isIgnoredShortAfkDisplayEvent(
            bucket,
            event,
            identity,
            ignoredShortAfkIntervalsBySession
          )
        ) {
          data = {
            ...data,
            status: 'not-afk',
            $ignoredShortAfk: true,
          };
        }

        let timelineEvent = {
          ...event,
          timestamp: interval.start.format(),
          duration: interval.end.diff(interval.start, 'seconds', true),
          data,
        };
        timelineEvent = this.withDailyTimelineCategory(bucket, timelineEvent);
        if (this.isIgnoredDailyTimelineCategory(bucket, timelineEvent)) {
          continue;
        }

        events.push(timelineEvent);
      }
      this.addAfkDataGapDisplayEvents(bucket, events, afkDataGapIntervalsBySession);

      return {
        ...bucket,
        display_name: this.buildDailyTimelineBucketLabel(bucket),
        events: _.sortBy(events, event => moment(event.timestamp).valueOf()),
      };
    },
    withDailyTimelineCategory(bucket, event) {
      if (!this.isWindowBucket(bucket) || !this.categoryStore.classes?.length) {
        return event;
      }

      const classified =
        classifyEvents([_.cloneDeep(event)], this.categoryStore.classes)[0] || event;
      const category = classified.data?.$category || ['Uncategorized'];
      return {
        ...event,
        data: {
          ...(event.data || {}),
          ...(classified.data || {}),
          $category: category,
          $color: this.categoryStore.get_category_color(category),
          $score: this.categoryStore.get_category_score(category),
        },
      };
    },
    isIgnoredDailyTimelineCategory(bucket, event) {
      return this.isWindowBucket(bucket) && this.isIgnoredCategory(event.data?.$category);
    },
    buildDailyTimelineBucketLabel(bucket) {
      const identity = this.bucketIdentity(bucket);
      const parts = [identity.watcherLabel];
      parts.push(
        `${this.$tr('Session')} ${identity.sessionId}${
          identity.sessionType ? ` (${identity.sessionType})` : ''
        }`
      );

      if (this.selectedDeviceIds.length !== 1) {
        parts.push(identity.deviceName);
      }

      return parts.join(' | ');
    },
    selectAllDailyWatchers() {
      this.selectedDailyWatcherKeys = this.dailyWatcherOptions.map(option => option.value);
    },
    clearDailyWatchers() {
      this.selectedDailyWatcherKeys = [];
    },
    syncDailyTimelineWatchers() {
      const availableOptions = this.dailyWatcherOptions;
      const available = availableOptions.map(option => option.value);
      const defaultSelection = availableOptions
        .filter((option: any) => option.defaultSelected !== false)
        .map(option => option.value);

      if (available.length === 0) {
        if (this.selectedDailyWatcherKeys.length > 0) {
          this.selectedDailyWatcherKeys = [];
        }
        return;
      }

      const filteredSelection = this.selectedDailyWatcherKeys.filter(value =>
        available.includes(value)
      );

      if (this.selectedDailyWatcherKeys.length === 0 || filteredSelection.length === 0) {
        this.selectedDailyWatcherKeys = [...defaultSelection];
        return;
      }

      if (!_.isEqual(filteredSelection, this.selectedDailyWatcherKeys)) {
        this.selectedDailyWatcherKeys = filteredSelection;
      }
    },
    systemMetricWatcherKey(deviceId) {
      return `${SYSTEM_METRIC_WATCHER_KEY_PREFIX}${deviceId}`;
    },
    buildSessionStateIntervalsBySession(buckets, state) {
      const intervalsBySession = new Map();
      for (const bucket of buckets || []) {
        if (bucket?.type !== 'sessionstate') {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity) || (event.data || {}).state !== state) {
            continue;
          }

          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          const key = this.sessionKey(identity);
          const intervals = intervalsBySession.get(key) || [];
          intervals.push(interval);
          intervalsBySession.set(key, intervals);
        }
      }

      for (const [key, intervals] of intervalsBySession.entries()) {
        intervalsBySession.set(key, this.mergeIntervals(intervals));
      }

      return intervalsBySession;
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
      const ignoredShortAfkIntervalsBySession =
        this.buildIgnoredShortAfkIntervalsBySession(buckets);
      const afkDataGapIntervalsBySession = this.buildAfkDataGapIntervalsBySession(buckets);

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

      for (const [key, intervals] of ignoredShortAfkIntervalsBySession.entries()) {
        const activeIntervals = intervalsBySession.get(key) || [];
        activeIntervals.push(...intervals);
        intervalsBySession.set(key, activeIntervals);
      }

      for (const [key, intervals] of afkDataGapIntervalsBySession.entries()) {
        const activeIntervals = intervalsBySession.get(key) || [];
        activeIntervals.push(...intervals);
        intervalsBySession.set(key, activeIntervals);
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
    buildIgnoredShortAfkIntervalsBySession(buckets) {
      if (!this.shouldIgnoreShortAfkPeriods) {
        return new Map();
      }

      const thresholdSeconds = Number(this.shortAfkThresholdSeconds || 0);
      if (thresholdSeconds <= 0) {
        return new Map();
      }

      const intervalsBySession = new Map();
      for (const [key, runs] of this.buildGroupedAfkRunsBySession(buckets).entries()) {
        const ignoredIntervals = [];
        runs.forEach(run => {
          if (!run.followedByNotAfk || run.durationSeconds > thresholdSeconds) {
            return;
          }
          ignoredIntervals.push(...run.clippedIntervals);
        });

        if (ignoredIntervals.length > 0) {
          intervalsBySession.set(key, this.mergeIntervals(ignoredIntervals));
        }
      }

      return intervalsBySession;
    },
    buildAfkStatusEventsBySession(buckets) {
      const eventsBySession = new Map();
      for (const bucket of buckets || []) {
        if (bucket?.type !== 'afkstatus') {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity)) {
            continue;
          }

          const afkStatus = String((event.data || {}).status || '').toLowerCase();
          if (afkStatus !== 'afk' && afkStatus !== 'not-afk') {
            continue;
          }

          const start = moment(event.timestamp);
          const duration = Number(event.duration || 0);
          const end = start.clone().add(duration, 'seconds');
          if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
            continue;
          }

          const key = this.sessionKey(identity);
          const events = eventsBySession.get(key) || [];
          events.push({
            status: afkStatus,
            start,
            end,
            interval: this.clipEventInterval(event),
          });
          eventsBySession.set(key, events);
        }
      }

      return eventsBySession;
    },
    buildGroupedAfkRunsBySession(buckets) {
      const runsBySession = new Map();
      for (const [key, events] of this.buildAfkStatusEventsBySession(buckets).entries()) {
        const sortedEvents = _.sortBy(events, [
          event => event.start.valueOf(),
          event => (event.status === 'afk' ? 0 : 1),
          event => event.end.valueOf(),
        ]);
        const runs = [];
        let afkRun = [];

        const flushAfkRun = nextEvent => {
          if (afkRun.length === 0) {
            return;
          }

          const intervals = this.mergeIntervals(
            afkRun.map(event => ({ start: event.start, end: event.end }))
          );
          const clippedIntervals = this.mergeIntervals(
            afkRun.map(event => event.interval).filter(interval => interval)
          );
          const durationSeconds = _.sum(
            intervals.map(interval => interval.end.diff(interval.start, 'seconds', true))
          );

          runs.push({
            durationSeconds,
            intervals,
            clippedIntervals,
            followedByNotAfk: nextEvent?.status === 'not-afk',
          });
          afkRun = [];
        };

        sortedEvents.forEach(event => {
          if (event.status === 'afk') {
            afkRun.push(event);
            return;
          }

          flushAfkRun(event);
        });
        flushAfkRun(null);

        if (runs.length > 0) {
          runsBySession.set(key, runs);
        }
      }

      return runsBySession;
    },
    findMaxActiveSessionAfkPeriodSeconds(buckets) {
      const activeIntervalsBySession = this.buildSessionStateIntervalsBySession(buckets, 'active');
      if (activeIntervalsBySession.size === 0) {
        return 0;
      }

      let maxSeconds = 0;
      for (const [key, runs] of this.buildGroupedAfkRunsBySession(buckets).entries()) {
        const activeIntervals = activeIntervalsBySession.get(key) || [];
        if (activeIntervals.length === 0) {
          continue;
        }

        runs.forEach(run => {
          const activeSeconds = _.sum(
            run.clippedIntervals.map(interval => {
              return _.sum(
                activeIntervals.map(activeInterval =>
                  this.overlapSeconds(
                    interval.start,
                    interval.end,
                    activeInterval.start,
                    activeInterval.end
                  )
                )
              );
            })
          );
          maxSeconds = Math.max(maxSeconds, activeSeconds);
        });
      }

      return maxSeconds;
    },
    buildAfkDataGapIntervalsBySession(buckets) {
      if (!this.shouldTreatAfkDataGapsAsActive) {
        return new Map();
      }

      const activeIntervalsBySession = this.buildSessionStateIntervalsBySession(buckets, 'active');
      if (activeIntervalsBySession.size === 0) {
        return new Map();
      }

      const coverageIntervalsBySession = new Map();
      for (const bucket of buckets || []) {
        if (bucket?.type !== 'afkstatus') {
          continue;
        }

        for (const event of bucket.events || []) {
          const identity = this.eventIdentity(bucket, event);
          if (!this.matchesIdentity(identity)) {
            continue;
          }

          const afkStatus = String((event.data || {}).status || '').toLowerCase();
          if (afkStatus !== 'afk' && afkStatus !== 'not-afk') {
            continue;
          }

          const interval = this.clipEventInterval(event);
          if (!interval) {
            continue;
          }

          const key = this.sessionKey(identity);
          const intervals = coverageIntervalsBySession.get(key) || [];
          intervals.push(interval);
          coverageIntervalsBySession.set(key, intervals);
        }
      }

      const gapsBySession = new Map();
      for (const [key, activeIntervals] of activeIntervalsBySession.entries()) {
        const coverageIntervals = this.mergeIntervals(coverageIntervalsBySession.get(key) || []);
        if (coverageIntervals.length === 0) {
          continue;
        }

        const gapIntervals = this.subtractIntervals(activeIntervals, coverageIntervals);
        const activeGapIntervals = this.mergeIntervals(
          _.flatMap(gapIntervals, interval =>
            this.intersectWithIntervals(interval, activeIntervals)
          )
        );
        if (activeGapIntervals.length > 0) {
          gapsBySession.set(key, activeGapIntervals);
        }
      }

      return gapsBySession;
    },
    addAfkDataGapDisplayEvents(bucket, events, afkDataGapIntervalsBySession) {
      if (bucket?.type !== 'afkstatus' || !afkDataGapIntervalsBySession) {
        return;
      }

      const identity = this.bucketIdentity(bucket);
      if (!this.matchesIdentity(identity)) {
        return;
      }

      const gapIntervals = afkDataGapIntervalsBySession.get(this.sessionKey(identity)) || [];
      gapIntervals.forEach((interval, index) => {
        const duration = interval.end.diff(interval.start, 'seconds', true);
        if (duration <= 1) {
          return;
        }

        events.push({
          id: `${bucket.id}__afk_data_gap_${index}`,
          timestamp: interval.start.format(),
          duration,
          data: {
            ...(bucket.data || {}),
            username: identity.username,
            device_id: identity.deviceId,
            device_name: identity.deviceName,
            session_id: identity.sessionId,
            session_type: identity.sessionType,
            status: 'not-afk',
            reason: 'afk-data-gap-filled',
            $synthetic: true,
            $afkDataGapFilled: true,
          },
        });
      });
    },
    isIgnoredShortAfkDisplayEvent(bucket, event, identity, ignoredShortAfkIntervalsBySession) {
      if (bucket?.type !== 'afkstatus' || !ignoredShortAfkIntervalsBySession) {
        return false;
      }
      if (String((event.data || {}).status || '').toLowerCase() !== 'afk') {
        return false;
      }

      const interval = this.clipEventInterval(event);
      if (!interval) {
        return false;
      }

      const key = this.sessionKey(identity);
      const ignoredIntervals = ignoredShortAfkIntervalsBySession.get(key) || [];
      return ignoredIntervals.some(ignoredInterval => {
        const ignoredSeconds = ignoredInterval.end.diff(ignoredInterval.start, 'seconds', true);
        return (
          this.overlapSeconds(
            interval.start,
            interval.end,
            ignoredInterval.start,
            ignoredInterval.end
          ) >= Math.max(0, ignoredSeconds - 0.5)
        );
      });
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
    subtractIntervals(baseIntervals, coveredIntervals) {
      const covered = this.mergeIntervals(coveredIntervals || []);
      const gaps = [];

      for (const baseInterval of baseIntervals || []) {
        let cursor = baseInterval.start.clone();
        const baseEnd = baseInterval.end.clone();

        for (const coveredInterval of covered) {
          if (!coveredInterval.end.isAfter(cursor)) {
            continue;
          }
          if (!coveredInterval.start.isBefore(baseEnd)) {
            break;
          }

          const gapEnd = moment.min(coveredInterval.start, baseEnd);
          if (gapEnd.isAfter(cursor)) {
            gaps.push({ start: cursor.clone(), end: gapEnd.clone() });
          }

          if (coveredInterval.end.isAfter(cursor)) {
            cursor = coveredInterval.end.clone();
          }
          if (!cursor.isBefore(baseEnd)) {
            break;
          }
        }

        if (cursor.isBefore(baseEnd)) {
          gaps.push({ start: cursor.clone(), end: baseEnd.clone() });
        }
      }

      return this.mergeIntervals(gaps);
    },
    formatMinutesSeconds(seconds) {
      const totalSeconds = Math.round(Math.max(0, Number(seconds || 0)));
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    },
    formatFleetCategoryRuleDuration(seconds) {
      return seconds_to_duration(Number(seconds || 0));
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
    eventDeviceLabel(event) {
      const data = event?.data || {};
      return String(data.device_name || data.hostname || data.device_id || UNKNOWN);
    },
    eventDeviceKey(event) {
      const data = event?.data || {};
      return String(data.device_id || data.hostname || data.device_name || UNKNOWN);
    },
    timelineDeviceEntryLabel(deviceLabel, appLabel, titleLabel) {
      const title = String(titleLabel || '').trim();
      if (!title || title === '(no title)' || title === appLabel) {
        return `${deviceLabel} · ${appLabel}`;
      }
      return `${deviceLabel} · ${appLabel} · ${title}`;
    },
    timelineEventEntry(eventStart, deviceLabel, appLabel, titleLabel, duration) {
      return {
        label: `${this.formatTimelineEventStart(eventStart)} · ${this.timelineDeviceEntryLabel(
          deviceLabel,
          appLabel,
          titleLabel
        )}`,
        duration: Math.round(Number(duration || 0)),
        start: moment(eventStart).valueOf(),
      };
    },
    formatTimelineEventStart(value) {
      const start = moment(value);
      if (!start.isValid()) {
        return this.$tr('Unknown start');
      }
      if (this.isSingleDayRange || start.isSame(this.rangeStart, 'day')) {
        return start.format('HH:mm:ss');
      }
      return start.format('MMM D HH:mm:ss');
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
    isSessionBucket(bucket) {
      return bucket?.type === 'sessionstate';
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
        rawDuration: Math.round(Number(detail.rawDuration || detail.duration || 0)),
        afkDuration: Math.round(Number(detail.afkDuration || 0)),
        rawAfkDuration: Math.round(Number(detail.rawAfkDuration || detail.afkDuration || 0)),
        apps: toSortedList(detail.apps),
        titles: toSortedList(detail.titles),
        categories: includeCategories ? toSortedList(detail.categories) : [],
        devices: toSortedList(detail.devices),
        deviceEntries: toSortedList(detail.deviceEntries),
        eventEntries: _.orderBy(
          detail.eventEntries || [],
          ['start', 'duration'],
          ['asc', 'desc']
        ).filter(item => item.duration > 0),
      };
    },
    formatTimelineTooltipDetail(detail, datasetLabel = '') {
      if (!detail || detail.duration <= 0) {
        return [];
      }

      const lines = [];
      if (Number(detail.rawDuration || 0) > Number(detail.duration || 0) + 1) {
        lines.push(
          `${this.$tr('Collected device time')}: ${seconds_to_duration(detail.rawDuration)}`
        );
      }
      if (datasetLabel === 'Other') {
        this.addTimelineTooltipSection(lines, this.$tr('Top Categories'), detail.categories, 4);
      }
      this.addTimelineTooltipSection(lines, this.$tr('Device breakdown'), detail.devices, 4);
      this.addTimelineTooltipSection(
        lines,
        this.$tr('Device entries'),
        detail.deviceEntries,
        4,
        86
      );
      this.addTimelineTooltipSection(lines, this.$tr('Events'), detail.eventEntries, 8, 96);
      this.addTimelineTooltipSection(lines, this.$tr('Top Applications'), detail.apps, 4);
      this.addTimelineTooltipSection(lines, this.$tr('Top Window Titles'), detail.titles, 4, 72);

      return lines;
    },
    formatTimelineAxisTooltipDetail(datasets, index, visibleHours) {
      const detail = this.mergeTimelineDetails(datasets, index);
      if (!detail || detail.rawDuration <= 0) {
        return [];
      }

      const lines = [];
      const visibleSeconds = Number(visibleHours || 0) * 3600;
      if (detail.rawDuration > visibleSeconds + 1) {
        lines.push(
          `${this.$tr('Collected device time')}: ${seconds_to_duration(detail.rawDuration)}`
        );
      }
      this.addTimelineTooltipSection(lines, this.$tr('Device breakdown'), detail.devices, 6);
      this.addTimelineTooltipSection(lines, this.$tr('Top Categories'), detail.categories, 8);
      this.addTimelineTooltipSection(
        lines,
        this.$tr('Device entries'),
        detail.deviceEntries,
        6,
        86
      );
      this.addTimelineTooltipSection(lines, this.$tr('Events'), detail.eventEntries, 10, 96);

      return lines;
    },
    mergeTimelineDetails(datasets, index) {
      const addValue = (values, label, duration) => {
        const seconds = Number(duration || 0);
        if (!label || seconds <= 0) {
          return;
        }
        values.set(label, Number(values.get(label) || 0) + seconds);
      };
      const addEntries = (values, entries = []) => {
        entries.forEach(entry => addValue(values, entry.label, entry.duration));
      };
      const toSortedList = values =>
        _.orderBy(
          Array.from(values.entries()).map(([label, duration]) => ({
            label,
            duration: Math.round(Number(duration || 0)),
          })),
          ['duration'],
          ['desc']
        ).filter(item => item.duration > 0);

      const merged = {
        rawDuration: 0,
        devices: new Map(),
        categories: new Map(),
        deviceEntries: new Map(),
        eventEntries: [],
      };

      (datasets || []).forEach((dataset: any) => {
        const detail = dataset?.$timelineDetails?.[index];
        if (!detail || Number(detail.rawDuration || detail.duration || 0) <= 0) {
          return;
        }

        const rawDuration = Number(detail.rawDuration || detail.duration || 0);
        merged.rawDuration += rawDuration;
        addValue(
          merged.categories,
          dataset.$timelineCategoryLabel || dataset.label || UNKNOWN,
          rawDuration
        );
        addEntries(merged.devices, detail.devices);
        addEntries(merged.deviceEntries, detail.deviceEntries);
        merged.eventEntries.push(...(detail.eventEntries || []));
      });

      return {
        rawDuration: Math.round(merged.rawDuration),
        devices: toSortedList(merged.devices),
        categories: toSortedList(merged.categories),
        deviceEntries: toSortedList(merged.deviceEntries),
        eventEntries: _.orderBy(
          merged.eventEntries.filter(entry => Number(entry.duration || 0) > 0),
          ['start', 'duration'],
          ['asc', 'desc']
        ),
      };
    },
    timelineBarTotalSummaryLines(index) {
      const totalHours = Number(this.timelineBinTotals?.[index] || 0);
      if (totalHours <= 0) {
        return [];
      }
      return [`${this.$tr('Bar total')}: ${seconds_to_duration(Math.round(totalHours * 3600))}`];
    },
    timelineActiveSummaryLines(index) {
      const activeSessionTimeLabel = this.$tr('Active session time');
      const seconds = Number(this.timelineActiveSessionSecondsByBin?.[index] || 0);
      if (this.subtractAfkTime) {
        const notAfkActiveSessionTimeLabel = this.$tr('Active after AFK subtraction');
        const notAfkSeconds = Number(this.timelineNotAfkActiveSessionSecondsByBin?.[index] || 0);
        const lines = [`${notAfkActiveSessionTimeLabel}: ${seconds_to_duration(notAfkSeconds)}`];
        if (seconds > notAfkSeconds + 1) {
          lines.push(`${activeSessionTimeLabel}: ${seconds_to_duration(seconds)}`);
        }
        return lines;
      }
      return [`${activeSessionTimeLabel}: ${seconds_to_duration(seconds)}`];
    },
    handleTimelineChartClick(chart, event, elements = []) {
      if (!chart || !event) {
        return;
      }

      const clickedElements =
        elements && elements.length > 0 ? elements : this.timelineClickedBarElements(chart, event);
      if (clickedElements.length > 0) {
        this.openTimelineBarDetailWindow(chart, event, clickedElements[0]);
        return;
      }

      if (this.isTimelineAxisClick(chart, event)) {
        const index = this.timelineIndexFromPixel(chart, Number(event.x));
        if (index >= 0 && this.timelineActiveElementsForIndex(chart, index).length > 0) {
          this.openTimelineAxisDetailWindow(chart, event, index);
        }
      }
    },
    timelineClickedBarElements(chart, event) {
      if (!chart?.getElementsAtEventForMode || !event?.native) {
        return [];
      }
      return chart.getElementsAtEventForMode(event.native, 'nearest', { intersect: true }, true);
    },
    isTimelineAxisClick(chart, event) {
      const chartArea = chart?.chartArea;
      if (!chartArea) {
        return false;
      }

      const x = Number(event.x);
      const y = Number(event.y);
      return (
        x >= chartArea.left && x <= chartArea.right && y >= chartArea.bottom && y <= chart.height
      );
    },
    openTimelineBarDetailWindow(chart, event, element) {
      const datasetIndex = Number(element?.datasetIndex);
      const index = Number(element?.index);
      const dataset = chart?.data?.datasets?.[datasetIndex];
      const values = Array.isArray(dataset?.data) ? dataset.data : [];
      const visibleSeconds = Number(values[index] || 0) * 3600;
      if (!dataset || !Number.isFinite(index) || visibleSeconds <= 0) {
        return;
      }

      const detail = dataset?.$timelineDetails?.[index];
      const rawSeconds = Number(detail?.rawDuration || visibleSeconds);
      const lines = [
        ...this.timelineBarTotalSummaryLines(index),
        ...this.timelineActiveSummaryLines(index),
        '',
        this.timelineDatasetDurationLine(dataset.label, visibleSeconds, rawSeconds),
        ...this.formatTimelineTooltipDetail(
          detail,
          dataset?.$timelineCategoryLabel || dataset?.label
        ),
      ];

      this.openTimelineDetailWindow(chart, event, {
        subtitle: this.timelineDetailSubtitle(index, dataset.label),
        lines,
      });
    },
    openTimelineAxisDetailWindow(chart, event, index) {
      const datasets = chart?.data?.datasets || [];
      const totalHours = _.sumBy(datasets, (dataset: any) => {
        const values = Array.isArray(dataset.data) ? dataset.data : [];
        return Number(values[index] || 0);
      });
      if (totalHours <= 0) {
        return;
      }

      const afkHours = Number(this.timelineAfkData?.[index] || 0);
      const lines = [
        ...this.timelineBarTotalSummaryLines(index),
        ...this.timelineActiveSummaryLines(index),
        '',
      ];
      if (afkHours > 0) {
        lines.push(`${this.$tr('AFK time')}: ${seconds_to_duration(afkHours * 3600)}`);
      }
      lines.push(...this.formatTimelineAxisTooltipDetail(datasets, index, totalHours));

      this.openTimelineDetailWindow(chart, event, {
        subtitle: this.timelineDetailSubtitle(index, this.$tr('Total time')),
        lines,
      });
    },
    timelineDatasetDurationLine(datasetLabel, visibleSeconds, rawSeconds) {
      const label = `${datasetLabel}: ${seconds_to_duration(visibleSeconds)}`;
      if (rawSeconds > visibleSeconds + 1) {
        return `${label} (${this.$tr('Collected device time')}: ${seconds_to_duration(
          rawSeconds
        )})`;
      }
      return label;
    },
    timelineDetailSubtitle(index, suffix = '') {
      const binLabel = this.timelineBins?.[index]?.label || '';
      return suffix ? `${binLabel} | ${suffix}` : binLabel;
    },
    openTimelineDetailWindow(chart, event, detail) {
      const lines = this.timelineTextLinesToItems(detail?.lines || []);
      if (lines.length === 0) {
        return;
      }

      this.clearTimelineTooltipHideTimer();
      this.clearTimelineTooltipShowTimer();
      this.timelineTooltip = {
        ...this.timelineTooltip,
        visible: false,
      };

      const position = this.timelineDetailWindowPosition(chart, event);
      this.timelineDetailWindow = {
        visible: true,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        subtitle: detail?.subtitle || '',
        lines,
      };
    },
    timelineDetailWindowPosition(chart, event) {
      const canvasRect = chart?.canvas?.getBoundingClientRect();
      const viewportWidth = Number(window?.innerWidth || 1200);
      const viewportHeight = Number(window?.innerHeight || 800);
      const windowWidth = Math.min(860, Math.max(440, viewportWidth - 32));
      const windowHeight = Math.min(680, Math.max(320, viewportHeight - 32));
      const preferredX = Number(canvasRect?.left || 0) + Number(event?.x || 0) + 18;
      const preferredY = Number(canvasRect?.top || 0) + Number(event?.y || 0) + 18;

      return {
        x: Math.max(16, Math.min(preferredX, viewportWidth - windowWidth - 16)),
        y: Math.max(16, Math.min(preferredY, viewportHeight - windowHeight - 16)),
        width: windowWidth,
        height: windowHeight,
      };
    },
    closeTimelineDetailWindow() {
      this.stopTimelineDetailWindowDrag();
      this.stopTimelineDetailWindowResize();
      this.timelineDetailWindow = {
        ...this.timelineDetailWindow,
        visible: false,
      };
    },
    startTimelineDetailWindowDrag(event) {
      const target = event?.target;
      if (target?.closest?.('.fleet-chart-detail-window__close')) {
        return;
      }

      const point = this.timelineDetailDragPoint(event);
      if (!point || typeof window === 'undefined') {
        return;
      }

      const windowElement = event?.currentTarget?.closest?.('.fleet-chart-detail-window');
      const rect = windowElement?.getBoundingClientRect?.();
      const left = Number(rect?.left ?? this.timelineDetailWindow.x);
      const currentTop = Number(rect?.top ?? this.timelineDetailWindow.y);

      this.timelineDetailDrag = {
        active: true,
        offsetX: point.clientX - left,
        offsetY: point.clientY - currentTop,
        width: Number(rect?.width || 0),
        height: Number(rect?.height || 0),
      };

      document.addEventListener('mousemove', this.dragTimelineDetailWindow, true);
      document.addEventListener('mouseup', this.stopTimelineDetailWindowDrag, true);
      document.addEventListener('touchmove', this.dragTimelineDetailWindow, true);
      document.addEventListener('touchend', this.stopTimelineDetailWindowDrag, true);
      document.addEventListener('touchcancel', this.stopTimelineDetailWindowDrag, true);

      if (event?.cancelable) {
        event.preventDefault();
      }
    },
    dragTimelineDetailWindow(event) {
      if (!this.timelineDetailDrag.active || typeof window === 'undefined') {
        return;
      }

      const point = this.timelineDetailDragPoint(event);
      if (!point) {
        return;
      }

      if (event?.cancelable) {
        event.preventDefault();
      }

      const margin = 8;
      const width = Number(this.timelineDetailDrag.width || 440);
      const height = Number(this.timelineDetailDrag.height || 320);
      const viewportWidth = Number(window.innerWidth || 1200);
      const viewportHeight = Number(window.innerHeight || 800);
      const maxX = Math.max(margin, viewportWidth - width - margin);
      const maxY = Math.max(margin, viewportHeight - height - margin);
      const x = Math.max(margin, Math.min(point.clientX - this.timelineDetailDrag.offsetX, maxX));
      const y = Math.max(margin, Math.min(point.clientY - this.timelineDetailDrag.offsetY, maxY));

      this.timelineDetailWindow = {
        ...this.timelineDetailWindow,
        x,
        y,
      };
    },
    stopTimelineDetailWindowDrag() {
      this.timelineDetailDrag = {
        ...this.timelineDetailDrag,
        active: false,
      };

      if (typeof document === 'undefined') {
        return;
      }

      document.removeEventListener('mousemove', this.dragTimelineDetailWindow, true);
      document.removeEventListener('mouseup', this.stopTimelineDetailWindowDrag, true);
      document.removeEventListener('touchmove', this.dragTimelineDetailWindow, true);
      document.removeEventListener('touchend', this.stopTimelineDetailWindowDrag, true);
      document.removeEventListener('touchcancel', this.stopTimelineDetailWindowDrag, true);
    },
    startTimelineDetailWindowResize(event) {
      const point = this.timelineDetailDragPoint(event);
      if (!point || typeof window === 'undefined') {
        return;
      }

      const windowElement = event?.currentTarget?.closest?.('.fleet-chart-detail-window');
      const rect = windowElement?.getBoundingClientRect?.();
      this.timelineDetailResize = {
        active: true,
        startX: point.clientX,
        startY: point.clientY,
        startWidth: Number(rect?.width || this.timelineDetailWindow.width || 440),
        startHeight: Number(rect?.height || this.timelineDetailWindow.height || 320),
      };

      document.addEventListener('mousemove', this.resizeTimelineDetailWindow, true);
      document.addEventListener('mouseup', this.stopTimelineDetailWindowResize, true);
      document.addEventListener('touchmove', this.resizeTimelineDetailWindow, true);
      document.addEventListener('touchend', this.stopTimelineDetailWindowResize, true);
      document.addEventListener('touchcancel', this.stopTimelineDetailWindowResize, true);

      if (event?.cancelable) {
        event.preventDefault();
      }
    },
    resizeTimelineDetailWindow(event) {
      if (!this.timelineDetailResize.active || typeof window === 'undefined') {
        return;
      }

      const point = this.timelineDetailDragPoint(event);
      if (!point) {
        return;
      }

      if (event?.cancelable) {
        event.preventDefault();
      }

      const margin = 8;
      const minWidth = Math.min(440, Math.max(280, Number(window.innerWidth || 1200) - margin * 2));
      const minHeight = Math.min(
        320,
        Math.max(220, Number(window.innerHeight || 800) - margin * 2)
      );
      const maxWidth = Math.max(
        minWidth,
        Number(window.innerWidth || 1200) - Number(this.timelineDetailWindow.x || 0) - margin
      );
      const maxHeight = Math.max(
        minHeight,
        Number(window.innerHeight || 800) - Number(this.timelineDetailWindow.y || 0) - margin
      );
      const width = Math.max(
        minWidth,
        Math.min(
          this.timelineDetailResize.startWidth + point.clientX - this.timelineDetailResize.startX,
          maxWidth
        )
      );
      const height = Math.max(
        minHeight,
        Math.min(
          this.timelineDetailResize.startHeight + point.clientY - this.timelineDetailResize.startY,
          maxHeight
        )
      );

      this.timelineDetailWindow = {
        ...this.timelineDetailWindow,
        width,
        height,
      };
    },
    stopTimelineDetailWindowResize() {
      this.timelineDetailResize = {
        ...this.timelineDetailResize,
        active: false,
      };

      if (typeof document === 'undefined') {
        return;
      }

      document.removeEventListener('mousemove', this.resizeTimelineDetailWindow, true);
      document.removeEventListener('mouseup', this.stopTimelineDetailWindowResize, true);
      document.removeEventListener('touchmove', this.resizeTimelineDetailWindow, true);
      document.removeEventListener('touchend', this.stopTimelineDetailWindowResize, true);
      document.removeEventListener('touchcancel', this.stopTimelineDetailWindowResize, true);
    },
    timelineDetailDragPoint(event) {
      if (event?.touches?.length > 0) {
        return event.touches[0];
      }
      if (event?.changedTouches?.length > 0) {
        return event.changedTouches[0];
      }
      return event;
    },
    timelineTextLinesToItems(textLines = []) {
      const lines = [];
      const pushLine = (text, preferredType = null) => {
        const value = String(text ?? '');
        if (value.trim() === '') {
          lines.push({ type: 'spacer', text: '' });
          return;
        }
        const type = preferredType || (value.includes(':') ? 'item' : 'section');
        lines.push({ type, text: value });
      };

      textLines.forEach((line, index) => pushLine(line, index === 0 ? 'title' : null));
      return lines;
    },
    updateTimelineExternalTooltip(context) {
      const chart = context?.chart;
      const tooltip = context?.tooltip;
      if (!chart || !tooltip || tooltip.opacity === 0) {
        this.clearTimelineTooltipShowTimer();
        this.scheduleTimelineTooltipHide();
        return;
      }

      const lines = this.timelineTooltipLines(tooltip);
      if (lines.length === 0) {
        this.clearTimelineTooltipShowTimer();
        this.scheduleTimelineTooltipHide();
        return;
      }

      this.clearTimelineTooltipHideTimer();

      const canvasRect = chart.canvas.getBoundingClientRect();
      const viewportWidth = Number(window?.innerWidth || 1200);
      const viewportHeight = Number(window?.innerHeight || 800);
      const tooltipWidth = Math.min(672, Math.max(360, viewportWidth - 24));
      const tooltipMaxHeight = Math.min(576, Math.max(260, viewportHeight - 24));
      const preferredX = canvasRect.left + Number(tooltip.caretX || 0) + 16;
      const preferredY = canvasRect.top + Number(tooltip.caretY || 0) + 16;
      const signature = this.timelineTooltipSignature(tooltip, lines);
      const nextTooltip = {
        visible: true,
        x: Math.max(12, Math.min(preferredX, viewportWidth - tooltipWidth - 12)),
        y: Math.max(12, Math.min(preferredY, viewportHeight - tooltipMaxHeight - 12)),
        lines,
        signature,
      };

      if (this.timelineTooltip.visible && this.timelineTooltip.signature === signature) {
        this.timelineTooltip = nextTooltip;
        return;
      }

      if (this.timelineTooltip.visible) {
        this.timelineTooltip = {
          ...this.timelineTooltip,
          visible: false,
        };
      }

      if (this.timelineTooltipPending?.signature === signature) {
        this.timelineTooltipPending = nextTooltip;
        return;
      }

      this.clearTimelineTooltipShowTimer();
      this.timelineTooltipPending = nextTooltip;
      this.timelineTooltipShowTimer = window.setTimeout(() => {
        if (this.timelineTooltipPending?.signature !== signature) {
          return;
        }

        this.timelineTooltip = this.timelineTooltipPending;
        this.timelineTooltipPending = null;
        this.timelineTooltipShowTimer = null;
      }, TIMELINE_TOOLTIP_HOVER_DELAY_MS);
    },
    timelineTooltipSignature(tooltip, lines) {
      const dataPointSignature = (tooltip.dataPoints || [])
        .map(point => `${point.datasetIndex}:${point.dataIndex}`)
        .join('|');
      if (dataPointSignature) {
        return dataPointSignature;
      }
      return lines.map(line => `${line.type}:${line.text}`).join('|');
    },
    timelineTooltipLines(tooltip) {
      const lines = [];
      const pushLine = (text, preferredType = null) => {
        const value = String(text ?? '');
        if (value.trim() === '') {
          lines.push({ type: 'spacer', text: '' });
          return;
        }
        const type = preferredType || (value.includes(':') ? 'item' : 'section');
        lines.push({ type, text: value });
      };

      (tooltip.title || []).forEach(title => pushLine(title, 'title'));
      (tooltip.body || []).forEach(bodyItem => {
        [...(bodyItem.before || []), ...(bodyItem.lines || []), ...(bodyItem.after || [])].forEach(
          line => pushLine(line)
        );
      });
      (tooltip.footer || []).forEach(line => pushLine(line));

      return lines;
    },
    holdTimelineTooltip() {
      this.timelineTooltipHovered = true;
      this.clearTimelineTooltipHideTimer();
    },
    releaseTimelineTooltip() {
      this.timelineTooltipHovered = false;
      this.scheduleTimelineTooltipHide(120);
    },
    scheduleTimelineTooltipHide(delay = 300) {
      this.clearTimelineTooltipHideTimer();
      this.timelineTooltipHideTimer = window.setTimeout(() => {
        if (!this.timelineTooltipHovered) {
          this.timelineTooltip = {
            ...this.timelineTooltip,
            visible: false,
          };
        }
      }, delay);
    },
    clearTimelineTooltipHideTimer() {
      if (this.timelineTooltipHideTimer) {
        window.clearTimeout(this.timelineTooltipHideTimer);
        this.timelineTooltipHideTimer = null;
      }
    },
    clearTimelineTooltipShowTimer() {
      if (this.timelineTooltipShowTimer) {
        window.clearTimeout(this.timelineTooltipShowTimer);
        this.timelineTooltipShowTimer = null;
      }
      this.timelineTooltipPending = null;
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
    formatCategoryKeyLabel(key) {
      return String(key || 'Uncategorized')
        .split(CATEGORY_KEY_SEPARATOR)
        .filter(part => part !== '')
        .join(' > ');
    },
    isIgnoredCategory(category) {
      if (this.ignoredCategoryKeySet.size === 0) {
        return false;
      }

      const key = categoryKey(category || ['Uncategorized']);
      for (const ignoredKey of this.ignoredCategoryKeySet) {
        if (key === ignoredKey || key.startsWith(`${ignoredKey}${CATEGORY_KEY_SEPARATOR}`)) {
          return true;
        }
      }
      return false;
    },
    categoryName(event) {
      return (event.data.$category || ['Uncategorized']).join(' > ');
    },
    formatTimelineAxisTick(value) {
      const hours = Number(value || 0);
      return hours >= 1 ? `${hours}h` : `${Math.round(hours * 60)}m`;
    },
    formatTimelineBarValueLabel(value) {
      const seconds = Math.round(Math.max(0, Number(value || 0) * 3600));
      if (seconds <= 0) {
        return '';
      }
      if (seconds < 60) {
        return `${seconds}s`;
      }
      if (seconds < 3600) {
        return `${Math.round(seconds / 60)}m`;
      }

      const hours = Math.round((seconds / 3600) * 10) / 10;
      return Number.isInteger(hours) ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`;
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
    drawTimelineLabelPill(ctx, left, rectTop, width, height, fillColor, borderColor) {
      const radius = Math.min(4, height / 2, width / 2);
      const right = left + width;
      const bottom = rectTop + height;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left + radius, rectTop);
      ctx.lineTo(right - radius, rectTop);
      ctx.quadraticCurveTo(right, rectTop, right, rectTop + radius);
      ctx.lineTo(right, bottom - radius);
      ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
      ctx.lineTo(left + radius, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
      ctx.lineTo(left, rectTop + radius);
      ctx.quadraticCurveTo(left, rectTop, left + radius, rectTop);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
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

.fleet-summary-panel--daily-watchers {
  min-height: 24rem;
}

.fleet-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  h6 {
    min-width: 0;
  }
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

.fleet-short-afk-input {
  width: 14rem;
}

.fleet-ignored-category-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.25rem 0.75rem;
  max-height: 8.5rem;
  overflow: auto;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.48);
}

.fleet-category-rule-target,
.fleet-category-rule-value {
  display: block;
  max-height: 5rem;
  overflow: auto;
  padding: 0.35rem 0.5rem;
  border-radius: 0.25rem;
  background: rgba(127, 127, 127, 0.1);
  word-break: break-word;
}

.fleet-summary-panel--sunburst {
  overflow: hidden;
}

.fleet-session-summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 0.45rem;
  background: #fbfcfe;
}

.fleet-session-summary-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.75rem;
}

.fleet-session-summary-metric {
  min-width: 10rem;
}

.fleet-session-summary-value {
  color: #132033;
  font-size: 1.45rem;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.fleet-session-summary-value--secondary {
  color: #3f4c5f;
  font-size: 1.15rem;
}

.fleet-session-summary-help {
  max-width: 34rem;
  text-align: right;
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

.fleet-chart-tooltip {
  position: fixed;
  z-index: 2500;
  width: min(42rem, calc(100vw - 1.5rem));
  max-height: min(72vh, 36rem);
  overflow-y: auto;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(127, 127, 127, 0.32);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.98);
  color: #18202f;
  box-shadow: 0 0.9rem 2.5rem rgba(0, 0, 0, 0.24);
  font-size: 0.86rem;
  line-height: 1.35;
  pointer-events: auto;
  white-space: normal;
}

.fleet-chart-tooltip-line {
  word-break: break-word;
}

.fleet-chart-tooltip-line--title {
  margin-bottom: 0.35rem;
  font-weight: 700;
  color: #0d1626;
}

.fleet-chart-tooltip-line--section {
  margin-top: 0.45rem;
  font-weight: 700;
  color: #33415c;
}

.fleet-chart-tooltip-line--item {
  color: #1e2635;
  font-variant-numeric: tabular-nums;
}

.fleet-chart-tooltip-line--spacer {
  height: 0.45rem;
}

.fleet-daily-timeline-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.fleet-daily-swimlane {
  display: flex;
  align-items: center;

  select {
    width: 10.5rem;
  }
}

.fleet-daily-watcher-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.35rem 0.75rem;
  max-height: 10rem;
  overflow: auto;
  padding: 0.6rem;
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 0.45rem;
  background: rgba(127, 127, 127, 0.08);
}

.fleet-summary-empty {
  color: #999;
  font-size: 1.2rem;
}

.fleet-chart-tooltip--dark {
  border-color: rgba(233, 235, 240, 0.22);
  background: rgba(22, 25, 33, 0.98);
  color: #eef1f6;
  box-shadow: 0 0.9rem 2.5rem rgba(0, 0, 0, 0.5);
}

.fleet-chart-tooltip--dark .fleet-chart-tooltip-line--title {
  color: #fff;
}

.fleet-chart-tooltip--dark .fleet-chart-tooltip-line--section {
  color: #cbd3e2;
}

.fleet-chart-tooltip--dark .fleet-chart-tooltip-line--item {
  color: #eef1f6;
}

.fleet-chart-detail-window {
  position: fixed;
  z-index: 2600;
  display: flex;
  flex-direction: column;
  width: min(53.75rem, calc(100vw - 2rem));
  height: min(84vh, 42.5rem);
  min-width: min(27.5rem, calc(100vw - 1rem));
  min-height: min(20rem, calc(100vh - 1rem));
  max-width: calc(100vw - 1rem);
  max-height: calc(100vh - 1rem);
  overflow: hidden;
  border: 1px solid rgba(22, 30, 48, 0.45);
  border-radius: 0.35rem;
  background: #f7f8fb;
  color: #18202f;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.34);
}

.fleet-chart-detail-window__titlebar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid rgba(22, 30, 48, 0.18);
  border-radius: 0.35rem 0.35rem 0 0;
  background: #273247;
  color: #fff;
  cursor: move;
  touch-action: none;
  user-select: none;
}

.fleet-chart-detail-window__title {
  font-weight: 700;
  line-height: 1.2;
}

.fleet-chart-detail-window__subtitle {
  margin-top: 0.15rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.82rem;
  line-height: 1.25;
}

.fleet-chart-detail-window__close {
  flex: 0 0 auto;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0.2rem;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
}

.fleet-chart-detail-window__close:hover,
.fleet-chart-detail-window__close:focus {
  background: #b4232e;
}

.fleet-chart-detail-window__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem 1.1rem 1.15rem 0.95rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.fleet-chart-detail-window__resize-handle {
  position: absolute;
  right: 0.25rem;
  bottom: 0.25rem;
  width: 1.15rem;
  height: 1.15rem;
  cursor: nwse-resize;
  touch-action: none;
}

.fleet-chart-detail-window__resize-handle::after {
  position: absolute;
  right: 0.15rem;
  bottom: 0.15rem;
  width: 0.65rem;
  height: 0.65rem;
  border-right: 2px solid rgba(24, 32, 47, 0.62);
  border-bottom: 2px solid rgba(24, 32, 47, 0.62);
  content: '';
}

.fleet-chart-detail-window .fleet-chart-tooltip-line--title {
  color: #0b1830;
}

.fleet-chart-detail-window .fleet-chart-tooltip-line--section {
  color: #24344f;
}

.fleet-chart-detail-window .fleet-chart-tooltip-line--item {
  color: #111827;
}

.fleet-chart-detail-window--dark {
  border-color: rgba(233, 235, 240, 0.22);
  background: #10151f;
  color: #eef1f6;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.58);
}

.fleet-chart-detail-window--dark .fleet-chart-detail-window__titlebar {
  border-bottom-color: rgba(233, 235, 240, 0.16);
  background: #202637;
}

.fleet-chart-detail-window--dark .fleet-chart-detail-window__body {
  color: #f2f5fb;
}

.fleet-chart-detail-window--dark .fleet-chart-detail-window__resize-handle::after {
  border-right-color: rgba(242, 245, 251, 0.72);
  border-bottom-color: rgba(242, 245, 251, 0.72);
}

.fleet-chart-detail-window--dark .fleet-chart-tooltip-line--title {
  color: #ffffff;
}

.fleet-chart-detail-window--dark .fleet-chart-tooltip-line--section {
  color: #d7deea;
}

.fleet-chart-detail-window--dark .fleet-chart-tooltip-line--item {
  color: #f2f5fb;
}

.fleet-activity-summary--dark .fleet-session-summary-strip,
.fleet-activity-summary--dark .fleet-summary-panel,
.fleet-activity-summary--dark .fleet-summary-filters {
  border-color: rgba(233, 235, 240, 0.16);
  background: rgba(255, 255, 255, 0.04);
}

.fleet-activity-summary--dark .fleet-ignored-category-list {
  border-color: rgba(233, 235, 240, 0.16);
  background: rgba(255, 255, 255, 0.04);
}

.fleet-activity-summary--dark .fleet-session-summary-value {
  color: #eef1f6;
}

.fleet-activity-summary--dark .fleet-session-summary-value--secondary {
  color: #c5ccd8;
}

@media (max-width: 575.98px) {
  .fleet-session-summary-strip {
    align-items: flex-start;
    flex-direction: column;
  }

  .fleet-session-summary-help {
    text-align: left;
  }
}
</style>
