<template lang="pug">
div.fleet-endpoint-settings
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Move the server') }}
      small.text-muted
        | {{ $tr('Announce a new address and every device switches to it by itself, so the server can move to another computer or IP without visiting any PC.') }}
    b-button.mt-2.mt-sm-0(size="sm" variant="outline-secondary" :disabled="loading" @click="load")
      | {{ loading ? $tr('Loading...') : $tr('Refresh') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger") {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success") {{ success }}

  b-card.mt-3(no-body)
    b-card-body.py-2
      div.small.text-muted.mb-2
        | {{ $tr('Order matters: start the new server FIRST and announce the new address while this server is still reachable by the devices. They learn it from the update check they already run every minute.') }}

      b-form-group.mb-2(:label="$tr('New server address')")
        b-input-group
          b-form-input(
            v-model="endpoint"
            :placeholder="'http://192.168.0.200:5600'"
            :disabled="saving"
            @keyup.enter="save"
          )
          b-input-group-append
            b-button(variant="primary" :disabled="saving || !endpoint" @click="save")
              | {{ saving ? $tr('Loading...') : $tr('Announce address') }}
        b-form-text
          | {{ $tr('The server checks that an ActivityWatch server actually answers there before announcing it. Each device checks again itself, and refuses to switch to an address it cannot reach.') }}

      b-form-checkbox.mt-2(v-model="skipCheck" :disabled="saving")
        span.small {{ $tr('Announce even if the new server does not answer yet (not recommended)') }}

      div.mt-3(v-if="announced")
        b-alert(show variant="warning")
          div
            | {{ $tr('Currently announced') }}:
            code {{ announced }}
          div.small.mt-1(v-if="config && config.updated_at")
            | {{ $tr('Set by') }} {{ config.updated_by }} {{ $tr('on') }} {{ formatTimestamp(config.updated_at) }}
          div.small.mt-1
            | {{ $tr('Devices that have already switched now talk to that address. Clear this only after every device has moved, or they will switch back.') }}
        b-button(size="sm" variant="outline-danger" :disabled="saving" @click="clear")
          | {{ $tr('Stop announcing') }}
      div.mt-3(v-else)
        div.small.text-muted {{ $tr('No move is being announced; devices use the address built into their watcher package.') }}
</template>

<script lang="ts">
import moment from 'moment';
import { useFleetStore } from '~/stores/fleet';

export default {
  name: 'FleetEndpointSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      loading: false,
      saving: false,
      endpoint: '',
      skipCheck: false,
      error: '',
      success: '',
    };
  },
  computed: {
    config() {
      return this.fleetStore.fleetEndpoint;
    },
    announced() {
      return this.config?.server_endpoint || '';
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = '';
      this.success = '';
      try {
        const config = await this.fleetStore.loadFleetEndpoint();
        this.endpoint = config?.server_endpoint || '';
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to load');
      } finally {
        this.loading = false;
      }
    },
    async save() {
      const target = String(this.endpoint || '').trim();
      if (!target) return;
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Every device will switch to {url}. Make sure the new server is running and holds the fleet data, and keep THIS server reachable until all devices have moved.'
        ).replace('{url}', target),
        {
          title: this.$tr('Move the server'),
          okTitle: this.$tr('Announce address'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) return;

      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.saveFleetEndpoint({
          server_endpoint: target,
          skip_check: this.skipCheck,
        });
        this.success = this.$tr('Address announced - devices switch within about a minute.');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.saving = false;
      }
    },
    async clear() {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Stop announcing the new address? Devices that already switched keep using it; devices that have not switched yet will stay where they are.'
        ),
        {
          title: this.$tr('Stop announcing'),
          okVariant: 'danger',
          okTitle: this.$tr('Stop announcing'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) return;
      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.saveFleetEndpoint({ server_endpoint: '' });
        this.endpoint = '';
        this.success = this.$tr('Saved');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.saving = false;
      }
    },
    formatTimestamp(value) {
      if (!value) return '-';
      const parsed = moment(value);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value);
    },
  },
};
</script>
