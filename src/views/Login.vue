<template lang="pug">
div.min-vh-100.d-flex.align-items-center.justify-content-center.px-3.py-5(style="background: #f4f6f9;")
  b-card.login-card.shadow-sm
    div.text-center.mb-4
      img.mb-3(src="/logo.png" alt="ActivityWatch" style="height: 56px;")
      h3.mb-1 ActivityWatch
      div.text-muted
        | {{ $tr('Sign in to continue') }}

    b-alert(v-if="error" show variant="danger")
      | {{ error }}

    b-form(@submit.prevent="submit")
      b-form-group(:label="$tr('Username')" label-for="login-username")
        b-form-input#login-username(
          v-model.trim="username"
          autocomplete="username"
          required
        )
      b-form-group(:label="$tr('Password')" label-for="login-password")
        b-form-input#login-password(
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        )
      b-button(type="submit" variant="primary" block :disabled="submitting")
        | {{ submitting ? $tr('Signing in...') : $tr('Log in') }}
</template>

<script lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useSettingsStore } from '~/stores/settings';
import { getSettingsLandingPage, isLandingRedirectPath } from '~/util/landingPage';

export default {
  name: 'Login',
  data() {
    return {
      authStore: useAuthStore(),
      settingsStore: useSettingsStore(),
      username: '',
      password: '',
      submitting: false,
      error: '',
    };
  },
  methods: {
    async submit() {
      this.submitting = true;
      this.error = '';
      try {
        await this.authStore.login(this.username, this.password);
        await this.settingsStore.load();

        const requestedNext =
          typeof this.$route.query.next === 'string' ? this.$route.query.next : '';
        const nextPath =
          requestedNext && !isLandingRedirectPath(requestedNext)
            ? requestedNext
            : getSettingsLandingPage(this.settingsStore);
        await this.$router.replace(nextPath);
      } catch (e) {
        console.error('Login failed:', e);
        this.error = e?.response?.data?.message || this.$tr('Invalid username or password');
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.login-card {
  width: 100%;
  max-width: 420px;
}
</style>
