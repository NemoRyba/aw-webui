<template lang="pug">
div.redmine-settings
  //- Same layout convention as the LDAP panel: heading, then the enable
  //- switch top left, fields below, actions bottom left with Save first.
  h5.mt-1.mb-2 {{ $tr('Redmine read-only comparison') }}
  p.text-muted.small.mb-2
    | {{ $tr('Uses only read-only SELECT queries against the Redmine database.') }}
  b-form-checkbox.mb-3(
    switch
    v-model="draft.enabled"
    :disabled="loading || saving"
  )
    | {{ draft.enabled ? $tr('Enabled') : $tr('Disabled') }}

  b-alert.mt-3(:show="Boolean(error)" variant="danger")
    | {{ error }}
  b-alert.mt-3(:show="Boolean(success)" variant="success")
    | {{ success }}

  div.row.mt-3
    div.col-md-4
      b-form-group(:label="$tr('Driver')" label-for="redmine-driver")
        b-form-select#redmine-driver(
          v-model="draft.driver"
          size="sm"
          :options="driverOptions"
        )
    div.col-md-4
      b-form-group(:label="$tr('Host')" label-for="redmine-host")
        b-form-input#redmine-host(v-model.trim="draft.host" size="sm" placeholder="redmine-db.local")
    div.col-md-4
      b-form-group(:label="$tr('Port')" label-for="redmine-port")
        b-form-input#redmine-port(v-model.number="draft.port" type="number" min="1" max="65535" size="sm")

    div.col-md-4
      b-form-group(:label="$tr('Database')" label-for="redmine-database")
        b-form-input#redmine-database(v-model.trim="draft.database" size="sm" placeholder="redmine")
    div.col-md-4
      b-form-group(:label="$tr('Username')" label-for="redmine-username")
        b-form-input#redmine-username(v-model.trim="draft.username" size="sm" autocomplete="username")
    div.col-md-4
      b-form-group(:label="$tr('Password')" label-for="redmine-password")
        b-form-input#redmine-password(
          v-model="passwordInput"
          type="password"
          size="sm"
          autocomplete="new-password"
          :placeholder="draft.password_present ? $tr('Saved password unchanged') : ''"
        )
        b-form-checkbox.mt-2(
          v-model="draft.clear_password"
          v-if="draft.password_present"
          size="sm"
        )
          | {{ $tr('Clear saved password') }}

    div.col-md-4
      b-form-group(:label="$tr('Table prefix')" label-for="redmine-table-prefix")
        b-form-input#redmine-table-prefix(v-model.trim="draft.table_prefix" size="sm" placeholder="")
    div.col-md-4
      b-form-group(:label="$tr('mysql CLI path')" label-for="redmine-cli-path")
        b-form-input#redmine-cli-path(v-model.trim="draft.mysql_cli_path" size="sm" placeholder="mysql")
    div.col-md-4
      b-form-group(:label="$tr('Connection timeout')" label-for="redmine-timeout")
        b-form-input#redmine-timeout(v-model.number="draft.connect_timeout" type="number" min="1" max="120" size="sm")

  div.redmine-settings-actions
    b-button(
      size="sm"
      variant="primary"
      @click="save"
      :disabled="loading || saving"
    )
      | {{ saving ? $tr('Saving...') : $tr('Save Redmine settings') }}
    b-button(
      size="sm"
      variant="outline-secondary"
      @click="test"
      :disabled="loading || testing"
    )
      | {{ testing ? $tr('Testing...') : $tr('Test Redmine read access') }}
</template>

<script lang="ts">
import { useFleetStore } from '~/stores/fleet';

function defaultDraft() {
  return {
    enabled: false,
    driver: 'auto',
    host: '',
    port: 3306,
    database: 'redmine',
    username: '',
    table_prefix: '',
    mysql_cli_path: 'mysql',
    connect_timeout: 10,
    password_present: false,
    clear_password: false,
  };
}

export default {
  name: 'RedmineSettings',
  data() {
    return {
      fleetStore: useFleetStore(),
      draft: defaultDraft(),
      passwordInput: '',
      loading: false,
      saving: false,
      testing: false,
      error: '',
      success: '',
    };
  },
  computed: {
    driverOptions() {
      return [
        { value: 'auto', text: this.$tr('Automatic') },
        { value: 'pymysql', text: 'PyMySQL' },
        { value: 'mysql-connector', text: 'mysql-connector-python' },
        { value: 'mysql-cli', text: 'mysql CLI' },
      ];
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    applyConfig(config) {
      this.draft = {
        ...defaultDraft(),
        ...(config || {}),
        clear_password: false,
      };
      this.passwordInput = '';
    },
    payload() {
      const payload = { ...this.draft };
      if (this.passwordInput) {
        payload.password = this.passwordInput;
        payload.password_present = false;
      }
      return payload;
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const config = await this.fleetStore.loadRedmineConfig();
        this.applyConfig(config);
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to load Redmine settings');
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        const config = await this.fleetStore.saveRedmineConfig(this.payload());
        this.applyConfig(config);
        this.success = this.$tr('Redmine settings saved');
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Unable to save Redmine settings');
      } finally {
        this.saving = false;
      }
    },
    async test() {
      this.testing = true;
      this.error = '';
      this.success = '';
      try {
        const result = await this.fleetStore.testRedmineConfig(this.payload());
        if (result.ok) {
          this.success = result.message || this.$tr('Redmine read access succeeded');
        } else {
          this.error = result.message || this.$tr('Redmine read access failed');
        }
      } catch (error) {
        this.error = error?.response?.data?.message || this.$tr('Redmine read access failed');
      } finally {
        this.testing = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.redmine-settings-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0.5rem;
}
</style>
