import { defineStore } from 'pinia';

import { useAdminUiStore } from '~/stores/adminUi';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';

interface IAuthUser {
  username: string;
  is_admin: boolean;
}

interface State {
  authenticated: boolean;
  user: IAuthUser | null;
  loaded: boolean;
}

function normalizeAuthPayload(payload: any) {
  const authenticated = Boolean(payload?.authenticated && payload?.user?.username);
  return {
    authenticated,
    user: authenticated
      ? {
          username: String(payload.user.username),
          is_admin: Boolean(payload.user.is_admin),
        }
      : null,
    loaded: true,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): State => ({
    authenticated: false,
    user: null,
    loaded: false,
  }),

  getters: {
    isAdmin(state: State) {
      return Boolean(state.user?.is_admin);
    },
    username(state: State) {
      return state.user?.username || '';
    },
  },

  actions: {
    setLoggedOut() {
      this.$patch({
        authenticated: false,
        user: null,
        loaded: true,
      });

      const settingsStore = useSettingsStore();
      settingsStore.$reset();

      const adminUiStore = useAdminUiStore();
      adminUiStore.reset();
    },

    async loadSession() {
      try {
        const response = await getClient().req.get('/0/auth/session');
        this.$patch(normalizeAuthPayload(response.data));

        if (!this.authenticated) {
          const settingsStore = useSettingsStore();
          settingsStore.$reset();
        }
      } catch (e) {
        console.error('Unable to load auth session:', e);
        this.setLoggedOut();
      }
    },

    async ensureLoaded() {
      if (!this.loaded) {
        await this.loadSession();
      }
    },

    async login(username: string, password: string) {
      const response = await getClient().req.post(
        '/0/auth/login',
        { username, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      this.$patch(normalizeAuthPayload(response.data));
      return response.data;
    },

    async logout() {
      try {
        await getClient().req.post(
          '/0/auth/logout',
          {},
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (e) {
        console.error('Unable to log out cleanly:', e);
      } finally {
        this.setLoggedOut();
      }
    },
  },
});
