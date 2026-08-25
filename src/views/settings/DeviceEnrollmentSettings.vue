<template lang="pug">
div.device-enrollment-settings
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0
        | {{ $tr('Devices') }}
        b-badge.ml-2(v-if="pendingCount" variant="warning") {{ pendingCount }}
      small.text-muted
        | {{ $tr('Devices register themselves when the watchers start. Approve one and it can send data - no token has to be carried to it.') }}
    b-button.mt-2.mt-sm-0(size="sm" variant="outline-secondary" :disabled="loading" @click="load")
      | {{ loading ? $tr('Loading...') : $tr('Refresh') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger") {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success") {{ success }}

  b-alert.mt-3(:show="pendingCount > 0" variant="warning")
    | {{ $tr('Devices are waiting for approval. Until you approve them they record locally but send nothing.') }}

  b-alert.mt-3(:show="!enforcementEnabled" variant="info")
    | {{ $tr('Token enforcement is off, so unapproved devices can still send data. Approve every device you expect, then switch enforcement on under Fleet-Zugriffstoken.') }}

  div.mt-3.text-nowrap(v-if="devices.length")
    b-button.mr-2(
      size="sm"
      variant="outline-secondary"
      :disabled="busy"
      @click="toggleSelectAll"
    )
      | {{ allSelected ? $tr('Clear selection') : $tr('Select all') }}
    b-button.mr-2(
      size="sm"
      variant="success"
      :disabled="!selected.length || busy"
      @click="setStatus(selected, 'approved')"
    )
      | {{ $tr('Approve') }} ({{ selected.length }})
    b-button.mr-2(
      size="sm"
      variant="outline-danger"
      :disabled="!selected.length || busy"
      @click="setStatus(selected, 'rejected')"
    )
      | {{ $tr('Reject') }}
    b-button(
      size="sm"
      variant="outline-secondary"
      :disabled="!selected.length || busy"
      @click="removeDevices(selected)"
    )
      | {{ $tr('Remove') }}

  div.aw-loading.mt-3(v-if="loading && !devices.length")
    | {{ $tr('Loading...') }}
  b-table.mt-2(
    v-else
    small
    hover
    responsive="lg"
    :items="devices"
    :fields="fields"
    :empty-text="$tr('No devices have registered yet')"
    show-empty
  )
    template(v-slot:head(selected)="")
      b-form-checkbox(:checked="allSelected" :disabled="!devices.length || busy" @change="toggleSelectAll")

    template(v-slot:cell(selected)="data")
      b-form-checkbox(:checked="isSelected(data.item.id)" :disabled="busy" @change="toggleDevice(data.item.id, $event)")

    template(v-slot:cell(hostname)="data")
      div.font-weight-bold {{ data.item.hostname }}
      div.small.text-muted
        | {{ data.item.address }}
        span.ml-2
          code {{ data.item.fingerprint }}

    template(v-slot:cell(status)="data")
      b-badge(:variant="statusVariant(data.item.status)") {{ statusLabel(data.item.status) }}
      div.small.text-muted(v-if="data.item.approved_by")
        | {{ $tr('Approved by') }} {{ data.item.approved_by }}

    template(v-slot:cell(first_seen)="data")
      span {{ formatTimestamp(data.item.first_seen) }}

    template(v-slot:cell(last_seen)="data")
      span {{ formatTimestamp(data.item.last_seen) }}

    template(v-slot:cell(actions)="data")
      b-button.mr-1(
        v-if="data.item.status !== 'approved'"
        size="sm"
        variant="success"
        :disabled="busy"
        @click="setStatus([data.item.id], 'approved')"
      )
        | {{ $tr('Approve') }}
      b-button(
        v-if="data.item.status === 'approved'"
        size="sm"
        variant="outline-danger"
        :disabled="busy"
        @click="setStatus([data.item.id], 'rejected')"
      )
        | {{ $tr('Revoke') }}

  div.small.text-muted.mt-1
    | {{ $tr('The fingerprint identifies the key the device generated. If two rows share a hostname, compare it before approving.') }}
</template>

<script lang="ts">
import moment from 'moment';
import { useFleetStore } from '~/stores/fleet';

export default {
  name: 'DeviceEnrollmentSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      loading: false,
      busy: false,
      selected: [],
      error: '',
      success: '',
      refreshTimer: null,
    };
  },
  computed: {
    enrollment() {
      return this.fleetStore.deviceEnrollment;
    },
    devices() {
      return this.enrollment?.devices || [];
    },
    pendingCount() {
      return this.enrollment?.pending || 0;
    },
    enforcementEnabled() {
      return Boolean(this.enrollment?.enforcement_enabled);
    },
    allSelected() {
      return this.devices.length > 0 && this.selected.length === this.devices.length;
    },
    fields() {
      return [
        { key: 'selected', label: '', sortable: false, thStyle: { width: '2.5rem' } },
        { key: 'hostname', label: this.$tr('Device'), sortable: true },
        { key: 'status', label: this.$tr('Status'), sortable: true },
        { key: 'first_seen', label: this.$tr('First seen'), sortable: true },
        { key: 'last_seen', label: this.$tr('Last seen'), sortable: true },
        { key: 'actions', label: '', sortable: false },
      ];
    },
  },
  async mounted() {
    await this.load();
    // Keep the pending count live while devices are being rolled out.
    this.refreshTimer = setInterval(() => this.load({ silent: true }), 30000);
  },
  beforeDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },
  methods: {
    async load({ silent = false } = {}) {
      if (!silent) {
        this.loading = true;
        this.error = '';
        this.success = '';
      }
      try {
        await this.fleetStore.loadDeviceEnrollment();
      } catch (error) {
        if (!silent) {
          this.error = error?.response?.data?.message || this.$tr('Unable to load');
        }
      } finally {
        if (!silent) this.loading = false;
      }
    },
    isSelected(id) {
      return this.selected.includes(id);
    },
    toggleDevice(id, checked) {
      this.selected = checked
        ? [...new Set([...this.selected, id])]
        : this.selected.filter(value => value !== id);
    },
    toggleSelectAll() {
      this.selected = this.allSelected ? [] : this.devices.map(device => device.id);
    },
    async setStatus(ids, newStatus) {
      if (!ids.length || this.busy) return;
      if (newStatus === 'rejected') {
        const confirmed = await this.$bvModal.msgBoxConfirm(
          this.$tr(
            'Revoke {n} device(s)? They stop being able to send data as soon as token enforcement is on.'
          ).replace('{n}', String(ids.length)),
          {
            title: this.$tr('Revoke'),
            okVariant: 'danger',
            okTitle: this.$tr('Revoke'),
            cancelTitle: this.$tr('Cancel'),
            centered: true,
          }
        );
        if (!confirmed) return;
      }
      this.busy = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.setDeviceEnrollment(ids, newStatus);
        this.selected = [];
        await this.load({ silent: true });
        this.success =
          newStatus === 'approved' ? this.$tr('Devices approved') : this.$tr('Devices revoked');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.busy = false;
      }
    },
    async removeDevices(ids) {
      if (!ids.length || this.busy) return;
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Remove {n} device(s) from the list? A device that is still running will register again.'
        ).replace('{n}', String(ids.length)),
        {
          title: this.$tr('Remove'),
          okVariant: 'danger',
          okTitle: this.$tr('Remove'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) return;
      this.busy = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.deleteEnrolledDevices(ids);
        this.selected = [];
        await this.load({ silent: true });
        this.success = this.$tr('Devices removed');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.busy = false;
      }
    },
    statusLabel(value) {
      const map = {
        pending: this.$tr('Waiting for approval'),
        approved: this.$tr('Approved'),
        rejected: this.$tr('Rejected'),
      };
      return map[value] || value;
    },
    statusVariant(value) {
      return { pending: 'warning', approved: 'success', rejected: 'danger' }[value] || 'secondary';
    },
    formatTimestamp(value) {
      if (!value) return '-';
      const parsed = moment(value);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value);
    },
  },
};
</script>
