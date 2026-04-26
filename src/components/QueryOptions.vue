<template lang="pug">
div
  b-form-group(label="User" label-cols=2)
    b-form-select(v-model="filterUsername", :options="usernameChoices")
  b-form-group(label="Device" label-cols=2)
    b-form-select(v-model="filterDeviceId", :options="deviceChoices")
  b-form-group(label="Session" label-cols=2)
    b-form-select(v-model="selectedTargetKey", :options="targetChoices", :disabled="targetChoices.length === 0")
    small.text-muted.d-block.mt-1(v-if="queryOptionsData.hostname")
      | Hostname: {{ queryOptionsData.hostname }}
    small.text-danger.d-block.mt-1(v-else-if="targetChoices.length === 0")
      | No matching window/AFK watcher pairs are available.
  b-form-group(label="Start" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.start" :locale="$localeCode")
  b-form-group(label="Stop" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.stop" :locale="$localeCode")
  b-form-group(label="Toggles" label-cols=2)
    b-form-checkbox(type="checkbox" v-model="queryOptionsData.filter_afk" label="Filter AFK" description="")
      label Exclude time away from computer
</template>

<script lang="ts">
import Vue from 'vue';
import moment from 'moment';
import { useBucketsStore } from '~/stores/buckets';
import { getDesktopQueryTargets } from '~/util/bucketIdentity';

export default Vue.extend({
  name: 'QueryOptions',
  props: {
    queryOptions: {
      type: Object,
    },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),
      filterUsername: null,
      filterDeviceId: null,
      selectedTargetKey: null,

      queryOptionsData: {
        hostname: '',
        username: '',
        device_id: '',
        device_name: '',
        session_id: '',
        session_type: '',
        bid_window: '',
        bid_afk: '',
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
        filter_afk: true,
      },
    };
  },

  computed: {
    desktopQueryTargets() {
      return getDesktopQueryTargets(this.bucketsStore.buckets);
    },
    usernameChoices() {
      const seen = new Set<string>();
      const usernames: string[] = [];

      for (const target of this.desktopQueryTargets) {
        const username = String(target.username || '');
        if (!username || username === 'unknown' || seen.has(username)) {
          continue;
        }

        seen.add(username);
        usernames.push(username);
      }

      usernames.sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' })
      );

      return [{ value: null, text: 'All users' }].concat(
        usernames.map((username: string) => ({ value: username, text: username }))
      );
    },
    deviceChoices() {
      const devices = new Map<string, { value: string; text: string }>();

      for (const target of this.desktopQueryTargets) {
        if (this.filterUsername && target.username !== this.filterUsername) {
          continue;
        }

        if (!devices.has(target.deviceId)) {
          devices.set(target.deviceId, {
            value: target.deviceId,
            text:
              target.deviceName && target.deviceName !== target.deviceId
                ? `${target.deviceName} (${target.deviceId})`
                : target.deviceId,
          });
        }
      }

      return [{ value: null, text: 'All devices' }].concat(Array.from(devices.values()));
    },
    filteredTargets() {
      return this.desktopQueryTargets.filter(target => {
        if (this.filterUsername && target.username !== this.filterUsername) {
          return false;
        }

        if (this.filterDeviceId && target.deviceId !== this.filterDeviceId) {
          return false;
        }

        return true;
      });
    },
    targetChoices() {
      return this.filteredTargets.map(target => ({
        value: target.key,
        text: target.label,
      }));
    },
    targetSignature() {
      return this.targetChoices.map(option => option.value).join('|');
    },
    selectedTarget() {
      return this.desktopQueryTargets.find(target => target.key === this.selectedTargetKey) || null;
    },
  },

  watch: {
    filterUsername() {
      if (
        this.filterDeviceId &&
        !this.deviceChoices.some(option => option.value === this.filterDeviceId)
      ) {
        this.filterDeviceId = null;
      }
      this.syncSelectedTarget();
    },
    filterDeviceId() {
      this.syncSelectedTarget();
    },
    selectedTargetKey() {
      this.applySelectedTarget();
    },
    targetSignature() {
      this.syncSelectedTarget();
    },
    queryOptionsData: {
      handler(value) {
        this.$emit('input', value);
      },
      deep: true,
    },
  },

  async mounted() {
    await this.bucketsStore.ensureLoaded();

    const initialQueryOptions = {
      ...this.queryOptionsData,
      ...this.queryOptions,
    };

    this.queryOptionsData = {
      ...initialQueryOptions,
      start: initialQueryOptions.start
        ? moment(initialQueryOptions.start).format('YYYY-MM-DD')
        : this.queryOptionsData.start,
      stop: initialQueryOptions.stop
        ? moment(initialQueryOptions.stop).format('YYYY-MM-DD')
        : this.queryOptionsData.stop,
    };

    this.filterUsername = initialQueryOptions.username || null;
    this.filterDeviceId = initialQueryOptions.device_id || null;
    this.selectedTargetKey = initialQueryOptions.bid_window || null;

    this.syncSelectedTarget();
  },

  methods: {
    syncSelectedTarget() {
      const availableKeys = this.targetChoices.map(option => option.value);

      if (availableKeys.length === 0) {
        if (this.selectedTargetKey !== null) {
          this.selectedTargetKey = null;
        } else {
          this.clearSelectedTarget();
        }
        return;
      }

      if (!availableKeys.includes(this.selectedTargetKey)) {
        this.selectedTargetKey = availableKeys[0];
        return;
      }

      this.applySelectedTarget();
    },
    clearSelectedTarget() {
      this.queryOptionsData = {
        ...this.queryOptionsData,
        hostname: '',
        username: '',
        device_id: '',
        device_name: '',
        session_id: '',
        session_type: '',
        bid_window: '',
        bid_afk: '',
      };
    },
    applySelectedTarget() {
      if (!this.selectedTarget) {
        this.clearSelectedTarget();
        return;
      }

      this.queryOptionsData = {
        ...this.queryOptionsData,
        hostname: this.selectedTarget.hostname,
        username: this.selectedTarget.username,
        device_id: this.selectedTarget.deviceId,
        device_name: this.selectedTarget.deviceName,
        session_id: this.selectedTarget.sessionId,
        session_type: this.selectedTarget.sessionType,
        bid_window: this.selectedTarget.bidWindow,
        bid_afk: this.selectedTarget.bidAfk,
      };
    },
  },
});
</script>
