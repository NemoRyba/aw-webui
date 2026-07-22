import { defineStore } from 'pinia';
import moment from 'moment';

import { getClient } from '~/util/awclient';
import {
  IFleetDeviceDetail,
  IFleetDeviceListItem,
  IFleetDeviceMetricsResponse,
  IFleetLiveResponse,
  IFleetStorageStatus,
  IFleetUserDetail,
  IFleetUserListItem,
} from '~/util/interfaces';

const STORAGE_CACHE_PREFIX = 'aw-fleet-storage-status:';

function storageCacheKey(startOfDay: string): string {
  const [hour, minute] = String(startOfDay || '04:00')
    .split(':')
    .map(value => Number(value));
  const boundary = moment()
    .hour(Number.isFinite(hour) ? hour : 4)
    .minute(Number.isFinite(minute) ? minute : 0)
    .second(0)
    .millisecond(0);

  if (moment().isBefore(boundary)) {
    boundary.subtract(1, 'day');
  }

  return `${STORAGE_CACHE_PREFIX}${boundary.format('YYYY-MM-DDTHH:mm')}`;
}

interface State {
  live: IFleetLiveResponse | null;
  storage: IFleetStorageStatus | null;
  users: IFleetUserListItem[];
  devices: IFleetDeviceListItem[];
  deviceMetrics: IFleetDeviceMetricsResponse | null;
  userDetails: Record<string, IFleetUserDetail>;
  deviceDetails: Record<string, IFleetDeviceDetail>;
}

export const useFleetStore = defineStore('fleet', {
  state: (): State => ({
    live: null,
    storage: null,
    users: [],
    devices: [],
    deviceMetrics: null,
    userDetails: {},
    deviceDetails: {},
  }),

  actions: {
    async loadLive(): Promise<IFleetLiveResponse> {
      const response = await getClient().req.get('/0/fleet/live');
      this.$patch({ live: response.data });
      return response.data;
    },

    async loadStorage({
      force = false,
      startOfDay = '04:00',
    }: { force?: boolean; startOfDay?: string } = {}): Promise<IFleetStorageStatus> {
      const cacheKey = storageCacheKey(startOfDay);
      if (!force && typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const storage = JSON.parse(cached);
          this.$patch({ storage });
          return storage;
        }
      }

      const response = await getClient().req.get('/0/fleet/storage');
      const storage = response.data;
      this.$patch({ storage });

      if (typeof localStorage !== 'undefined') {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(STORAGE_CACHE_PREFIX) && key !== cacheKey) {
            localStorage.removeItem(key);
          }
        }
        localStorage.setItem(cacheKey, JSON.stringify(storage));
      }

      return storage;
    },

    async loadUsers(): Promise<IFleetUserListItem[]> {
      const response = await getClient().req.get('/0/fleet/users');
      this.$patch({ users: response.data.users || [] });
      return this.users;
    },

    async loadUser(username: string, params = {}): Promise<IFleetUserDetail> {
      const response = await getClient().req.get(`/0/fleet/users/${encodeURIComponent(username)}`, {
        params,
      });
      this.userDetails = {
        ...this.userDetails,
        [username]: response.data,
      };
      return response.data;
    },

    async loadDevices(): Promise<IFleetDeviceListItem[]> {
      const response = await getClient().req.get('/0/fleet/devices');
      this.$patch({ devices: response.data.devices || [] });
      return this.devices;
    },

    async loadDeviceMetrics(params = {}): Promise<IFleetDeviceMetricsResponse> {
      const response = await getClient().req.get('/0/fleet/devices/metrics', {
        params,
      });
      const metrics = response.data;
      this.$patch({ deviceMetrics: metrics });
      return metrics;
    },

    async loadDevice(deviceId: string, params = {}): Promise<IFleetDeviceDetail> {
      const response = await getClient().req.get(
        `/0/fleet/devices/${encodeURIComponent(deviceId)}`,
        {
          params,
        }
      );
      this.deviceDetails = {
        ...this.deviceDetails,
        [deviceId]: response.data,
      };
      return response.data;
    },
  },
});
