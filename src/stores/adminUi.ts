import { defineStore } from 'pinia';

import { FORK_FEATURES } from '~/forkFeatures';
import { getClient } from '~/util/awclient';

interface State {
  showStopwatchMenu: boolean;
  showToolsMenu: boolean;
  _loaded: boolean;
}

function defaultState(): State {
  return {
    showStopwatchMenu: FORK_FEATURES.stopwatchEnabled,
    showToolsMenu: true,
    _loaded: false,
  };
}

function normalizeAdminUiPayload(payload: any) {
  return {
    showStopwatchMenu: Boolean(payload?.show_stopwatch_menu ?? FORK_FEATURES.stopwatchEnabled),
    showToolsMenu: Boolean(payload?.show_tools_menu ?? true),
    _loaded: true,
  };
}

export const useAdminUiStore = defineStore('adminUi', {
  state: (): State => defaultState(),

  getters: {
    loaded(state: State) {
      return state._loaded;
    },
  },

  actions: {
    reset() {
      this.$patch(defaultState());
    },

    async ensureLoaded() {
      if (!this.loaded) {
        await this.load();
      }
    },

    async load() {
      try {
        const response = await getClient().req.get('/0/admin/ui-config');
        this.$patch(normalizeAdminUiPayload(response.data));
      } catch (e) {
        console.error('Unable to load admin UI config:', e);
        this.$patch({ ...defaultState(), _loaded: true });
      }
    },

    async update(newState: { showStopwatchMenu: boolean; showToolsMenu: boolean }) {
      const response = await getClient().req.post(
        '/0/admin/ui-config',
        {
          show_stopwatch_menu: Boolean(newState.showStopwatchMenu),
          show_tools_menu: Boolean(newState.showToolsMenu),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      this.$patch(normalizeAdminUiPayload(response.data));
      return response.data;
    },
  },
});
