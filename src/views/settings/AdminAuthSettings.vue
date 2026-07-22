<template lang="pug">
div.admin-auth-settings
  h5.mb-2 {{ $tr('Authentication and LDAP') }}
  p.text-muted.mb-3
    | {{ $tr('Connect a Windows domain through LDAP. New LDAP users are created as non-admin users after their first successful login.') }}

  b-alert(:show="Boolean(error)" variant="danger")
    | {{ error }}
  b-alert(:show="Boolean(success)" variant="success")
    | {{ success }}

  div.admin-auth-grid
    div.admin-auth-panel
      h6.mb-3 {{ $tr('LDAP integration') }}
      b-form-checkbox(v-model="ldapDraft.enabled" switch class="mb-3")
        | {{ $tr('Enable LDAP login') }}

      b-form-group(:label="$tr('LDAP server URL')" label-for="ldap-server-url")
        b-form-input#ldap-server-url(
          v-model.trim="ldapDraft.server_url"
          placeholder="ldap://dc.example.local or ldaps://dc.example.local"
        )

      b-form-group(:label="$tr('Windows domain')" label-for="ldap-default-domain")
        b-form-input#ldap-default-domain(
          v-model.trim="ldapDraft.default_domain"
          placeholder="example.local"
        )
        small.text-muted
          | {{ $tr('Used when users type only their short Windows username.') }}

      b-form-group(:label="$tr('Base DN')" label-for="ldap-base-dn")
        b-form-input#ldap-base-dn(
          v-model.trim="ldapDraft.base_dn"
          placeholder="DC=example,DC=local"
        )

      b-form-group(:label="$tr('Bind DN')" label-for="ldap-bind-dn")
        b-form-input#ldap-bind-dn(
          v-model.trim="ldapDraft.bind_dn"
          placeholder="CN=ActivityWatch LDAP,OU=Service Accounts,DC=example,DC=local"
        )
        small.text-muted
          | {{ $tr('Optional service account used to find the user DN before checking the user password.') }}

      b-form-group(:label="$tr('Bind password')" label-for="ldap-bind-password")
        b-form-input#ldap-bind-password(
          v-model="bindPasswordInput"
          type="password"
          autocomplete="new-password"
          :placeholder="ldapDraft.bind_password_present ? $tr('Saved password unchanged') : ''"
        )
        b-form-checkbox.mt-2(v-model="ldapDraft.clear_bind_password" v-if="ldapDraft.bind_password_present")
          | {{ $tr('Clear saved bind password') }}

      b-form-group(:label="$tr('User search filter')" label-for="ldap-user-search-filter")
        b-form-textarea#ldap-user-search-filter(
          v-model.trim="ldapDraft.user_search_filter"
          rows="3"
        )
        small.text-muted
          | {{ $tr('Supported placeholders: {username}, {raw_username}, {upn}.') }}

      div.admin-auth-actions
        b-button(
          variant="primary"
          size="sm"
          @click="saveLdapSettings"
          :disabled="saving"
        )
          | {{ saving ? $tr('Saving...') : $tr('Save LDAP settings') }}

    div.admin-auth-panel
      h6.mb-3 {{ $tr('Test LDAP login') }}
      b-form-group(:label="$tr('Test username')" label-for="ldap-test-username")
        b-form-input#ldap-test-username(
          v-model.trim="testUsername"
          autocomplete="username"
        )
      b-form-group(:label="$tr('Test password')" label-for="ldap-test-password")
        b-form-input#ldap-test-password(
          v-model="testPassword"
          type="password"
          autocomplete="current-password"
        )
      b-button(
        variant="outline-secondary"
        size="sm"
        @click="testLdapSettings"
        :disabled="testing"
      )
        | {{ testing ? $tr('Testing...') : $tr('Test LDAP') }}
      p.text-muted.small.mt-3
        | {{ $tr('If no test credentials are provided, only the service bind is tested.') }}

      hr

      h6.mb-3 {{ $tr('Application admins') }}
      p.text-muted.small
        | {{ $tr('LDAP users appear here after their first successful login. They are non-admin until the built-in admin promotes them.') }}
      b-button.mb-2(
        variant="outline-secondary"
        size="sm"
        @click="loadAuthUsers"
        :disabled="usersLoading"
      )
        | {{ $tr('Refresh users') }}
      b-table(
        small
        hover
        responsive="sm"
        :items="authUsers"
        :fields="authUserFields"
        :busy="usersLoading"
        :empty-text="$tr('No users found')"
      )
        template(v-slot:cell(display_name)="data")
          div {{ data.item.display_name || '-' }}
          small.text-muted(v-if="data.item.email") {{ data.item.email }}
        template(v-slot:cell(source)="data")
          b-badge(:variant="data.item.source === 'ldap' ? 'info' : 'secondary'")
            | {{ data.item.source }}
        template(v-slot:cell(is_admin)="data")
          b-form-checkbox(
            :checked="data.item.is_admin"
            switch
            :disabled="data.item.username === 'admin' || savingUser === data.item.username"
            @change="setUserAdmin(data.item, $event)"
          )
            | {{ data.item.is_admin ? $tr('Admin') : $tr('User') }}
</template>

<script lang="ts">
import { getClient } from '~/util/awclient';

function defaultLdapDraft() {
  return {
    enabled: false,
    server_url: '',
    default_domain: '',
    base_dn: '',
    bind_dn: '',
    bind_password_present: false,
    clear_bind_password: false,
    user_search_filter:
      '(&(objectClass=user)(|(sAMAccountName={username})(userPrincipalName={raw_username})(userPrincipalName={upn})))',
  };
}

export default {
  name: 'AdminAuthSettings',
  data() {
    return {
      ldapDraft: defaultLdapDraft(),
      bindPasswordInput: '',
      testUsername: '',
      testPassword: '',
      authUsers: [],
      loading: false,
      saving: false,
      testing: false,
      usersLoading: false,
      savingUser: '',
      error: '',
      success: '',
    };
  },
  computed: {
    authUserFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'display_name', label: this.$tr('Display name') },
        { key: 'source', label: this.$tr('Source'), sortable: true },
        { key: 'is_admin', label: this.$tr('Admin') },
        { key: 'last_login', label: this.$tr('Last login'), sortable: true },
      ];
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    applyLdapConfig(config) {
      this.ldapDraft = {
        ...defaultLdapDraft(),
        ...(config || {}),
        clear_bind_password: false,
      };
      this.bindPasswordInput = '';
    },
    ldapPayload() {
      const payload = { ...this.ldapDraft };
      if (this.bindPasswordInput) {
        payload.bind_password = this.bindPasswordInput;
        payload.bind_password_present = false;
      }
      return payload;
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const [ldapResponse, usersResponse] = await Promise.all([
          getClient().req.get('/0/admin/auth/ldap'),
          getClient().req.get('/0/admin/auth/users'),
        ]);
        this.applyLdapConfig(ldapResponse.data);
        this.authUsers = usersResponse.data?.users || [];
      } catch (e) {
        this.error =
          e?.response?.data?.message || this.$tr('Unable to load authentication settings');
      } finally {
        this.loading = false;
      }
    },
    async loadAuthUsers() {
      this.usersLoading = true;
      this.error = '';
      try {
        const response = await getClient().req.get('/0/admin/auth/users');
        this.authUsers = response.data?.users || [];
      } catch (e) {
        this.error = e?.response?.data?.message || this.$tr('Unable to load users');
      } finally {
        this.usersLoading = false;
      }
    },
    async saveLdapSettings() {
      this.saving = true;
      this.error = '';
      this.success = '';
      try {
        const response = await getClient().req.post('/0/admin/auth/ldap', this.ldapPayload(), {
          headers: { 'Content-Type': 'application/json' },
        });
        this.applyLdapConfig(response.data);
        this.success = this.$tr('LDAP settings saved');
      } catch (e) {
        this.error = e?.response?.data?.message || this.$tr('Unable to save LDAP settings');
      } finally {
        this.saving = false;
      }
    },
    async testLdapSettings() {
      this.testing = true;
      this.error = '';
      this.success = '';
      try {
        const response = await getClient().req.post(
          '/0/admin/auth/ldap/test',
          {
            config: this.ldapPayload(),
            username: this.testUsername,
            password: this.testPassword,
          },
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (response.data?.ok) {
          this.success = response.data.message || this.$tr('LDAP test succeeded');
        } else {
          this.error = response.data?.message || this.$tr('LDAP test failed');
        }
      } catch (e) {
        this.error = e?.response?.data?.message || this.$tr('LDAP test failed');
      } finally {
        this.testing = false;
      }
    },
    async setUserAdmin(user, isAdmin) {
      this.savingUser = user.username;
      this.error = '';
      this.success = '';
      try {
        const response = await getClient().req.post(
          `/0/admin/auth/users/${encodeURIComponent(user.username)}`,
          { is_admin: Boolean(isAdmin) },
          { headers: { 'Content-Type': 'application/json' } }
        );
        const updated = response.data;
        this.authUsers = this.authUsers.map(item =>
          item.username === updated.username ? { ...item, ...updated } : item
        );
      } catch (e) {
        this.error = e?.response?.data?.message || this.$tr('Unable to update user');
        await this.loadAuthUsers();
      } finally {
        this.savingUser = '';
      }
    },
  },
};
</script>

<style scoped>
.admin-auth-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
  gap: 1rem;
}

.admin-auth-panel {
  min-width: 0;
}

.admin-auth-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .admin-auth-grid {
    grid-template-columns: 1fr;
  }
}
</style>
