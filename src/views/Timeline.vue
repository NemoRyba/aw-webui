<template lang="pug">
div
  h2 {{ $tr('Timeline') }}

  timeline-range-navigator(
    v-model="daterange"
    :defaultDuration="timeintervalDefaultDuration"
    :maxDuration="maxDuration"
    :eventCountsByDay="eventCountsByDay"
    @focus-range="focusTimelineRange"
  ).mb-3

  div.d-flex.flex-wrap.align-items-center.mb-3
    div.d-inline-block.border.rounded.p-2.mr-2.mb-2
      | {{ $tr('Events shown: {count}', { count: num_events }) }}
    div.d-inline-block.border.rounded.p-2.mr-2.mb-2
      span.mr-2 {{ $tr('Swimlanes') }}:
      select(v-model="swimlane")
        option(:value='null') {{ $tr('None') }}
        option(value='category') {{ $tr('Categories') }}
        option(value='bucketType') {{ $tr('Bucket Specific') }}
    div.ml-auto.small.text-muted.mb-2
      | {{ $tr('Drag to pan and scroll to zoom') }}

  b-card.mb-3
    div.row
      div.col-md-4
        b-form-group(:label="$tr('User')")
          b-form-select(v-model="filter_username", :options="usernameOptions")
      div.col-md-4
        b-form-group(:label="$tr('Device')")
          b-form-select(v-model="filter_device_id", :options="deviceOptions")
      div.col-md-4
        b-form-group(:label="$tr('Duration:')")
          b-form-select(v-model="filter_duration", :options="durationOptions")

    div
      div.d-flex.flex-wrap.align-items-center.justify-content-between.mb-2
        h6.mb-2.mb-md-0 {{ $tr('Watchers') }}
        b-button.mb-2(size="sm" variant="outline-secondary" @click="selectAllWatchers" :disabled="watcherOptions.length === 0")
          | {{ $tr('All') }}
      div.small.text-muted.mb-2(v-if="watcherOptions.length === 0")
        | {{ $tr('No watchers available for the current selection.') }}
      div.row(v-else)
        div.col-md-4.col-lg-3.mb-2(v-for="watcher in watcherOptions" :key="watcher.value")
          b-form-checkbox(v-model="selectedWatcherKeys" :value="watcher.value")
            | {{ watcher.text }}

  b-alert.d-inline-block.p-2.mb-3(v-if="all_buckets !== null && timelineSections.length === 0", variant="warning", show)
    | {{ $tr('No timeline data found for the selected filters.') }}

  div(v-else-if="all_buckets !== null")
    div.timeline-section.mb-4(v-for="section in timelineSections" :key="section.key")
      h5.mb-1(v-if="section.title") {{ section.title }}
      div.small.text-muted.mb-2(v-if="section.subtitle") {{ section.subtitle }}
      div.small.text-muted.mb-2
        | {{ $tr('Events shown: {count}', { count: section.eventCount }) }}
      vis-timeline(
        :key="section.key"
        :buckets="section.buckets"
        :showRowLabels='true'
        :queriedInterval="daterange"
        :windowInterval="timelineWindowInterval"
        :swimlane="swimlane"
        :updateTimelineWindow='updateTimelineWindow'
      )

    aw-devonly(v-if="timelineSections.length === 1" reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="timelineSections[0].buckets")

  div(v-else)
    h1.aw-loading {{ $tr('Loading...') }}
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getBucketIdentity } from '~/util/bucketIdentity';

export default {
  name: 'Timeline',
  components: {
    'timeline-range-navigator': () => import('~/components/TimelineRangeNavigator.vue'),
  },
  data() {
    return {
      all_buckets: null,
      daterange: null,
      maxDuration: 10 * 365 * 24 * 60 * 60,
      filter_username: null,
      filter_device_id: null,
      filter_duration: null,
      swimlane: null,
      selectedWatcherKeys: [],
      updateTimelineWindow: true,
      timelineWindowInterval: null,
    };
  },
  computed: {
    timeintervalDefaultDuration() {
      const settingsStore = useSettingsStore();
      return Number(settingsStore.durationDefault);
    },
    usernameOptions() {
      const options = [{ value: null, text: this.$tr('All') }];
      return options.concat(
        this.usernames.map(username => ({
          value: username,
          text: username,
        }))
      );
    },
    usernames() {
      return _.sortBy(
        _.uniq(
          (this.all_buckets || []).map((bucket: any) => {
            return this.bucketIdentity(bucket).username;
          })
        ),
        username => String(username).toLowerCase()
      );
    },
    availableDevices() {
      const deviceMap = new Map();
      for (const bucket of this.all_buckets || []) {
        const identity = this.bucketIdentity(bucket);
        if (this.filter_username && identity.username !== this.filter_username) {
          continue;
        }
        if (!deviceMap.has(identity.deviceId)) {
          deviceMap.set(identity.deviceId, {
            value: identity.deviceId,
            text:
              identity.deviceName && identity.deviceName !== identity.deviceId
                ? `${identity.deviceName} (${identity.deviceId})`
                : identity.deviceId,
            deviceName: identity.deviceName,
          });
        }
      }

      return _.sortBy(Array.from(deviceMap.values()), option => option.text.toLowerCase());
    },
    deviceOptions() {
      return [{ value: null, text: this.$tr('All devices') }].concat(this.availableDevices);
    },
    durationOptions() {
      return [
        { value: null, text: this.$tr('All') },
        { value: 2, text: '2+ s' },
        { value: 5, text: '5+ s' },
        { value: 10, text: '10+ s' },
        { value: 30, text: '30+ s' },
        { value: 1 * 60, text: '1+ min' },
        { value: 2 * 60, text: '2+ min' },
        { value: 3 * 60, text: '3+ min' },
        { value: 10 * 60, text: '10+ min' },
        { value: 30 * 60, text: '30+ min' },
        { value: 1 * 60 * 60, text: '1+ h' },
        { value: 2 * 60 * 60, text: '2+ h' },
      ];
    },
    watcherOptions() {
      const watcherOptions = [];

      for (const bucket of this.all_buckets || []) {
        const identity = this.bucketIdentity(bucket);
        if (this.filter_username && identity.username !== this.filter_username) {
          continue;
        }
        if (this.filter_device_id && identity.deviceId !== this.filter_device_id) {
          continue;
        }

        const labelParts = [identity.watcherLabel];
        labelParts.push(
          `${this.$tr('Session')} ${identity.sessionId}${
            identity.sessionType ? ` (${identity.sessionType})` : ''
          }`
        );
        if (!this.filter_device_id) {
          labelParts.push(identity.deviceName);
        }
        if (!this.filter_username) {
          labelParts.push(identity.username);
        }

        watcherOptions.push({
          value: String(bucket.id),
          text: labelParts.join(' | '),
          sortDeviceName: identity.deviceName,
          sortUsername: identity.username,
          sortSessionId: identity.sessionId,
          sortWatcherLabel: identity.watcherLabel,
        });
      }

      return _.orderBy(
        watcherOptions,
        [
          (option: any) => String(option.sortDeviceName || '').toLowerCase(),
          (option: any) => String(option.sortUsername || '').toLowerCase(),
          (option: any) => String(option.sortSessionId || '').toLowerCase(),
          (option: any) => String(option.sortWatcherLabel || '').toLowerCase(),
        ],
        ['asc', 'asc', 'asc', 'asc']
      );
    },
    watcherSignature() {
      return this.watcherOptions.map(option => option.value).join('|');
    },
    filteredBuckets() {
      const selectedWatcherKeys =
        this.selectedWatcherKeys.length > 0
          ? new Set(this.selectedWatcherKeys)
          : new Set(this.watcherOptions.map(option => option.value));

      const buckets = [];

      for (const bucket of this.all_buckets || []) {
        const identity = this.bucketIdentity(bucket);

        if (this.filter_username && identity.username !== this.filter_username) {
          continue;
        }
        if (this.filter_device_id && identity.deviceId !== this.filter_device_id) {
          continue;
        }
        if (selectedWatcherKeys.size > 0 && !selectedWatcherKeys.has(String(bucket.id))) {
          continue;
        }

        let events = bucket.events || [];
        if (this.filter_duration > 0) {
          events = _.filter(events, event => event.duration >= this.filter_duration);
        }
        if (events.length === 0) {
          continue;
        }

        buckets.push({
          ...bucket,
          display_name: this.buildTimelineBucketLabel(bucket),
          events,
        });
      }

      return _.orderBy(
        buckets,
        [
          (bucket: any) => this.bucketIdentity(bucket).deviceName.toLowerCase(),
          (bucket: any) => String(bucket.client || '').toLowerCase(),
          (bucket: any) => String(bucket.id || '').toLowerCase(),
        ],
        ['asc', 'asc', 'asc']
      );
    },
    timelineSections() {
      if (this.filteredBuckets.length === 0) {
        return [];
      }

      if (this.filter_username && !this.filter_device_id) {
        const grouped = _.groupBy(
          this.filteredBuckets,
          bucket => this.bucketIdentity(bucket).deviceId
        );
        return _.orderBy(
          Object.entries(grouped).map(([deviceId, buckets]) => {
            const identity = this.bucketIdentity(buckets[0]);
            return {
              key: `device:${deviceId}`,
              title: `${this.$tr('Device')} ${identity.deviceName}`,
              subtitle:
                identity.deviceName !== deviceId
                  ? deviceId
                  : `${this.$tr('User')} ${this.filter_username}`,
              buckets,
              eventCount: _.sumBy(buckets, (bucket: any) => (bucket.events || []).length),
            };
          }),
          (section: any) => String(section.title || '').toLowerCase(),
          ['asc']
        );
      }

      const titleParts = [];
      let subtitle = '';

      if (this.filter_username) {
        titleParts.push(`${this.$tr('User')} ${this.filter_username}`);
      }
      if (this.filter_device_id) {
        const deviceOption = this.availableDevices.find(
          device => device.value === this.filter_device_id
        );
        const deviceName = deviceOption?.deviceName || this.filter_device_id;
        titleParts.push(`${this.$tr('Device')} ${deviceName}`);
        if (deviceName !== this.filter_device_id) {
          subtitle = this.filter_device_id;
        }
      }

      return [
        {
          key: this.filter_device_id || this.filter_username || 'timeline',
          title: titleParts.join(' / '),
          subtitle,
          buckets: this.filteredBuckets,
          eventCount: _.sumBy(this.filteredBuckets, (bucket: any) => (bucket.events || []).length),
        },
      ];
    },
    num_events() {
      return _.sumBy(this.timelineSections, (section: any) => section.eventCount);
    },
    eventCountsByDay() {
      const counts = {};

      for (const bucket of this.filteredBuckets) {
        for (const event of bucket.events || []) {
          const day = moment(event.timestamp).format('YYYY-MM-DD');
          counts[day] = (counts[day] || 0) + 1;
        }
      }

      return counts;
    },
  },
  watch: {
    daterange() {
      this.updateTimelineWindow = true;
      this.timelineWindowInterval = null;
      this.getBuckets();
    },
    filter_username() {
      this.updateTimelineWindow = true;
      if (
        this.filter_device_id &&
        !this.availableDevices.some(device => device.value === this.filter_device_id)
      ) {
        this.filter_device_id = null;
      }
      this.syncSelectedWatchers();
    },
    filter_device_id() {
      this.updateTimelineWindow = true;
      this.syncSelectedWatchers();
    },
    filter_duration() {
      this.updateTimelineWindow = false;
    },
    swimlane() {
      this.updateTimelineWindow = false;
    },
    watcherSignature() {
      this.syncSelectedWatchers();
    },
  },
  methods: {
    isHiddenTimelineBucket(bucket) {
      return String(bucket?.type || '').startsWith('general.stopwatch');
    },
    bucketIdentity(bucket) {
      return getBucketIdentity(bucket);
    },
    buildTimelineBucketLabel(bucket) {
      const identity = this.bucketIdentity(bucket);
      const parts = [identity.watcherLabel];
      parts.push(
        `${this.$tr('Session')} ${identity.sessionId}${
          identity.sessionType ? ` (${identity.sessionType})` : ''
        }`
      );

      if (!this.filter_username) {
        parts.push(identity.username);
      }
      if (!this.filter_device_id && !this.filter_username) {
        parts.push(identity.deviceName);
      }

      return parts.join(' | ');
    },
    selectAllWatchers() {
      this.selectedWatcherKeys = this.watcherOptions.map(option => option.value);
    },
    focusTimelineRange(interval) {
      this.timelineWindowInterval = interval;
      this.updateTimelineWindow = true;
    },
    syncSelectedWatchers() {
      const available = this.watcherOptions.map(option => option.value);

      if (available.length === 0) {
        if (this.selectedWatcherKeys.length > 0) {
          this.selectedWatcherKeys = [];
        }
        return;
      }

      const filteredSelection = this.selectedWatcherKeys.filter(value => available.includes(value));
      if (filteredSelection.length === 0) {
        this.selectedWatcherKeys = [...available];
        return;
      }

      if (!_.isEqual(filteredSelection, this.selectedWatcherKeys)) {
        this.selectedWatcherKeys = filteredSelection;
      }
    },
    getBuckets: async function () {
      if (this.daterange == null) return;

      const buckets = await useBucketsStore().getBucketsWithEvents({
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });

      this.all_buckets = Object.freeze(
        buckets.filter(bucket => !this.isHiddenTimelineBucket(bucket))
      );

      if (
        this.filter_device_id &&
        !this.availableDevices.some(device => device.value === this.filter_device_id)
      ) {
        this.filter_device_id = null;
      }

      this.syncSelectedWatchers();
    },
  },
};
</script>
