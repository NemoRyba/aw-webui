<template lang="pug">
div(:class="{ 'fleet-devices--dark': activeTheme === 'dark' }")
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Devices') }}
      div.text-muted.small
        | {{ $tr('Devices grouped across all reported sessions') }}
    b-button.ml-auto(size="sm" variant="outline-dark" @click="refresh")
      | {{ $tr('Refresh') }}

  b-card
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Devices') }}
      div.ml-auto.d-flex.align-items-center
        b-form-select.mr-2(
          size="sm"
          v-model="metricsWindowHours"
          :options="metricsWindowOptions"
          @change="loadMetrics"
        )
        column-order-editor(
          :table-key="tableKey"
          :fields="defaultFields"
        )
    b-table(
      small
      hover
      responsive="lg"
      :items="devices"
      :fields="fields"
      :empty-text="$tr('No devices found')"
    )
      template(v-slot:cell(device_name)="data")
        router-link(:to="'/fleet/devices/' + data.item.device_id")
          | {{ data.item.device_name || data.item.device_id }}
      template(v-slot:cell(status)="data")
        b-badge(:variant="stateVariant(data.item.status)")
          | {{ $tr(data.item.status) }}
      template(v-slot:cell(users)="data")
        | {{ data.item.users.length ? data.item.users.join(', ') : '—' }}
      template(v-slot:cell(system_load)="data")
        div.fleet-system-load(v-if="deviceMetric(data.item.device_id)")
          div.fleet-system-load-row(:title="metricTitle(data.item.device_id, 'CPU')")
            span.fleet-system-load-label CPU
            svg.fleet-system-sparkline(viewBox="0 0 120 28" preserveAspectRatio="none")
              line(x1="0" y1="14" x2="120" y2="14")
              polyline(:points="sparklinePoints(data.item.device_id, 'cpu_percent')")
            span.fleet-system-load-value {{ percentLabel(deviceMetric(data.item.device_id).latest_cpu_percent) }}
          div.fleet-system-load-row(:title="metricTitle(data.item.device_id, 'RAM')")
            span.fleet-system-load-label RAM
            svg.fleet-system-sparkline.fleet-system-sparkline--memory(viewBox="0 0 120 28" preserveAspectRatio="none")
              line(x1="0" y1="14" x2="120" y2="14")
              polyline(:points="sparklinePoints(data.item.device_id, 'memory_percent')")
            span.fleet-system-load-value {{ percentLabel(deviceMetric(data.item.device_id).latest_memory_percent) }}
        div.text-muted.small(v-else)
          span(v-if="metricsLoading") {{ $tr('Loading') }}
          span(v-else) {{ $tr('No metrics') }}
      template(v-slot:cell(last_seen)="data")
        span(v-if="data.item.last_seen") {{ data.item.last_seen | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import moment from 'moment';

import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';
import { detectPreferredTheme } from '~/util/theme';

export default {
  name: 'FleetDevices',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      tableKey: 'fleet-devices-list',
      metricsLoading: false,
      metricsWindowHours: 2,
      metricsWindowOptions: [
        { value: 1, text: this.$tr('Last hour') },
        { value: 2, text: this.$tr('Last 2 hours') },
        { value: 4, text: this.$tr('Last 4 hours') },
        { value: 24, text: this.$tr('Last 24 hours') },
      ],
    };
  },
  computed: {
    defaultFields() {
      return [
        { key: 'device_name', label: this.$tr('Device'), sortable: true },
        { key: 'status', label: this.$tr('Status'), sortable: true },
        { key: 'users', label: this.$tr('Users') },
        { key: 'session_count', label: this.$tr('Sessions'), sortable: true },
        { key: 'system_load', label: this.$tr('System load') },
        { key: 'last_seen', label: this.$tr('Last seen'), sortable: true },
      ];
    },
    fields() {
      return orderFields(this.defaultFields, this.settingsStore.columnOrdersData?.[this.tableKey]);
    },
    devices() {
      return this.fleetStore.devices;
    },
    metricsByDevice() {
      const map = {};
      for (const device of this.fleetStore.deviceMetrics?.devices || []) {
        map[device.device_id] = device;
      }
      return map;
    },
    activeTheme() {
      const theme = this.settingsStore.theme || 'auto';
      return theme === 'auto' ? detectPreferredTheme() : theme;
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      await this.fleetStore.loadDevices();
      await this.loadMetrics();
    },
    async loadMetrics() {
      this.metricsLoading = true;
      try {
        const end = moment();
        const start = end.clone().subtract(Number(this.metricsWindowHours || 2), 'hours');
        const params: any = {
          start: start.toISOString(),
          end: end.toISOString(),
          max_points: 120,
        };
        const deviceIds = this.devices.map(device => device.device_id).filter(Boolean);
        if (deviceIds.length) {
          params.device_ids = deviceIds.join(',');
        }
        await this.fleetStore.loadDeviceMetrics(params);
      } finally {
        this.metricsLoading = false;
      }
    },
    stateVariant(state) {
      return state === 'online' ? 'success' : 'secondary';
    },
    deviceMetric(deviceId) {
      return this.metricsByDevice[deviceId] || null;
    },
    percentLabel(value) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '—';
      }
      return `${Math.round(Number(value))}%`;
    },
    formatBytes(bytes) {
      const value = Number(bytes || 0);
      if (!value) {
        return '—';
      }
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
      const scaled = value / 1024 ** exponent;
      return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    },
    metricTitle(deviceId, label) {
      const metric = this.deviceMetric(deviceId);
      if (!metric) {
        return this.$tr('No metrics');
      }
      const latest = label === 'CPU' ? metric.latest_cpu_percent : metric.latest_memory_percent;
      const lines = [`${label}: ${this.percentLabel(latest)}`];
      if (label === 'RAM' && metric.latest_memory_used_bytes && metric.latest_memory_total_bytes) {
        lines.push(
          `${this.$tr('Memory')}: ${this.formatBytes(
            metric.latest_memory_used_bytes
          )} / ${this.formatBytes(metric.latest_memory_total_bytes)}`
        );
      }
      if (metric.last_updated) {
        lines.push(
          `${this.$tr('Last seen')}: ${moment(metric.last_updated).format('YYYY-MM-DD HH:mm:ss')}`
        );
      }
      return lines.join('\n');
    },
    sparklinePoints(deviceId, field) {
      const metric = this.deviceMetric(deviceId);
      const samples = (metric?.samples || []).filter(
        sample => sample[field] !== null && sample[field] !== undefined
      );
      if (samples.length === 0) {
        return '';
      }

      if (samples.length === 1) {
        const y = this.sparklineY(samples[0][field]);
        return `0,${y} 120,${y}`;
      }

      return samples
        .map((sample, index) => {
          const x = (index / (samples.length - 1)) * 120;
          return `${x.toFixed(1)},${this.sparklineY(sample[field])}`;
        })
        .join(' ');
    },
    sparklineY(value) {
      const percent = Math.max(0, Math.min(100, Number(value || 0)));
      return (26 - (percent / 100) * 24).toFixed(1);
    },
  },
};
</script>

<style lang="scss" scoped>
.fleet-system-load {
  min-width: 18rem;
}

.fleet-system-load-row {
  display: grid;
  grid-template-columns: 2.4rem minmax(7rem, 1fr) 3rem;
  align-items: center;
  gap: 0.5rem;
  margin: 0.1rem 0;
}

.fleet-system-load-label,
.fleet-system-load-value {
  font-size: 0.78rem;
  line-height: 1;
  color: #6c757d;
  font-variant-numeric: tabular-nums;
}

.fleet-system-load-value {
  text-align: right;
}

.fleet-system-sparkline {
  width: 100%;
  height: 1.65rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.035);
}

.fleet-system-sparkline line {
  stroke: rgba(127, 127, 127, 0.22);
  stroke-width: 1;
}

.fleet-system-sparkline polyline {
  fill: none;
  stroke: #1682d4;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fleet-system-sparkline--memory polyline {
  stroke: #8d57d8;
}

.fleet-devices--dark .fleet-system-sparkline {
  background: rgba(255, 255, 255, 0.06);
}

.fleet-devices--dark .fleet-system-load-label,
.fleet-devices--dark .fleet-system-load-value {
  color: #b9c1cf;
}
</style>
