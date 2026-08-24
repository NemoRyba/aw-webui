<template lang="pug">
div.redmine-user-mapping-settings
  div.d-sm-flex.justify-content-between.align-items-start
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $tr('Redmine user mapping') }}
      small.text-muted
        | {{ $tr('Verify Windows users against Redmine users and override the match when needed.') }}
    b-button.mt-2.mt-sm-0(size="sm" variant="outline-secondary" @click="load" :disabled="loading")
      | {{ loading ? $tr('Loading...') : $tr('Refresh') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger")
    | {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success")
    | {{ success }}
  b-alert.mt-3(:show="Boolean(message)" variant="warning")
    | {{ message }}

  div.aw-loading.mt-3(v-if="loading")
    | {{ $tr('Loading...') }}

  b-table.mt-3(
    v-else-if="mappings"
    small
    hover
    responsive="lg"
    :items="mappingRows"
    :fields="fields"
    :empty-text="$tr('No users found')"
  )
    template(v-slot:cell(username)="data")
      div.font-weight-bold {{ data.item.username }}
      div.small.text-muted(v-if="data.item.display_name")
        | {{ data.item.display_name }}

    template(v-slot:cell(email)="data")
      span(v-if="data.item.email") {{ data.item.email }}
      span.text-muted(v-else) -

    template(v-slot:cell(automatic_redmine_user)="data")
      span(v-if="data.item.automatic_redmine_user")
        | {{ formatRedmineUser(data.item.automatic_redmine_user) }}
      span.text-muted(v-else) -

    template(v-slot:cell(override_redmine_user_id)="data")
      b-form-select(
        size="sm"
        :value="overrideValue(data.item)"
        :options="redmineUserOptions"
        :disabled="loading || savingUsername === data.item.username || redmineUserOptions.length <= 1"
        @change="saveOverride(data.item.username, $event)"
      )

    template(v-slot:cell(redmine_user)="data")
      span(v-if="data.item.redmine_user")
        | {{ formatRedmineUser(data.item.redmine_user) }}
      span.text-muted(v-else) -

    template(v-slot:cell(status)="data")
      b-badge(:variant="statusVariant(data.item)")
        | {{ statusLabel(data.item) }}
      div.small.text-muted.redmine-mapping-reason(v-if="data.item.match_reason")
        | {{ data.item.match_reason }}
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';

export default {
  name: 'RedmineUserMappingSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      loading: false,
      savingUsername: '',
      error: '',
      success: '',
    };
  },
  computed: {
    mappings() {
      return this.fleetStore.redmineMappings;
    },
    message() {
      if (!this.mappings || this.mappings.error) {
        return '';
      }
      if (!this.mappings.enabled) {
        return this.mappings.message || this.$tr('Redmine integration is disabled');
      }
      return this.mappings.message || '';
    },
    mappingRows() {
      return this.mappings?.users || [];
    },
    fields() {
      return [
        { key: 'username', label: this.$tr('Windows user'), sortable: true },
        { key: 'email', label: this.$tr('LDAP email'), sortable: true },
        { key: 'automatic_redmine_user', label: this.$tr('Automatic Redmine match') },
        { key: 'override_redmine_user_id', label: this.$tr('Manual override') },
        { key: 'redmine_user', label: this.$tr('Effective Redmine user') },
        { key: 'status', label: this.$tr('Reason'), sortable: true },
      ];
    },
    redmineUserOptions() {
      const users = [...(this.mappings?.redmine_users || [])].sort((left, right) =>
        this.formatRedmineUser(left).localeCompare(this.formatRedmineUser(right))
      );
      return [
        { value: '', text: this.$tr('Automatic by email') },
        ...users.map(user => ({
          value: String(user.id),
          text: this.formatRedmineUser(user),
        })),
      ];
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
        const mappings = await this.fleetStore.loadRedmineMappings();
        if (mappings.error) {
          this.error = mappings.error;
        }
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to load Redmine mappings');
      } finally {
        this.loading = false;
      }
    },
    async saveOverride(username, value) {
      const redmineUserId = value ? Number(value) : null;
      this.savingUsername = username;
      this.error = '';
      this.success = '';
      try {
        const mappings = await this.fleetStore.saveRedmineMapping(username, redmineUserId);
        if (mappings.error) {
          this.error = mappings.error;
        } else {
          this.success = this.$tr('Redmine mapping saved');
        }
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save Redmine mapping');
      } finally {
        this.savingUsername = '';
      }
    },
    overrideValue(row) {
      return row.override_redmine_user_id ? String(row.override_redmine_user_id) : '';
    },
    formatRedmineUser(user) {
      if (!user) {
        return '-';
      }
      const name = user.name || [user.firstname, user.lastname].filter(Boolean).join(' ');
      const details = [name, user.mail].filter(Boolean).join(' - ');
      return details ? `${user.login} (${details})` : user.login;
    },
    statusLabel(row) {
      if (row.status === 'matched' && row.match_source === 'manual') {
        return this.$tr('manual override');
      }
      if (row.status === 'matched' && row.match_source === 'email') {
        return this.$tr('matched by email');
      }
      return this.$tr(row.status);
    },
    statusVariant(row) {
      if (row.status === 'matched') {
        return row.match_source === 'manual' ? 'primary' : 'success';
      }
      const variants = {
        missing_email: 'warning',
        no_redmine_user: 'warning',
        manual_missing: 'danger',
        not_loaded: 'secondary',
      };
      return variants[row.status] || 'secondary';
    },
  },
};
</script>

<style scoped lang="scss">
.redmine-mapping-reason {
  max-width: 22rem;
  overflow-wrap: anywhere;
}
</style>
