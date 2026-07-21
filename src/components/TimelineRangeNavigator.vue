<template lang="pug">
div.timeline-range-navigator
  div.timeline-range-toolbar
    div.timeline-range-control
      label {{ $tr('Range') }}
      b-button-group(size="sm")
        b-button(:variant="activePreset === 'last' ? 'primary' : 'outline-secondary'" @click="applyLast")
          icon(name="sync")
          span.ml-1 {{ $tr('Last') }}
        b-button(:variant="activePreset === 'today' ? 'primary' : 'outline-secondary'" @click="applyPreset('today')")
          | {{ $tr('Today') }}
        b-button(:variant="activePreset === 'week' ? 'primary' : 'outline-secondary'" @click="applyPreset('week')")
          | {{ $tr('Week') }}
        b-button(:variant="activePreset === 'month' ? 'primary' : 'outline-secondary'" @click="applyPreset('month')")
          | {{ $tr('Month') }}
        b-button(:variant="activePreset === 'year' ? 'primary' : 'outline-secondary'" @click="applyPreset('year')")
          | {{ $tr('Year') }}

    div.timeline-range-control
      label(for="timeline-range-start") {{ $tr('Start') }}
      input#timeline-range-start.form-control.form-control-sm(type="date" v-model="customStartDate")

    div.timeline-range-control
      label(for="timeline-range-end") {{ $tr('End') }}
      input#timeline-range-end.form-control.form-control-sm(type="date" v-model="customEndDate")

    div.timeline-range-control.timeline-range-actions
      label &nbsp;
      b-button-group(size="sm")
        b-button(variant="outline-secondary" :title="$tr('Previous range')" @click="shiftRange(-1)" :disabled="!value")
          icon(name="arrow-left")
        b-button(variant="primary" @click="applyCustomRange" :disabled="invalidCustomRange")
          | {{ $tr('Apply') }}
        b-button(variant="outline-secondary" :title="$tr('Next range')" @click="shiftRange(1)" :disabled="!value")
          icon(name="arrow-right")

    div.timeline-range-summary
      div.timeline-range-summary__label {{ rangeLabel }}
      div.timeline-range-summary__duration(v-if="durationLabel") {{ durationLabel }}

  div.timeline-range-last(v-show="mode === 'last'")
    input-timeinterval(
      v-model="rollingRange"
      :defaultDuration="defaultDuration"
      :maxDuration="maxDuration"
    )

  div.timeline-zoom-toolbar(v-if="value")
    span.timeline-zoom-toolbar__label {{ $tr('Zoom') }}
    b-button-group(size="sm")
      b-button(variant="outline-secondary" :title="$tr('Full range')" @click="showFullRange")
        icon(name="compress-arrows-alt")
        span.ml-1 {{ $tr('Full') }}
      b-button(variant="outline-secondary" @click="focusUnit('day')")
        | {{ $tr('Day') }}
      b-button(variant="outline-secondary" @click="focusUnit('week')")
        | {{ $tr('Week') }}
      b-button(variant="outline-secondary" @click="focusUnit('month')")
        | {{ $tr('Month') }}

  div.timeline-density(v-if="densityBars.length > 0")
    div.timeline-density__header
      span {{ $tr('Activity density') }}
      span {{ densityUnitLabel }}
    div.timeline-density__track
      button.timeline-density__bar(
        v-for="bar in densityBars"
        :key="bar.key"
        type="button"
        :class="{'timeline-density__bar--empty': bar.count === 0, 'timeline-density__bar--focused': bar.key === focusedBinKey}"
        :style="{ height: bar.height + '%', opacity: bar.opacity }"
        :title="bar.title"
        @click="focusDensityBar(bar)"
      )
</template>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/compress-arrows-alt';

export default {
  name: 'TimelineRangeNavigator',
  props: {
    value: { type: Array },
    defaultDuration: { type: Number, default: 60 * 60 },
    maxDuration: { type: Number, default: null },
    eventCountsByDay: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      mode: 'last',
      activePreset: 'last',
      customStartDate: '',
      customEndDate: '',
      rollingRange: null,
      focusedBinKey: null,
    };
  },
  computed: {
    invalidCustomRange() {
      if (!this.customStartDate || !this.customEndDate) {
        return true;
      }
      return moment(this.customStartDate).isAfter(moment(this.customEndDate), 'day');
    },
    rangeLabel() {
      if (!this.value) {
        return '';
      }

      const start = moment(this.value[0]);
      const end = moment(this.value[1]);
      const endForDisplay = end.clone().subtract(1, 'millisecond');

      if (start.isSame(endForDisplay, 'day')) {
        return start.format('MMM D, YYYY');
      }
      return `${start.format('MMM D, YYYY')} - ${endForDisplay.format('MMM D, YYYY')}`;
    },
    durationLabel() {
      if (!this.value) {
        return '';
      }

      const seconds = moment(this.value[1]).diff(moment(this.value[0]), 'seconds');
      if (seconds < 60 * 60 * 36) {
        return `${Math.max(1, Math.round(seconds / 3600))}h`;
      }
      if (seconds < 60 * 60 * 24 * 90) {
        return `${Math.max(1, Math.round(seconds / (60 * 60 * 24)))}d`;
      }
      return `${Math.max(1, Math.round(seconds / (60 * 60 * 24 * 30)))}mo`;
    },
    densityUnit() {
      if (!this.value) {
        return 'day';
      }

      const days = moment(this.value[1]).diff(moment(this.value[0]), 'days', true);
      if (days > 730) {
        return 'month';
      }
      if (days > 120) {
        return 'week';
      }
      return 'day';
    },
    densityUnitLabel() {
      const labels = {
        day: this.$tr('Days'),
        week: this.$tr('Weeks'),
        month: this.$tr('Months'),
      };
      return labels[this.densityUnit] || labels.day;
    },
    densityBars() {
      if (!this.value) {
        return [];
      }

      const rangeStart = moment(this.value[0]);
      const rangeEnd = moment(this.value[1]);
      const rangeStartDay = rangeStart.clone().startOf('day');
      const rangeEndDay = rangeEnd.clone().subtract(1, 'millisecond').startOf('day');
      const unit = this.densityUnit;
      const countsByBin = {};

      Object.entries(this.eventCountsByDay || {}).forEach(([day, count]) => {
        const date = moment(day);
        if (!date.isValid() || date.isBefore(rangeStartDay) || date.isAfter(rangeEndDay)) {
          return;
        }

        const key = this.binStart(date, unit).format('YYYY-MM-DD');
        countsByBin[key] = (countsByBin[key] || 0) + Number(count || 0);
      });

      const bins = [];
      let cursor = this.binStart(rangeStart, unit);

      while (cursor.isBefore(rangeEnd) && bins.length < 240) {
        const start = cursor.clone();
        const next = this.addUnit(start, unit, 1);
        const end = moment.min(next, rangeEnd);
        const key = start.format('YYYY-MM-DD');
        const count = countsByBin[key] || 0;
        bins.push({ key, start, end, count });
        cursor = next;
      }

      const maxCount = Math.max(1, ...bins.map(bin => bin.count));
      return bins.map(bin => {
        const label =
          unit === 'day'
            ? bin.start.format('MMM D, YYYY')
            : `${bin.start.format('MMM D, YYYY')} - ${bin.end
                .clone()
                .subtract(1, 'day')
                .format('MMM D, YYYY')}`;
        return {
          ...bin,
          height: bin.count === 0 ? 8 : Math.max(14, Math.round((bin.count / maxCount) * 100)),
          opacity: bin.count === 0 ? 0.35 : 1,
          title: `${label}: ${bin.count} ${this.$tr('events')}`,
        };
      });
    },
    latestEventDay() {
      const dates = Object.keys(this.eventCountsByDay || {}).filter(
        day => this.eventCountsByDay[day] > 0
      );
      if (dates.length === 0) {
        return null;
      }
      return moment(dates.sort().slice(-1)[0]);
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(newRange) {
        this.syncDatesFromValue(newRange);
      },
    },
    rollingRange(newRange) {
      if (!newRange) {
        return;
      }
      this.mode = 'last';
      this.activePreset = 'last';
      this.focusedBinKey = null;
      this.$emit('input', newRange);
      this.$emit('focus-range', null);
    },
  },
  methods: {
    syncDatesFromValue(range) {
      if (!range) {
        return;
      }

      this.customStartDate = moment(range[0]).format('YYYY-MM-DD');
      this.customEndDate = moment(range[1]).clone().subtract(1, 'millisecond').format('YYYY-MM-DD');
    },
    emitRange(start, end, preset) {
      this.mode = preset === 'last' ? 'last' : 'range';
      this.activePreset = preset;
      this.focusedBinKey = null;
      this.customStartDate = start.format('YYYY-MM-DD');
      this.customEndDate = end.clone().subtract(1, 'millisecond').format('YYYY-MM-DD');
      this.$emit('input', [start, end]);
      this.$emit('focus-range', null);
    },
    applyLast() {
      this.mode = 'last';
      this.activePreset = 'last';
      if (this.rollingRange) {
        this.$emit('input', this.rollingRange);
        this.$emit('focus-range', null);
      }
    },
    applyPreset(preset) {
      const now = moment();
      let start;
      const end = now.clone();

      if (preset === 'today') {
        start = now.clone().startOf('day');
      } else if (preset === 'week') {
        start = now.clone().startOf('isoWeek');
      } else if (preset === 'month') {
        start = now.clone().startOf('month');
      } else if (preset === 'year') {
        start = now.clone().startOf('year');
      }

      if (!start) {
        return;
      }
      this.emitRange(start, end, preset);
    },
    applyCustomRange() {
      if (this.invalidCustomRange) {
        return;
      }
      const start = moment(this.customStartDate).startOf('day');
      const end = moment(this.customEndDate).endOf('day');
      this.emitRange(start, end, 'custom');
    },
    shiftRange(direction) {
      if (!this.value) {
        return;
      }

      const currentStart = moment(this.value[0]);
      const currentEnd = moment(this.value[1]);
      const unit = ['today', 'day'].includes(this.activePreset)
        ? 'day'
        : ['week'].includes(this.activePreset)
        ? 'week'
        : ['month'].includes(this.activePreset)
        ? 'month'
        : ['year'].includes(this.activePreset)
        ? 'year'
        : null;

      let start;
      let end;
      if (unit) {
        start = this.addUnit(currentStart, unit, direction);
        end = this.addUnit(currentEnd, unit, direction);
      } else {
        const duration = currentEnd.diff(currentStart, 'milliseconds');
        start = currentStart.clone().add(duration * direction, 'milliseconds');
        end = currentEnd.clone().add(duration * direction, 'milliseconds');
      }
      this.emitRange(start, end, this.activePreset === 'last' ? 'custom' : this.activePreset);
    },
    showFullRange() {
      this.focusedBinKey = null;
      this.$emit('focus-range', null);
    },
    focusUnit(unit) {
      if (!this.value) {
        return;
      }

      const anchor = this.latestEventDay || moment(this.value[0]);
      const start = this.binStart(anchor, unit);
      const end = this.addUnit(start, unit, 1);
      this.focusWindow(start, end, start.format('YYYY-MM-DD'));
    },
    focusDensityBar(bar) {
      this.focusWindow(bar.start, bar.end, bar.key);
    },
    focusWindow(startValue, endValue, key) {
      const rangeStart = moment(this.value[0]);
      const rangeEnd = moment(this.value[1]);
      const start = moment.max(moment(startValue), rangeStart);
      const end = moment.min(moment(endValue), rangeEnd);

      if (!end.isAfter(start)) {
        return;
      }

      this.focusedBinKey = key;
      this.$emit('focus-range', [start, end]);
    },
    binStart(date, unit) {
      if (unit === 'week') {
        return moment(date).startOf('isoWeek');
      }
      return moment(date).startOf(unit);
    },
    addUnit(date, unit, count) {
      if (unit === 'week') {
        return moment(date).add(count, 'weeks');
      }
      return moment(date).add(count, unit);
    },
  },
};
</script>

<style scoped lang="scss">
@import '../style/globals';

.timeline-range-navigator {
  padding: 0.85rem;
  border: 1px solid $lightBorderColor;
  border-radius: 0.5rem;
  background: #fff;
}

.timeline-range-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.timeline-range-control {
  label {
    display: block;
    margin-bottom: 0.25rem;
    color: #6c757d;
    font-size: 0.78rem;
  }

  input[type='date'] {
    min-width: 10rem;
  }
}

.timeline-range-summary {
  margin-left: auto;
  padding-bottom: 0.1rem;
  text-align: right;
}

.timeline-range-summary__label {
  color: $textColor;
  font-weight: 600;
}

.timeline-range-summary__duration {
  color: #6c757d;
  font-size: 0.82rem;
}

.timeline-range-last {
  margin-top: 0.75rem;
}

.timeline-zoom-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.timeline-zoom-toolbar__label {
  color: #6c757d;
  font-size: 0.84rem;
}

.timeline-density {
  margin-top: 0.75rem;
}

.timeline-density__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  color: #6c757d;
  font-size: 0.78rem;
}

.timeline-density__track {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 4.5rem;
  padding: 0.4rem;
  overflow: hidden;
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 0.45rem;
  background: #f8fafc;
}

.timeline-density__bar {
  flex: 1 1 0;
  min-width: 3px;
  max-width: 2rem;
  align-self: flex-end;
  padding: 0;
  border: 0;
  border-radius: 2px 2px 0 0;
  background: #2f6fed;
  cursor: pointer;
  transition: height 120ms ease, opacity 120ms ease, background-color 120ms ease;

  &:hover {
    background: #1f5bd6;
  }
}

.timeline-density__bar--empty {
  background: #cfd7e3;
  cursor: default;

  &:hover {
    background: #cfd7e3;
  }
}

.timeline-density__bar--focused {
  background: #1f8f5f;

  &:hover {
    background: #18744d;
  }
}

@media (max-width: 575.98px) {
  .timeline-range-summary {
    width: 100%;
    margin-left: 0;
    text-align: left;
  }

  .timeline-range-actions,
  .timeline-range-control input[type='date'] {
    width: 100%;
  }

  .timeline-density__track {
    height: 3.5rem;
  }
}
</style>
