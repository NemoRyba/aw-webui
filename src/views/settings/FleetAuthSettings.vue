<template lang="pug">
div.fleet-auth-settings
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Fleet access token') }}
      small.text-muted
        | {{ $tr('Watchers have no login, so they authenticate with this shared token. Everything a browser reads always requires a login.') }}
    b-button.mt-2.mt-sm-0(size="sm" variant="outline-secondary" :disabled="loading" @click="load")
      | {{ loading ? $tr('Loading...') : $tr('Refresh') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger") {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success") {{ success }}

  b-card.mt-3(no-body)
    b-card-body.py-2
      div.d-sm-flex.justify-content-between.align-items-center
        div
          div.font-weight-bold {{ $tr('Require token for watcher traffic') }}
          div.small.text-muted
            | {{ $tr('While this is off, any device on the LAN can send watcher data. While it is on, only devices holding the token can.') }}
        div.mt-2.mt-sm-0
          b-form-checkbox(
            switch
            :checked="requireToken"
            :disabled="loading || saving"
            @change="saveRequireToken($event)"
          )
            | {{ $tr('Require token') }}

      b-alert.mt-2.mb-0(:show="!requireToken" variant="warning")
        | {{ $tr('Turn this on only after every device has been given the token, otherwise those devices stop recording. Run the watcher installer with -FleetToken on each device first.') }}

  b-card.mt-3(no-body)
    b-card-body.py-2
      div.font-weight-bold {{ $tr('Token') }}
      div.small.text-muted.mb-2
        | {{ $tr('Provision a device with: install-watchers.ps1 -FleetToken <token>. The token is stored per machine and survives watcher updates.') }}
      div.d-flex.align-items-center.flex-wrap
        code.mr-2.p-1(v-if="revealedToken") {{ revealedToken }}
        code.mr-2.p-1(v-else) {{ tokenHint }}&hellip;
        b-button.mr-2.mt-1(size="sm" variant="outline-secondary" :disabled="loading" @click="reveal")
          | {{ revealedToken ? $tr('Hide') : $tr('Show token') }}
        b-button.mr-2.mt-1(
          size="sm"
          variant="outline-secondary"
          :disabled="!revealedToken"
          @click="copyToken"
        )
          | {{ $tr('Copy') }}
        b-button.mt-1(size="sm" variant="outline-danger" :disabled="saving" @click="rotate")
          | {{ $tr('Generate new token') }}
      div.small.text-muted.mt-2(v-if="config")
        | {{ $tr('Devices known to the fleet') }}: {{ config.devices_total }} &middot;
        | {{ $tr('reporting watchers') }}: {{ config.devices_reporting }}
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';

export default {
  name: 'FleetAuthSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      loading: false,
      saving: false,
      revealedToken: '',
      error: '',
      success: '',
    };
  },
  computed: {
    config() {
      return this.fleetStore.fleetAuth;
    },
    requireToken() {
      return Boolean(this.config && this.config.require_watcher_token);
    },
    tokenHint() {
      return (this.config && this.config.token_hint) || '';
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
        await this.fleetStore.loadFleetAuthConfig();
      } catch (error) {
        this.error =
          error?.response?.data?.message || this.$tr('Unable to load watcher update status');
      } finally {
        this.loading = false;
      }
    },
    async saveRequireToken(enabled) {
      if (enabled) {
        const confirmed = await this.$bvModal.msgBoxConfirm(
          this.$tr(
            'Devices without the token will stop recording immediately. Has every device been given the token?'
          ),
          {
            title: this.$tr('Require token for watcher traffic'),
            okVariant: 'danger',
            okTitle: this.$tr('Require token'),
            cancelTitle: this.$tr('Cancel'),
            centered: true,
          }
        );
        if (!confirmed) {
          await this.load();
          return;
        }
      }

      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.saveFleetAuthConfig({
          require_watcher_token: Boolean(enabled),
        });
        this.success = this.$tr('Saved');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
        await this.load();
      } finally {
        this.saving = false;
      }
    },
    async reveal() {
      if (this.revealedToken) {
        this.revealedToken = '';
        return;
      }
      try {
        this.revealedToken = await this.fleetStore.revealFleetToken();
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      }
    },
    async copyToken() {
      try {
        await navigator.clipboard.writeText(this.revealedToken);
        this.success = this.$tr('Copied');
      } catch {
        this.error = this.$tr('Unable to save');
      }
    },
    async rotate() {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'A new token invalidates the old one. Every device has to be given the new token before it can send data again.'
        ),
        {
          title: this.$tr('Generate new token'),
          okVariant: 'danger',
          okTitle: this.$tr('Generate new token'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) {
        return;
      }
      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.saveFleetAuthConfig({ rotate_token: true });
        this.revealedToken = '';
        this.success = this.$tr('Saved');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
