<template lang="pug">
div
  h3.mb-1 {{ bucketDisplayName }}
  div.small.text-muted.mb-3 {{ $tr('Bucket ID') }}: {{ id }}
  table
    tr
      th {{ $tr('Type:') }}
      td {{ bucket.type }}
    tr
      th {{ $tr('Client:') }}
      td {{ bucket.client }}
    tr
      th {{ $tr('Username') }}:
      td {{ identity.username }}
    tr
      th {{ $tr('Device') }}:
      td {{ identity.deviceName }}
    tr
      th {{ $tr('Session') }}:
      td
        | {{ identity.sessionId }}
        span(v-if="identity.sessionType")  ({{ identity.sessionType }})
    tr
      th {{ $tr('Hostname') }}:
      td {{ bucket.hostname }}
    tr
      th {{ $tr('Created:') }}
      td {{ bucket.created | iso8601 }}
    tr(v-if="bucket.metadata")
      th {{ $tr('First/last event:') }}
      td
        | {{ bucket.metadata.start}} /
        | {{ bucket.metadata.end }}
    tr
      th {{ $tr('Eventcount:') }}
      td {{ eventcount }}
    tr
      th {{ $tr('Data:') }}
      td {{ bucket.data }}

  input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

  vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

  aw-eventlist(
    :bucket_id="id"
    @save="updateEvent"
    @delete="removeEvent"
    @delete-many="removeEvents"
    :events="events"
    editable=true
  )
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
import { getBucketIdentity } from '~/util/bucketIdentity';

export default {
  name: 'Bucket',
  props: {
    id: String,
  },
  data: () => {
    return {
      bucketsStore: useBucketsStore(),

      events: [],
      eventcount: '?',
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    bucket() {
      return this.bucketsStore.getBucket(this.id) || { id: this.id };
    },
    identity() {
      return getBucketIdentity(this.bucket);
    },
    bucketDisplayName() {
      return [
        this.identity.watcherLabel,
        `${this.$tr('Session')} ${this.identity.sessionId}${
          this.identity.sessionType ? ` (${this.identity.sessionType})` : ''
        }`,
        this.identity.username,
        this.identity.deviceName,
      ].join(' | ');
    },
    bucket_with_events() {
      return {
        ...this.bucket,
        display_name: this.bucketDisplayName,
        events: this.events,
      };
    },
  },
  watch: {
    daterange: async function () {
      await this.getEvents(this.id);
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
    await this.getEventCount(this.id);
  },
  methods: {
    getEvents: async function (bucket_id) {
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
      this.events = bucket.events;
    },
    getEventCount: async function (bucket_id) {
      this.eventcount = (await getClient().countEvents(bucket_id)).data;
    },
    updateEvent: function (event) {
      const i = this.events.findIndex(e => e.id == event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue.
        this.$set(this.events, i, event);
      } else {
        console.error(':(');
      }
    },
    removeEvent: async function (event) {
      if (!event || event.id === undefined || event.id === null) {
        return;
      }
      await this.removeEvents([event.id]);
    },
    removeEvents: async function (eventIds) {
      const deletedIds = new Set((eventIds || []).map(eventId => String(eventId)));
      this.events = this.events.filter(event => !deletedIds.has(String(event.id)));
      await this.getEventCount(this.id);
      await this.bucketsStore.loadBuckets();
    },
  },
};
</script>
