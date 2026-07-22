<template lang="pug">
  div
    div#visualization

    div.timeline-details(v-if="items.length > 0")
      h6.timeline-details__title.mb-2 {{ $tr('Timeline details') }}
      div.timeline-details__empty.small.text-muted(v-if="!detailHtml")
        | {{ $tr('Hover over a timeline item to inspect its details here.') }}
      div.timeline-details__content(v-else v-html="detailHtml")
      div.timeline-details__state-color(v-if="detailColorTarget")
        label.timeline-details__state-color-label
          span {{ $tr('State color') }}
          small.text-muted.ml-2 {{ detailColorTarget.label }}
        div.timeline-details__state-color-controls
          input.timeline-details__state-color-input(
            type="color"
            :value="detailColorTarget.color"
            :aria-label="$tr('State color')"
            @input="updateTimelineStateColor($event.target.value)"
          )
          code {{ detailColorTarget.color }}
          b-button(size="sm" variant="outline-secondary" @click="resetTimelineStateColor")
            | {{ $tr('Reset color') }}
        div.small.text-muted.mt-1
          | {{ $tr('Color applies to all matching timeline bars.') }}

    div.small.text-muted.my-2(v-if="bucketsFromEither.length != 1")
      i Buckets with no events in the queried range will be hidden.

    div(v-if="editingEvent")
      EventEditor(:event="editingEvent" :bucket_id="editingEventBucket")
</template>

<style lang="scss">
div#visualization {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  overflow: visible;

  .vis-timeline {
    overflow: visible;
  }

  .timeline-timeline {
    font-family: sans-serif !important;

    .timeline-panel {
      box-sizing: border-box;
    }

    .timeline-item {
      border-radius: 2px;
    }
  }
}

.timeline-details {
  margin-top: 0.75em;
  padding: 0.75em 1em;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 0.5em;
  background: rgba(127, 127, 127, 0.08);
}

.timeline-details__title {
  font-weight: 600;
}

.timeline-details__content {
  font-size: 0.92em;

  table {
    margin: 0;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.15em 0.6em 0.15em 0;
    text-align: left;
    vertical-align: top;
  }

  th {
    white-space: nowrap;
    opacity: 0.8;
  }

  td {
    word-break: break-word;
  }

  a {
    word-break: break-all;
  }
}

.timeline-details__state-color {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(127, 127, 127, 0.25);
}

.timeline-details__state-color-label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.timeline-details__state-color-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.timeline-details__state-color-input {
  width: 2.75rem;
  height: 2rem;
  padding: 0.1rem;
}
</style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import Color from 'color';
import { buildTooltip } from '../util/tooltip.js';
import { getCategoryColorFromEvent, getTitleAttr } from '../util/color';
import { getSwimlane } from '../util/swimlane.js';
import { IEvent } from '../util/interfaces';
import { translateCurrent } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

import { Timeline } from 'vis-timeline/esnext';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import EventEditor from '~/components/EventEditor.vue';

let isAlertWarningShown = false;

interface IChartDataItem {
  bucketId: string;
  title: string;
  tooltip: string;
  start: Date;
  end: Date;
  color: string;
  colorTarget?: Record<string, any> | null;
  event: IEvent;
  swimlane: string;
}

interface ITimelineItem {
  id: string;
  group: string;
  content: string;
  start: moment.Moment;
  end: moment.Moment;
  style: string;
  subgroup: string;
  detailHtml: string;
  bucketId?: string;
  event?: IEvent | null;
  editable?: boolean;
  colorTarget?: Record<string, any> | null;
}
export default {
  components: {
    EventEditor,
  },
  props: {
    buckets: { type: Array },
    events: { type: Array },
    showRowLabels: { type: Boolean },
    queriedInterval: { type: Array },
    windowInterval: { type: Array },
    showQueriedInterval: { type: Boolean },
    swimlane: { type: String },
    updateTimelineWindow: { type: Boolean },
  },
  data() {
    return {
      timeline: null,
      settingsStore: useSettingsStore(),
      filterShortEvents: true,
      items: [],
      groups: [],
      options: {
        zoomMin: 1000 * 60, // 10min in milliseconds
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 3, // about three months in milliseconds
        stack: false,
        showTooltips: false,
        tooltip: {
          followMouse: true,
          overflowMethod: 'cap',
          delay: 0,
        },
      },
      editingEvent: null,
      editingEventBucket: null,
      detailItemId: null,
      detailHtml: '',

      updateHasRun: false,
    };
  },
  computed: {
    bucketsFromEither() {
      if (this.buckets) {
        return this.buckets;
      } else if (this.events) {
        // If buckets not passed, check if events have been passed and generate a bucket from those events
        return [
          {
            id: 'events',
            type: 'search',
            events: this.events,
          },
        ];
      } else {
        console.error('No buckets or events passed to timeline');
        return [];
      }
    },
    timelineStateColorSignature() {
      return JSON.stringify(this.settingsStore.timelineStateColorsData || {});
    },
    detailColorTarget() {
      const item = _.find(this.items, i => String(i.id) === String(this.detailItemId));
      const target = item?.colorTarget;
      if (!target?.key) {
        return null;
      }
      return {
        ...target,
        color: this.timelineStateColorValue(target.key, target.defaultColor),
      };
    },
    chartData(): IChartDataItem[] {
      const data: IChartDataItem[] = [];
      _.each(this.bucketsFromEither, bucket => {
        if (bucket.events === undefined) {
          return;
        }
        let events = bucket.events;
        // Filter out events shorter than 1 second (notably including 0-duration events)
        // TODO: Use flooding instead, preferably with some additional method of removing/simplifying short events for even greater performance
        if (this.filterShortEvents) {
          events = _.filter(events, e => e.duration > 1);
          console.log(`Filtered ${bucket.events.length - events.length} events`);
        }
        events.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
        _.each(events, e => {
          const colorTarget = this.timelineColorTarget(bucket, e);
          data.push({
            bucketId: bucket.id,
            title: getTitleAttr(bucket, e),
            tooltip: buildTooltip(bucket, e),
            start: new Date(e.timestamp),
            end: new Date(moment(e.timestamp).add(e.duration, 'seconds').valueOf()),
            color: this.timelineColorForEvent(bucket, e, colorTarget),
            colorTarget,
            event: e,
            swimlane: getSwimlane(bucket, e.color, this.swimlane, e),
          });
        });
      });
      return data;
    },
  },
  watch: {
    buckets() {
      // For some reason, an object is passed here, after which the correct array arrives
      if (this.buckets.length === undefined) {
        //console.log("I told you so!")
        return;
      }

      this.update();
    },
    events() {
      if (this.events.length === undefined) {
        return;
      }

      this.update();
    },
    windowInterval() {
      this.applyTimelineWindow();
    },
    timelineStateColorSignature() {
      this.update();
    },
  },
  mounted() {
    this.$nextTick(() => {
      const el = this.$el.querySelector('#visualization');
      this.timeline = new Timeline(el, [], [], this.options);
      this.timeline.on('itemover', properties => {
        this.setDetailFromItemId(properties.item);
      });
      this.timeline.on('select', properties => {
        if (properties.items.length === 1) {
          this.setDetailFromItemId(properties.items[0]);
        }
        // Sends both 'press' and 'tap' events, only one should trigger
        if (properties.event.type == 'tap') {
          this.onSelect(properties);
        }
      });

      this.ensureUpdate();
    });
  },
  methods: {
    setDetailFromItemId(itemId) {
      if (itemId === null || itemId === undefined) {
        return;
      }

      const item = _.find(this.items, i => String(i.id) === String(itemId));
      if (!item) {
        return;
      }

      this.detailItemId = String(item.id);
      this.detailHtml = item.detailHtml || '';
    },
    openEditor: function () {
      this.$bvModal.show('edit-modal-' + this.editingEvent.id);
    },
    timelineColorTarget(bucket, event) {
      const bucketType = String(bucket?.type || '');
      if (bucketType !== 'sessionstate' && !bucketType.startsWith('audio.')) {
        return null;
      }

      const state = String(event?.data?.state || '').trim();
      if (!state) {
        return null;
      }

      const defaultColor = getCategoryColorFromEvent(bucket, event);
      return {
        key: `${bucketType}:${state}`,
        label: `${bucketType} · ${state}`,
        defaultColor,
      };
    },
    timelineColorForEvent(bucket, event, colorTarget = null) {
      const fallback = getCategoryColorFromEvent(bucket, event);
      const target = colorTarget || this.timelineColorTarget(bucket, event);
      if (!target?.key) {
        return fallback;
      }
      return this.timelineStateColorValue(target.key, fallback);
    },
    timelineStateColorValue(key, fallback) {
      const value = (this.settingsStore.timelineStateColorsData || {})[key];
      try {
        return value ? Color(value).hex() : Color(fallback).hex();
      } catch (_error) {
        return '#cccccc';
      }
    },
    async updateTimelineStateColor(color) {
      const target = this.detailColorTarget;
      if (!target?.key) {
        return;
      }
      let normalized = color;
      try {
        normalized = Color(color).hex();
      } catch (_error) {
        return;
      }
      await this.settingsStore.update({
        timelineStateColorsData: {
          ...(this.settingsStore.timelineStateColorsData || {}),
          [target.key]: normalized,
        },
      });
    },
    async resetTimelineStateColor() {
      const target = this.detailColorTarget;
      if (!target?.key) {
        return;
      }
      const colors = { ...(this.settingsStore.timelineStateColorsData || {}) };
      delete colors[target.key];
      await this.settingsStore.update({ timelineStateColorsData: colors });
    },
    timelineItemBorderColor(bgColor) {
      try {
        return Color(bgColor).darken(0.3);
      } catch (_error) {
        return Color('#cccccc').darken(0.3);
      }
    },
    onSelect: async function (properties) {
      if (properties.items.length == 0) {
        return;
      } else if (properties.items.length == 1) {
        const item = _.find(this.items, i => String(i.id) === String(properties.items[0]));
        if (!item || !item.editable || !item.event || !item.bucketId) {
          return;
        }

        const event = item.event;
        const bucketId = item.bucketId;

        // We retrieve the full event to ensure if's not cut-off by the query range
        // See: https://github.com/ActivityWatch/aw-webui/pull/320#issuecomment-1056921587
        this.editingEvent = await this.$aw.getEvent(bucketId, event.id);
        this.editingEventBucket = bucketId;

        this.$nextTick(() => {
          console.log('Editing event', event, ', in bucket', bucketId);
          this.openEditor();
        });
        if (!isAlertWarningShown) {
          alert(
            translateCurrent(
              "Note: Changes won't be reflected in the timeline until the page is refreshed. This will be improved in a future version."
            )
          );
          isAlertWarningShown = true;
        }
      } else {
        alert(
          translateCurrent('selected multiple items: {items}', {
            items: JSON.stringify(properties.items),
          })
        );
      }
    },
    ensureUpdate() {
      // Will only run update() if data available and never ran before
      if (!this.updateHasRun) {
        this.update();
      }
    },
    update() {
      // Used by unsureUpdate to check if ran
      this.updateHasRun = true;

      // Build groups
      const buckets = this.bucketsFromEither;
      let groups = _.map(buckets, bucket => {
        // If bucket id is not set, then if only one bucket is given, assume result of a search/query and set a constant placeholder one.
        // Otherwise, log a warning.
        if (bucket.id === undefined) {
          if (buckets.length === 1) {
            bucket.id = 'events';
          } else {
            console.warn(
              'Bucket id is not set, but there are multiple buckets. This is not supported.'
            );
          }
        }
        return {
          id: bucket.id,
          content: this.showRowLabels ? bucket.display_name || bucket.id : '',
        };
      });

      // Build items
      const items: ITimelineItem[] = _.map(this.chartData, (item, i) => {
        const bgColor = item.color;
        const borderColor = this.timelineItemBorderColor(bgColor);
        return {
          id: String(i),
          group: item.bucketId,
          content: item.title,
          start: moment(item.start),
          end: moment(item.end),
          style: `background-color: ${bgColor}; border-color: ${borderColor}`,
          subgroup: item.swimlane,
          detailHtml: item.tooltip,
          bucketId: item.bucketId,
          event: item.event,
          editable: !item.colorTarget,
          colorTarget: item.colorTarget,
        };
      });

      if (groups.length > 0 && items.length > 0) {
        if (this.queriedInterval && this.showQueriedInterval) {
          const duration = this.queriedInterval[1].diff(this.queriedInterval[0], 'seconds');
          const queriedIntervalGroupId = '__queried_interval__';
          groups.push({ id: queriedIntervalGroupId, content: 'queried interval' });
          items.push({
            id: '__queried_interval__',
            group: queriedIntervalGroupId,
            detailHtml: buildTooltip(
              { type: 'test' },
              {
                timestamp: this.queriedInterval[0],
                duration: duration,
                data: { title: 'test' },
              }
            ),
            content: 'query',
            start: this.queriedInterval[0],
            end: this.queriedInterval[1],
            style: 'background-color: #aaa; height: 10px',
            subgroup: ``,
            editable: false,
            event: null,
          });
        }

        if (this.updateTimelineWindow) {
          this.applyTimelineWindow(items);
        }

        // Hide buckets with no events in the queried range
        const count = _.countBy(items, i => i.group);
        groups = _.filter(groups, g => {
          return count[g.id] && count[g.id] > 0;
        });
        this.timeline.setData({ groups: groups, items: items });

        this.items = items;
        this.groups = groups;
        if (!this.detailItemId || !_.find(items, item => String(item.id) === this.detailItemId)) {
          this.detailItemId = null;
          this.detailHtml = '';
        }
      } else {
        // update the timeline range
        this.applyTimelineWindow();

        // clear the data
        this.timeline.setData({ groups: [], items: [] });
        this.items = [];
        this.groups = [];
        this.detailItemId = null;
        this.detailHtml = '';
      }
    },
    applyTimelineWindow(items = []) {
      if (!this.timeline) {
        return;
      }

      const fullStart =
        (this.queriedInterval && this.queriedInterval[0]) ||
        _.min(_.map(items, item => item.start));
      const fullEnd =
        (this.queriedInterval && this.queriedInterval[1]) || _.max(_.map(items, item => item.end));

      if (!fullStart || !fullEnd) {
        return;
      }

      const windowStart = (this.windowInterval && this.windowInterval[0]) || fullStart;
      const windowEnd = (this.windowInterval && this.windowInterval[1]) || fullEnd;

      this.options.min = fullStart;
      this.options.max = fullEnd;
      this.timeline.setOptions(this.options);
      this.timeline.setWindow(windowStart, windowEnd);
    },
  },
};
</script>
