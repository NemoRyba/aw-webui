<template lang="pug">
div.watcher-update-settings
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Watcher updates') }}
      small.text-muted
        | {{ $tr('Roll out new watcher builds to all fleet devices from here.') }}
    b-button.mt-2.mt-sm-0(size="sm" variant="outline-secondary" @click="load" :disabled="loading")
      | {{ loading ? $tr('Loading...') : $tr('Refresh') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger")
    | {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success")
    | {{ success }}

  //- Active package
  b-card.mt-3(no-body)
    b-card-body.py-2
      div.d-sm-flex.justify-content-between.align-items-center
        div
          div.font-weight-bold {{ $tr('Embedded watcher package') }}
          div.small.text-muted(v-if="manifest && manifest.available")
            b-badge.mr-2(:variant="activeSource === 'uploaded' ? 'info' : 'secondary'")
              | {{ activeSource === 'uploaded' ? $tr('Uploaded package') : $tr('Embedded package') }}
            span.mr-3(:title="manifest.version")
              | {{ $tr('Version') }}: 
              code {{ shortVersion(manifest.version) }}
            span.mr-3(v-if="manifest.created")
              | {{ $tr('Built') }}: {{ formatTimestamp(manifest.created) }}
            span(v-if="manifest.payload_bytes")
              | {{ $tr('Size') }}: {{ formatBytes(manifest.payload_bytes) }}
          div.small.text-danger(v-else)
            | {{ $tr('No watcher package available. Upload one below or run rebuild-watchers-setup.cmd and then rebuild-server-setup.cmd.') }}
        div.mt-2.mt-sm-0
          b-form-checkbox(
            switch
            :checked="autoUpdateEnabled"
            :disabled="loading || savingConfig"
            @change="saveAutoUpdate($event)"
          )
            | {{ $tr('Automatic watcher updates') }}
      div.small.mt-1(v-if="activeSource === 'uploaded'")
        span.text-muted(v-if="embeddedInfo")
          | {{ $tr('Embedded in server build') }}: 
          code {{ shortVersion(embeddedInfo.version) }}
        span.text-muted(v-else)
          | {{ $tr('No package embedded in the server build') }}
        b-button.ml-2(
          size="sm"
          variant="outline-danger"
          :disabled="removing || uploading"
          @click="removeUploaded"
        )
          | {{ removing ? $tr('Loading...') : $tr('Remove uploaded package') }}
      div.small.text-muted.mt-1
        | {{ $tr('Devices check for updates about once a minute and install them silently in the background.') }}

  b-alert.mt-2(:show="embeddedNewerThanUploaded" variant="warning")
    | {{ $tr('The package embedded in this server build is newer than the uploaded one. Remove the uploaded package to distribute the embedded one.') }}

  //- Upload a new package (distribute without rebuilding the server)
  b-card.mt-3(no-body)
    b-card-body.py-2
      div.font-weight-bold {{ $tr('Distribute a new watcher package') }}
      div.small.text-muted.mb-2
        | {{ $tr('Upload the ActivityWatch-Fleet-Watchers-Update.zip produced by rebuild-watchers-setup.cmd (payload.zip works too). The server distributes it immediately - no server rebuild needed.') }}
      div.d-sm-flex.align-items-center
        b-form-file.mr-sm-2(
          v-model="uploadFile"
          accept=".zip"
          :placeholder="$tr('Choose zip file...')"
          :browse-text="$tr('Browse')"
          :disabled="uploading"
        )
        b-button.mt-2.mt-sm-0.text-nowrap(
          variant="primary"
          :disabled="!uploadFile || uploading"
          @click="upload"
        )
          | {{ uploading ? $tr('Uploading...') : $tr('Upload and distribute') }}
      b-progress.mt-2(v-if="uploading" :value="uploadProgress" :max="100" show-progress animated)

  //- Manual rollout: pick devices and push the package now
  div.d-sm-flex.justify-content-between.align-items-center.mt-4.mb-2
    div
      div.font-weight-bold {{ $tr('Update devices manually') }}
      div.small.text-muted
        | {{ $tr('Select devices and update them now - independent of the automatic switch. The device installs within about a minute.') }}
    div.mt-2.mt-sm-0.text-nowrap
      b-button.mr-2(
        size="sm"
        variant="outline-secondary"
        :disabled="!devices.length || requesting"
        @click="toggleSelectAll"
      )
        | {{ allSelected ? $tr('Clear selection') : $tr('Select all') }}
      b-button.mr-2(
        size="sm"
        variant="primary"
        :disabled="!selectedHostnames.length || requesting || !packageAvailable"
        @click="requestUpdate(selectedHostnames)"
      )
        | {{ $tr('Update selected') }} ({{ selectedHostnames.length }})
      b-button(
        size="sm"
        variant="outline-primary"
        :disabled="!devices.length || requesting || !packageAvailable"
        @click="requestUpdate(allHostnames)"
      )
        | {{ $tr('Update all') }}

  b-alert.mt-2(:show="Boolean(pendingCount)" variant="info")
    | {{ $tr('Waiting for devices to pick up the update') }}: {{ pendingCount }}
    b-button.ml-2(
      size="sm"
      variant="outline-secondary"
      :disabled="requesting"
      @click="cancelPending"
    )
      | {{ $tr('Cancel pending updates') }}

  //- Per-device status
  div.aw-loading.mt-3(v-if="loading && !devices.length")
    | {{ $tr('Loading...') }}
  b-table.mt-2(
    v-else
    small
    hover
    responsive="lg"
    :items="devices"
    :fields="fields"
    :empty-text="$tr('No devices have reported yet')"
    show-empty
  )
    template(v-slot:head(selected)="")
      b-form-checkbox(
        :checked="allSelected"
        :disabled="!devices.length || requesting"
        @change="toggleSelectAll"
      )

    template(v-slot:cell(selected)="data")
      b-form-checkbox(
        :checked="isSelected(data.item.hostname)"
        :disabled="requesting"
        @change="toggleDevice(data.item.hostname, $event)"
      )

    template(v-slot:cell(hostname)="data")
      div.font-weight-bold {{ data.item.hostname }}

    template(v-slot:cell(version)="data")
      code(v-if="data.item.version" :title="data.item.version") {{ shortVersion(data.item.version) }}
      span.text-muted(v-else) -

    template(v-slot:cell(state)="data")
      b-badge(:variant="stateVariant(data.item)")
        | {{ stateLabel(data.item) }}
      b-badge.ml-1(v-if="data.item.update_requested" variant="primary")
        | {{ data.item.request_acknowledged ? $tr('Update running') : $tr('Update requested') }}
      div.small.text-muted(v-if="messageLabel(data.item)")
        | {{ messageLabel(data.item) }}

    template(v-slot:cell(reported_at)="data")
      span(v-if="data.item.reported_at") {{ formatTimestamp(data.item.reported_at) }}
      span.text-muted(v-else) -

    template(v-slot:cell(actions)="data")
      b-button(
        size="sm"
        variant="outline-primary"
        :disabled="requesting || !packageAvailable"
        @click="requestUpdate([data.item.hostname])"
      )
        | {{ $tr('Update now') }}

  div.small.text-muted.mt-1
    | {{ $tr('Devices still running a watcher build from before the auto-update feature never poll the server - they show "Never reported" and need the installer run on them once by hand.') }}
</template>

<script lang="ts">
import moment from 'moment';
import { useFleetStore } from '~/stores/fleet';

export default {
  name: 'WatcherUpdateSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      loading: false,
      savingConfig: false,
      uploading: false,
      uploadProgress: 0,
      uploadFile: null,
      removing: false,
      requesting: false,
      selected: [],
      error: '',
      success: '',
      refreshTimer: null,
    };
  },
  computed: {
    updateInfo() {
      return this.fleetStore.watcherUpdate;
    },
    manifest() {
      return this.updateInfo?.manifest || null;
    },
    devices() {
      return this.updateInfo?.devices || [];
    },
    activeSource() {
      return this.manifest?.source || '';
    },
    uploadedInfo() {
      return this.manifest?.uploaded || null;
    },
    embeddedInfo() {
      return this.manifest?.embedded || null;
    },
    embeddedNewerThanUploaded() {
      if (this.activeSource !== 'uploaded' || !this.uploadedInfo || !this.embeddedInfo) {
        return false;
      }
      const uploaded = moment(this.uploadedInfo.created);
      const embedded = moment(this.embeddedInfo.created);
      return uploaded.isValid() && embedded.isValid() && embedded.isAfter(uploaded);
    },
    autoUpdateEnabled() {
      if (this.fleetStore.watcherUpdateConfig) {
        return Boolean(this.fleetStore.watcherUpdateConfig.auto_update_enabled);
      }
      return Boolean(this.manifest?.auto_update_enabled);
    },
    packageAvailable() {
      return Boolean(this.manifest && this.manifest.available);
    },
    allHostnames() {
      return this.devices.map(device => device.hostname);
    },
    selectedHostnames() {
      // Devices can disappear between refreshes; never send a stale name.
      const present = new Set(this.allHostnames);
      return this.selected.filter(hostname => present.has(hostname));
    },
    allSelected() {
      return this.devices.length > 0 && this.selectedHostnames.length === this.devices.length;
    },
    pendingCount() {
      return this.devices.filter(device => device.update_requested).length;
    },
    fields() {
      return [
        { key: 'selected', label: '', sortable: false, thStyle: { width: '2.5rem' } },
        { key: 'hostname', label: this.$tr('Device'), sortable: true },
        { key: 'version', label: this.$tr('Reported version') },
        { key: 'state', label: this.$tr('Status'), sortable: false },
        { key: 'reported_at', label: this.$tr('Last report'), sortable: true },
        { key: 'actions', label: '', sortable: false },
      ];
    },
  },
  async mounted() {
    await this.load();
    // Keep the table live while an update rolls out across the fleet.
    this.refreshTimer = setInterval(() => {
      this.load({ silent: true });
    }, 30000);
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
        await Promise.all([
          this.fleetStore.loadWatcherUpdateDevices(),
          this.fleetStore.loadWatcherUpdateConfig(),
        ]);
      } catch (error) {
        if (!silent) {
          this.error =
            error?.response?.data?.message || this.$tr('Unable to load watcher update status');
        }
      } finally {
        if (!silent) {
          this.loading = false;
        }
      }
    },
    async saveAutoUpdate(enabled) {
      this.savingConfig = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.saveWatcherUpdateConfig({ auto_update_enabled: Boolean(enabled) });
        this.success = enabled
          ? this.$tr('Automatic watcher updates enabled')
          : this.$tr('Automatic watcher updates disabled');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
        // reload so the switch snaps back to the server state
        await this.load({ silent: true });
      } finally {
        this.savingConfig = false;
      }
    },
    async upload() {
      if (!this.uploadFile || this.uploading) {
        return;
      }
      this.uploading = true;
      this.uploadProgress = 0;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.uploadWatcherUpdatePackage(this.uploadFile, pct => {
          this.uploadProgress = pct;
        });
        this.uploadFile = null;
        await this.load({ silent: true });
        this.success = this.$tr(
          'Watcher package uploaded - devices will pick it up within a minute once auto-update is enabled'
        );
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Upload failed');
      } finally {
        this.uploading = false;
      }
    },
    async removeUploaded() {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Remove the uploaded package and fall back to the package embedded in the server build?'
        ),
        {
          title: this.$tr('Remove uploaded package'),
          okVariant: 'danger',
          okTitle: this.$tr('Remove'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) {
        return;
      }
      this.removing = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.deleteWatcherUpdatePackage();
        await this.load({ silent: true });
        this.success = this.$tr('Uploaded package removed');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.removing = false;
      }
    },
    isSelected(hostname) {
      return this.selected.includes(hostname);
    },
    toggleDevice(hostname, checked) {
      if (checked) {
        if (!this.selected.includes(hostname)) {
          this.selected = [...this.selected, hostname];
        }
      } else {
        this.selected = this.selected.filter(name => name !== hostname);
      }
    },
    toggleSelectAll() {
      this.selected = this.allSelected ? [] : [...this.allHostnames];
    },
    async requestUpdate(hostnames) {
      if (!hostnames || !hostnames.length || this.requesting) {
        return;
      }
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Install the current watcher package on {n} device(s) now? The watchers restart briefly, so a short gap in the recording is expected.'
        ).replace('{n}', String(hostnames.length)),
        {
          title: this.$tr('Update devices manually'),
          okTitle: this.$tr('Update now'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) {
        return;
      }

      this.requesting = true;
      this.error = '';
      this.success = '';
      try {
        const result = await this.fleetStore.requestWatcherUpdate(hostnames);
        this.selected = [];
        await this.load({ silent: true });
        this.success = this.$tr(
          'Update queued for {n} device(s) - they install it within about a minute.'
        ).replace('{n}', String((result.requested || []).length));
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.requesting = false;
      }
    },
    async cancelPending() {
      const pendingHosts = this.devices
        .filter(device => device.update_requested)
        .map(device => device.hostname);
      if (!pendingHosts.length) {
        return;
      }
      this.requesting = true;
      this.error = '';
      this.success = '';
      try {
        await this.fleetStore.cancelWatcherUpdate(pendingHosts);
        await this.load({ silent: true });
        this.success = this.$tr('Pending updates cancelled');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save');
      } finally {
        this.requesting = false;
      }
    },
    shortVersion(version) {
      return version ? String(version).slice(0, 12) : '-';
    },
    formatTimestamp(value) {
      if (!value) {
        return '-';
      }
      const parsed = moment(value);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value);
    },
    formatBytes(bytes) {
      const mb = Number(bytes) / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    },
    stateLabel(row) {
      if (!row.version) {
        return this.$tr('Never reported');
      }
      if (row.updating) {
        return this.$tr('Updating');
      }
      return row.up_to_date ? this.$tr('Up to date') : this.$tr('Outdated');
    },
    stateVariant(row) {
      if (!row.version) {
        return 'secondary';
      }
      if (row.updating) {
        return 'info';
      }
      return row.up_to_date ? 'success' : 'warning';
    },
    messageLabel(row) {
      const messages = {
        up_to_date: '',
        update_starting: this.$tr('Update starting'),
        manual_update_starting: this.$tr('Manual update starting'),
        manual_update_recently_attempted_waiting: this.$tr(
          'Manual update failed recently, retrying shortly'
        ),
        update_recently_attempted_waiting: this.$tr('Update recently attempted, waiting'),
        update_available_auto_update_disabled: this.$tr('Update available, auto-update disabled'),
        no_package_on_server: this.$tr('No package on server'),
        never_reported: this.$tr('Never reported - run the watcher installer on this device once'),
      };
      if (row.message in messages) {
        return messages[row.message];
      }
      return row.message || '';
    },
  },
};
</script>
