<template lang="pug">
div.fleet-system-metrics(:class="{ 'fleet-system-metrics--dark': activeTheme === 'dark', 'fleet-system-metrics--compact': compact }")
  div.fleet-system-metrics-toolbar
    b-form-checkbox(v-if="showToggle" v-model="visible" switch size="sm")
      | {{ $tr('Show system load') }}
    span.fleet-system-metrics-title(v-else)
      | {{ $tr('System load') }}
    b-button(
      v-if="visible"
      size="sm"
      variant="outline-secondary"
      :disabled="loading || !canLoad"
      @click="loadMetrics"
    )
      | {{ $tr('Refresh') }}
    span.small.text-muted(v-if="visible && loading") {{ $tr('Loading...') }}

  div(v-if="visible")
    b-alert(v-if="error" show variant="danger")
      | {{ error }}
    div.text-muted.small(v-else-if="!canLoad")
      | {{ $tr('No devices selected') }}
    div.text-muted.small(v-else-if="!loading && !hasMetrics")
      | {{ $tr('No system metrics found for this range') }}
    div.fleet-system-metrics-list(v-else)
      div.fleet-system-metrics-device(
        v-for="device in metricDevices"
        :key="device.device_id"
      )
        div.fleet-system-metrics-device-header
          div
            strong {{ device.device_name || device.device_id }}
            div.text-muted.small(v-if="device.last_updated")
              | {{ $tr('Latest') }} {{ formatTimestamp(device.last_updated) }}
          div.fleet-system-metrics-latest
            span
              span.fleet-system-metrics-dot.fleet-system-metrics-dot--cpu
              | CPU {{ percentLabel(device.latest_cpu_percent) }}
            span
              span.fleet-system-metrics-dot.fleet-system-metrics-dot--memory
              | RAM {{ percentLabel(device.latest_memory_percent) }}

        div.fleet-system-wave-shell
          div.fleet-system-wave-y-axis
            div.fleet-system-wave-y-label.fleet-system-wave-y-label--top 100%
            div.fleet-system-wave-y-label.fleet-system-wave-y-label--mid 50%
            div.fleet-system-wave-y-label.fleet-system-wave-y-label--bottom 0%
          div.fleet-system-wave-scroll
            div.fleet-system-wave-canvas(:style="{ minWidth: metricsChartMinWidth }")
              svg.fleet-system-wave(viewBox="0 0 1000 128" preserveAspectRatio="none")
                line(
                  v-for="gridLine in yGridLines"
                  :key="'grid-' + gridLine.value"
                  x1="0"
                  x2="1000"
                  :y1="gridLine.y"
                  :y2="gridLine.y"
                )
                polyline.fleet-system-wave-line.fleet-system-wave-line--cpu(
                  v-if="metricPoints(device, 'cpu_percent')"
                  :points="metricPoints(device, 'cpu_percent')"
                  :style="{ stroke: deviceColor(device.device_id, 0) }"
                )
                  title {{ metricTitle(device, 'CPU', 'cpu_percent') }}
                polyline.fleet-system-wave-line.fleet-system-wave-line--memory(
                  v-if="metricPoints(device, 'memory_percent')"
                  :points="metricPoints(device, 'memory_percent')"
                  :style="{ stroke: deviceColor(device.device_id, 1) }"
                )
                  title {{ metricTitle(device, 'RAM', 'memory_percent') }}
              div.fleet-system-wave-x-axis
                span(
                  v-for="tick in xTicks"
                  :key="tick.value"
                  :style="{ left: tick.left }"
                ) {{ tick.label }}
</template>

<script lang="ts">
import moment from 'moment';

import { getClient } from '~/util/awclient';
import { getColorFromString } from '~/util/color';
import { detectPreferredTheme } from '~/util/theme';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'FleetSystemMetricsWave',
  props: {
    deviceIds: {
      type: Array,
      default: () => [],
    },
    start: {
      type: [String, Date, Object],
      required: true,
    },
    end: {
      type: [String, Date, Object],
      required: true,
    },
    defaultVisible: {
      type: Boolean,
      default: false,
    },
    showToggle: {
      type: Boolean,
      default: true,
    },
    compact: {
      type: Boolean,
      default: false,
    },
    maxPoints: {
      type: Number,
      default: 360,
    },
    // Optional synced visible window (e.g. from the watcher timeline).
    // When set, the x axis renders exactly this window instead of the full
    // range and the internal horizontal scrollbar is disabled — panning and
    // zooming are then driven by the companion timeline. The y (%) axis is
    // unaffected.
    windowStart: {
      type: [String, Date, Object],
      default: null,
    },
    windowEnd: {
      type: [String, Date, Object],
      default: null,
    },
  },
  data() {
    return {
      settingsStore: useSettingsStore(),
      visible: Boolean(this.defaultVisible),
      loading: false,
      error: '',
      metrics: null,
      requestId: 0,
    };
  },
  computed: {
    activeTheme() {
      const theme = this.settingsStore.theme || 'auto';
      return theme === 'auto' ? detectPreferredTheme() : theme;
    },
    metricDeviceIds() {
      return (this.deviceIds || []).map(value => String(value || '').trim()).filter(Boolean);
    },
    rangeStart() {
      return moment(this.start);
    },
    rangeEnd() {
      return moment(this.end);
    },
    canLoad() {
      return (
        this.metricDeviceIds.length > 0 &&
        this.rangeStart.isValid() &&
        this.rangeEnd.isValid() &&
        this.rangeEnd.isAfter(this.rangeStart)
      );
    },
    hasSyncedWindow() {
      if (!this.windowStart || !this.windowEnd) {
        return false;
      }
      const start = moment(this.windowStart);
      const end = moment(this.windowEnd);
      return start.isValid() && end.isValid() && end.isAfter(start);
    },
    domainStart() {
      return this.hasSyncedWindow ? moment(this.windowStart) : this.rangeStart;
    },
    domainEnd() {
      return this.hasSyncedWindow ? moment(this.windowEnd) : this.rangeEnd;
    },
    queryKey() {
      return [
        this.metricDeviceIds.join('|'),
        this.rangeStart.isValid() ? this.rangeStart.format() : '',
        this.rangeEnd.isValid() ? this.rangeEnd.format() : '',
        Number(this.maxPoints || 360),
      ].join('::');
    },
    metricDevices() {
      return (this.metrics?.devices || []).filter(device => {
        return (device.samples || []).some(sample => {
          return (
            this.sampleValue(sample, 'cpu_percent') !== null ||
            this.sampleValue(sample, 'memory_percent') !== null
          );
        });
      });
    },
    hasMetrics() {
      return this.metricDevices.length > 0;
    },
    metricsChartMinWidth() {
      if (!this.canLoad || this.hasSyncedWindow) {
        // Synced with the timeline: it drives panning/zooming, so the wave
        // must not scroll on its own.
        return '100%';
      }

      const hours = Math.max(1, this.rangeEnd.diff(this.rangeStart, 'hours', true));
      const days = hours / 24;
      let width;

      if (days <= 3.1) {
        width = hours * (this.compact ? 38 : 52);
      } else if (days <= 45) {
        width = days * (this.compact ? 78 : 96);
      } else if (days <= 370) {
        width = days * (this.compact ? 18 : 24);
      } else {
        width = days * (this.compact ? 8 : 10);
      }

      return `${Math.max(this.compact ? 1020 : 1260, Math.min(width, 14000))}px`;
    },
    xTicks() {
      if (!this.canLoad) {
        return [];
      }

      const ticks = [];
      const startMs = this.domainStart.valueOf();
      const endMs = this.domainEnd.valueOf();
      const span = Math.max(1, endMs - startMs);
      const tickCount = 5;

      for (let index = 0; index < tickCount; index += 1) {
        const ratio = index / (tickCount - 1);
        const value = startMs + span * ratio;
        ticks.push({
          value,
          left: `${ratio * 100}%`,
          label: this.formatAxisTimestamp(value),
        });
      }
      return ticks;
    },
    yGridLines() {
      return [0, 50, 100].map(value => ({
        value,
        y: this.yForPercent(value),
      }));
    },
  },
  watch: {
    visible(value) {
      if (value) {
        this.loadMetrics();
      }
    },
    queryKey() {
      if (this.visible) {
        this.loadMetrics();
      }
    },
  },
  mounted() {
    if (this.visible) {
      this.loadMetrics();
    }
  },
  methods: {
    async loadMetrics() {
      if (!this.canLoad) {
        this.metrics = null;
        return false;
      }

      const requestId = this.requestId + 1;
      this.requestId = requestId;
      this.loading = true;
      this.error = '';

      try {
        const response = await getClient().req.get('/0/fleet/devices/metrics', {
          params: {
            start: this.rangeStart.format(),
            end: this.rangeEnd.format(),
            device_ids: this.metricDeviceIds.join(','),
            max_points: Math.max(20, Math.min(720, Number(this.maxPoints || 360))),
          },
        });

        if (requestId === this.requestId) {
          this.metrics = response.data;
        }
        return true;
      } catch (error) {
        console.error('Unable to load system metrics:', error);
        if (requestId === this.requestId) {
          this.error = this.$tr('Unable to load system metrics');
          this.metrics = null;
        }
        return false;
      } finally {
        if (requestId === this.requestId) {
          this.loading = false;
        }
      }
    },
    sampleValue(sample, field) {
      const value = sample?.[field];
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    },
    metricPoints(device, field) {
      if (!this.canLoad) {
        return '';
      }

      const startMs = this.domainStart.valueOf();
      const endMs = this.domainEnd.valueOf();
      const pad = Math.max(1, endMs - startMs) * 0.02;
      const points = (device.samples || [])
        .map(sample => {
          const value = this.sampleValue(sample, field);
          const timestamp = moment(sample.timestamp);
          if (value === null || !timestamp.isValid()) {
            return null;
          }
          const ms = timestamp.valueOf();
          // Keep one padding step beyond each edge so lines run to the border
          // without piling clamped points on it.
          if (ms < startMs - pad || ms > endMs + pad) {
            return null;
          }
          return {
            x: this.xForTimestamp(ms),
            y: this.yForPercent(value),
          };
        })
        .filter(Boolean);

      if (points.length === 0) {
        return '';
      }
      if (points.length === 1) {
        const point: any = points[0];
        return `${Math.max(0, point.x - 8).toFixed(1)},${point.y} ${Math.min(
          1000,
          point.x + 8
        ).toFixed(1)},${point.y}`;
      }

      return points.map((point: any) => `${point.x.toFixed(1)},${point.y}`).join(' ');
    },
    xForTimestamp(timestamp) {
      const startMs = this.domainStart.valueOf();
      const endMs = this.domainEnd.valueOf();
      const ratio = (Number(timestamp || 0) - startMs) / Math.max(1, endMs - startMs);
      return Math.max(0, Math.min(1000, ratio * 1000));
    },
    yForPercent(value) {
      const percent = Math.max(0, Math.min(100, Number(value || 0)));
      return (116 - (percent / 100) * 104).toFixed(1);
    },
    percentLabel(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return '-';
      }
      return `${Math.round(numeric)}%`;
    },
    metricTitle(device, label, field) {
      const latest =
        field === 'cpu_percent' ? device.latest_cpu_percent : device.latest_memory_percent;
      const lines = [`${label}: ${this.percentLabel(latest)}`];
      if (
        field === 'memory_percent' &&
        device.latest_memory_used_bytes &&
        device.latest_memory_total_bytes
      ) {
        lines.push(
          `${this.$tr('Memory')}: ${this.formatBytes(
            device.latest_memory_used_bytes
          )} / ${this.formatBytes(device.latest_memory_total_bytes)}`
        );
      }
      if (device.last_updated) {
        lines.push(`${this.$tr('Latest')}: ${this.formatTimestamp(device.last_updated)}`);
      }
      return lines.join('\n');
    },
    formatBytes(bytes) {
      const value = Number(bytes || 0);
      if (!value) {
        return '-';
      }
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
      const scaled = value / 1024 ** exponent;
      return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    },
    formatTimestamp(value) {
      const timestamp = moment(value);
      if (!timestamp.isValid()) {
        return '-';
      }
      return timestamp.format('YYYY-MM-DD HH:mm:ss');
    },
    formatAxisTimestamp(value) {
      const timestamp = moment(value);
      const hours = this.domainEnd.diff(this.domainStart, 'hours', true);
      if (hours <= 30) {
        return timestamp.format('HH:mm');
      }
      if (hours <= 96) {
        return timestamp.format('MMM D HH:mm');
      }
      return timestamp.format('MMM D');
    },
    deviceColor(deviceId, offset = 0) {
      if (offset === 0) {
        return getColorFromString(`cpu-${deviceId}`);
      }
      return getColorFromString(`ram-${deviceId}`);
    },
  },
};
</script>

<style scoped lang="scss">
.fleet-system-metrics {
  min-width: 0;
}

.fleet-system-metrics-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.65rem;
}

.fleet-system-metrics-title {
  color: #273247;
  font-weight: 600;
}

.fleet-system-metrics-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

.fleet-system-metrics-device {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 0.45rem;
  background: rgba(127, 127, 127, 0.05);
}

.fleet-system-metrics-device-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.fleet-system-metrics-latest {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  color: #5b6472;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.fleet-system-metrics-dot {
  display: inline-block;
  width: 0.62rem;
  height: 0.62rem;
  margin-right: 0.25rem;
  border-radius: 50%;
}

.fleet-system-metrics-dot--cpu {
  background: #1682d4;
}

.fleet-system-metrics-dot--memory {
  background: #8d57d8;
}

.fleet-system-wave-shell {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.fleet-system-wave-y-axis {
  position: relative;
  flex: 0 0 2.6rem;
  height: 12.5rem;
  user-select: none;
}

.fleet-system-wave-scroll {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.35rem;
}

.fleet-system-wave-canvas {
  position: relative;
  height: 12.5rem;
  padding-bottom: 1.45rem;
}

.fleet-system-metrics--compact .fleet-system-wave-y-axis,
.fleet-system-metrics--compact .fleet-system-wave-canvas {
  height: 9.2rem;
}

.fleet-system-wave {
  width: 100%;
  height: 100%;
  border-radius: 0.35rem;
  background: rgba(0, 0, 0, 0.035);
}

.fleet-system-wave line {
  stroke: rgba(127, 127, 127, 0.22);
  stroke-width: 1;
}

.fleet-system-wave-line {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fleet-system-wave-line--memory {
  stroke-dasharray: 7 5;
}

.fleet-system-wave-y-label {
  position: absolute;
  right: 0.45rem;
  color: #6c757d;
  font-size: 0.72rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.fleet-system-wave-y-label--top {
  top: 0.35rem;
}

.fleet-system-wave-y-label--mid {
  top: calc(50% - 0.9rem);
}

.fleet-system-wave-y-label--bottom {
  bottom: 1.7rem;
}

.fleet-system-wave-x-axis {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1.2rem;
  color: #6c757d;
  font-size: 0.72rem;
  line-height: 1;
}

.fleet-system-wave-x-axis span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

.fleet-system-wave-x-axis span:first-child {
  transform: translateX(0);
}

.fleet-system-wave-x-axis span:last-child {
  transform: translateX(-100%);
}

.fleet-system-metrics--dark .fleet-system-metrics-device {
  border-color: rgba(233, 235, 240, 0.16);
  background: rgba(255, 255, 255, 0.04);
}

.fleet-system-metrics--dark .fleet-system-wave {
  background: rgba(255, 255, 255, 0.06);
}

.fleet-system-metrics--dark .fleet-system-metrics-latest,
.fleet-system-metrics--dark .fleet-system-metrics-title,
.fleet-system-metrics--dark .fleet-system-wave-y-label,
.fleet-system-metrics--dark .fleet-system-wave-x-axis {
  color: #b9c1cf;
}
</style>
