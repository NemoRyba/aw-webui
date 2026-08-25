<template lang="pug">
div.user-access-settings
  h5.mb-2 {{ $tr('Users and page access') }}
  p.text-muted.small
    | {{ $tr('LDAP users appear here after their first successful login. They are non-admin until the built-in admin promotes them.') }}
    |
    | {{ $tr('Non-admins always see their own evaluation; grant additional fleet pages and an optional start page per user here.') }}

  b-alert(:show="Boolean(error)" variant="danger")
    | {{ error }}

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
    responsive="lg"
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
    template(v-slot:cell(last_login)="data")
      span.auth-users-last-login {{ formatLastLogin(data.item.last_login) }}
    template(v-slot:cell(is_admin)="data")
      b-form-checkbox(
        :checked="data.item.is_admin"
        switch
        :disabled="data.item.username === 'admin' || savingUser === data.item.username"
        @change="setUserAdmin(data.item, $event)"
      )
        | {{ data.item.is_admin ? $tr('Admin') : $tr('User') }}
    template(v-slot:cell(allowed_pages)="data")
      span.text-muted(v-if="data.item.is_admin") {{ $tr('All pages') }}
      div.auth-user-pages(v-else)
        b-form-checkbox(
          v-for="page in pageDefs"
          :key="page.key"
          inline
          :checked="userHasPage(data.item, page.key)"
          :disabled="savingUser === data.item.username"
          @change="toggleUserPage(data.item, page.key, $event)"
        )
          | {{ page.label }}
    template(v-slot:cell(landing_page)="data")
      b-form-select.auth-user-landing(
        size="sm"
        :value="data.item.landing_page || (data.item.is_admin ? 'default' : 'own')"
        :options="landingOptionsFor(data.item)"
        :disabled="savingUser === data.item.username"
        @change="setUserLanding(data.item, $event)"
      )
</template>

<script lang="ts">
import moment from 'moment';

import { getClient } from '~/util/awclient';

export default {
  name: 'UserAccessSettings',
  data() {
    return {
      authUsers: [],
      usersLoading: false,
      savingUser: '',
      error: '',
    };
  },
  computed: {
    authUserFields() {
      return [
        { key: 'username', label: this.$tr('Username'), sortable: true },
        { key: 'display_name', label: this.$tr('Display name') },
        { key: 'source', label: this.$tr('Source'), sortable: true },
        { key: 'is_admin', label: this.$tr('Admin') },
        { key: 'allowed_pages', label: this.$tr('Page access') },
        { key: 'landing_page', label: this.$tr('Start page') },
        { key: 'last_login', label: this.$tr('Last login'), sortable: true },
      ];
    },
    pageDefs() {
      return [
        { key: 'fleet-live', label: this.$tr('Live') },
        { key: 'fleet-summary', label: this.$tr('Zusammenfassung') },
        { key: 'fleet-summary-own', label: this.$tr('Own summary') },
        { key: 'fleet-users', label: this.$tr('Users') },
        { key: 'fleet-devices', label: this.$tr('Devices') },
      ];
    },
  },
  async mounted() {
    await this.loadAuthUsers();
  },
  methods: {
    formatLastLogin(value) {
      if (!value) {
        return '-';
      }
      const timestamp = moment(value);
      if (!timestamp.isValid()) {
        return String(value);
      }
      return timestamp.format('YYYY-MM-DD HH:mm');
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
    async setUserAdmin(user, isAdmin) {
      await this.saveUserAccess(user, { is_admin: Boolean(isAdmin) });
    },
    userHasPage(user, key) {
      return (user.allowed_pages || []).includes(key);
    },
    landingOptionsFor(user) {
      if (user.is_admin) {
        // Admins see everything; 'default' clears the override (= Live).
        return [
          { value: 'default', text: this.$tr('Live (default)') },
          { value: 'own', text: this.$tr('My evaluation') },
          { value: 'fleet-summary', text: this.$tr('Zusammenfassung') },
          { value: 'fleet-users', text: this.$tr('Users') },
          { value: 'fleet-devices', text: this.$tr('Devices') },
          { value: 'timeline', text: this.$tr('Timeline') },
          { value: 'buckets', text: this.$tr('Raw Data') },
        ];
      }
      const options = [{ value: 'own', text: this.$tr('Own view (default)') }];
      for (const page of this.pageDefs) {
        if (this.userHasPage(user, page.key)) {
          options.push({ value: page.key, text: page.label });
        }
      }
      return options;
    },
    async toggleUserPage(user, key, enabled) {
      const pages = new Set(user.allowed_pages || []);
      if (enabled) {
        pages.add(key);
        // Full and own-only summary are alternatives, not additive: the server
        // lets the wider grant win, so showing both ticked would be a lie.
        const opposite = {
          'fleet-summary': 'fleet-summary-own',
          'fleet-summary-own': 'fleet-summary',
        }[key];
        if (opposite) {
          pages.delete(opposite);
        }
      } else {
        pages.delete(key);
      }
      await this.saveUserAccess(user, { allowed_pages: Array.from(pages) });
    },
    async setUserLanding(user, value) {
      // 'default' clears the override server-side (empty landing_page).
      const landing = value === 'default' ? '' : value || (user.is_admin ? '' : 'own');
      await this.saveUserAccess(user, { landing_page: landing });
    },
    async saveUserAccess(user, payload) {
      this.savingUser = user.username;
      this.error = '';
      try {
        const response = await getClient().req.post(
          `/0/admin/auth/users/${encodeURIComponent(user.username)}`,
          payload,
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
.auth-users-last-login {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.auth-user-pages {
  min-width: 20rem;
}

.auth-user-landing {
  min-width: 11rem;
}
</style>
