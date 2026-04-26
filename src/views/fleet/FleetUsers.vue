<template lang="pug">
div
  fleet-nav

  div.d-flex.align-items-center.mb-3
    div
      h3.mb-0 {{ $tr('Users') }}
      div.text-muted.small
        | {{ $tr('Users grouped across all reported devices') }}
    b-button.ml-auto(size="sm" variant="outline-dark" @click="refresh")
      | {{ $tr('Refresh') }}

  b-card
    div.d-flex.align-items-center.mb-3
      h5.mb-0 {{ $tr('Users') }}
      column-order-editor.ml-auto(
        :table-key="tableKey"
        :fields="defaultFields"
      )
    b-table(
      small
      hover
      responsive="lg"
      :items="users"
      :fields="fields"
      :empty-text="$tr('No users found')"
    )
      template(v-slot:cell(username)="data")
        router-link(:to="'/fleet/users/' + data.item.username")
          | {{ data.item.username }}
      template(v-slot:cell(devices)="data")
        | {{ data.item.devices.join(', ') }}
      template(v-slot:cell(last_seen)="data")
        span(v-if="data.item.last_seen") {{ data.item.last_seen | friendlytime }}
        span(v-else) —
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';
import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'FleetUsers',
  components: {
    'column-order-editor': () => import('~/components/ColumnOrderEditor.vue'),
    'fleet-nav': () => import('~/components/FleetNav.vue'),
  },
  data() {
    return {
      fleetStore: useFleetStore(),
      settingsStore: useSettingsStore(),
      tableKey: 'fleet-users-list',
    };
  },
  computed: {
    defaultFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'devices', label: this.$tr('Devices') },
        { key: 'active_sessions', label: this.$tr('Live sessions'), sortable: true },
        { key: 'last_seen', label: this.$tr('Last seen'), sortable: true },
      ];
    },
    fields() {
      return orderFields(this.defaultFields, this.settingsStore.columnOrdersData?.[this.tableKey]);
    },
    users() {
      return this.fleetStore.users;
    },
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      await this.fleetStore.loadUsers();
    },
  },
};
</script>
