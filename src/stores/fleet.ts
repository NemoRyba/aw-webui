import { defineStore } from 'pinia';
import moment from 'moment';

import { getClient } from '~/util/awclient';
import {
  IFleetDeviceDetail,
  IFleetDeviceListItem,
  IFleetDeviceMetricsResponse,
  IFleetLiveResponse,
  IFleetSummaryPrecomputeConfig,
  IFleetSummaryPrecomputeResult,
  IFleetSummaryResponse,
  IFleetStorageStatus,
  IFleetUserDetail,
  IFleetUserListItem,
  IRedmineComparisonResponse,
  IRedmineConfig,
  IRedmineUserMappingResponse,
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
  summary: IFleetSummaryResponse | null;
  summaryPrecomputeConfig: IFleetSummaryPrecomputeConfig | null;
  redmineConfig: IRedmineConfig | null;
  redmineComparison: IRedmineComparisonResponse | null;
  redmineMappings: IRedmineUserMappingResponse | null;
  users: IFleetUserListItem[];
  devices: IFleetDeviceListItem[];
  deviceMetrics: IFleetDeviceMetricsResponse | null;
  userDetails: Record<string, IFleetUserDetail>;
  deviceDetails: Record<string, IFleetDeviceDetail>;
  watcherUpdate: any;
  watcherUpdateConfig: any;
  fleetAuth: any;
  deviceEnrollment: any;
  fleetEndpoint: any;
}

export const useFleetStore = defineStore('fleet', {
  state: (): State => ({
    live: null,
    storage: null,
    summary: null,
    summaryPrecomputeConfig: null,
    redmineConfig: null,
    redmineComparison: null,
    redmineMappings: null,
    users: [],
    devices: [],
    deviceMetrics: null,
    userDetails: {},
    deviceDetails: {},
    watcherUpdate: null,
    watcherUpdateConfig: null,
    fleetAuth: null,
    deviceEnrollment: null,
    fleetEndpoint: null,
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

    async loadSummary(params = {}): Promise<IFleetSummaryResponse> {
      const response = await getClient().req.get('/0/fleet/summary', {
        params,
      });
      const summary = response.data;
      this.$patch({ summary });
      return summary;
    },

    async loadSummaryPrecomputeConfig(): Promise<IFleetSummaryPrecomputeConfig> {
      const response = await getClient().req.get('/0/fleet/summary/precompute/config');
      this.$patch({ summaryPrecomputeConfig: response.data });
      return response.data;
    },

    async saveSummaryPrecomputeConfig(
      config: Partial<IFleetSummaryPrecomputeConfig>
    ): Promise<IFleetSummaryPrecomputeConfig> {
      const response = await getClient().req.post('/0/fleet/summary/precompute/config', config);
      this.$patch({ summaryPrecomputeConfig: response.data });
      return response.data;
    },

    async precomputeSummary(payload = {}): Promise<IFleetSummaryPrecomputeResult> {
      const response = await getClient().req.post('/0/fleet/summary/precompute', payload);
      const result = response.data;
      if (result.runs) {
        this.$patch({
          summaryPrecomputeConfig: {
            ...(this.summaryPrecomputeConfig || {
              auto_enabled: false,
              start_of_day: '04:00',
            }),
            runs: result.runs,
          },
        });
      }
      return result;
    },

    async loadRedmineConfig(): Promise<IRedmineConfig> {
      const response = await getClient().req.get('/0/admin/redmine');
      this.$patch({ redmineConfig: response.data });
      return response.data;
    },

    async saveRedmineConfig(config: Partial<IRedmineConfig>): Promise<IRedmineConfig> {
      const response = await getClient().req.post('/0/admin/redmine', config);
      this.$patch({ redmineConfig: response.data });
      return response.data;
    },

    async testRedmineConfig(
      config: Partial<IRedmineConfig>
    ): Promise<{ ok: boolean; message: string }> {
      const response = await getClient().req.post('/0/admin/redmine/test', config);
      return response.data;
    },

    async loadRedmineComparison(payload = {}): Promise<IRedmineComparisonResponse> {
      const response = await getClient().req.post('/0/fleet/redmine-comparison', payload);
      const comparison = response.data;
      this.$patch({ redmineComparison: comparison });
      return comparison;
    },

    async loadRedmineDailyComparison(payload = {}): Promise<any> {
      const response = await getClient().req.post('/0/fleet/redmine-daily-comparison', payload, {
        timeout: 600000,
      });
      return response.data;
    },

    async loadRedmineMappings(): Promise<IRedmineUserMappingResponse> {
      const response = await getClient().req.get('/0/admin/redmine/mappings');
      const mappings = response.data;
      this.$patch({ redmineMappings: mappings });
      return mappings;
    },

    async saveRedmineMapping(
      username: string,
      redmineUserId: number | null
    ): Promise<IRedmineUserMappingResponse> {
      const response = await getClient().req.post('/0/admin/redmine/mappings', {
        username,
        redmine_user_id: redmineUserId,
      });
      const mappings = response.data;
      this.$patch({ redmineMappings: mappings });
      return mappings;
    },

    async loadWatcherUpdateDevices(): Promise<any> {
      const response = await getClient().req.get('/0/fleet/watcher-update/devices');
      this.$patch({ watcherUpdate: response.data });
      return response.data;
    },

    async loadWatcherUpdateConfig(): Promise<any> {
      const response = await getClient().req.get('/0/fleet/watcher-update/config');
      this.$patch({ watcherUpdateConfig: response.data });
      return response.data;
    },

    async saveWatcherUpdateConfig(config = {}): Promise<any> {
      const response = await getClient().req.post('/0/fleet/watcher-update/config', config);
      this.$patch({ watcherUpdateConfig: response.data });
      return response.data;
    },

    async uploadWatcherUpdatePackage(file: File, onProgress?: (pct: number) => void): Promise<any> {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await getClient().req.post('/0/fleet/watcher-update/upload', form, {
        timeout: 600000,
        onUploadProgress: event => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
      return response.data;
    },

    async deleteWatcherUpdatePackage(): Promise<any> {
      const response = await getClient().req.delete('/0/fleet/watcher-update/upload');
      return response.data;
    },

    // Manual "update now": queues a pending request per device that its
    // supervisor picks up on the next poll (<= 60 s).
    async requestWatcherUpdate(hostnames: string[]): Promise<any> {
      const response = await getClient().req.post('/0/fleet/watcher-update/request', {
        hostnames,
      });
      return response.data;
    },

    async cancelWatcherUpdate(hostnames: string[]): Promise<any> {
      const response = await getClient().req.delete('/0/fleet/watcher-update/request', {
        data: { hostnames },
      });
      return response.data;
    },

    async loadFleetAuthConfig(): Promise<any> {
      const response = await getClient().req.get('/0/admin/fleet-auth');
      this.$patch({ fleetAuth: response.data });
      return response.data;
    },

    async saveFleetAuthConfig(config = {}): Promise<any> {
      const response = await getClient().req.post('/0/admin/fleet-auth', config);
      this.$patch({ fleetAuth: response.data });
      return response.data;
    },

    async revealFleetToken(): Promise<string> {
      const response = await getClient().req.get('/0/admin/fleet-auth/token');
      return response.data?.token || '';
    },

    // Device enrollment: devices register themselves, an admin approves.
    async loadDeviceEnrollment(): Promise<any> {
      const response = await getClient().req.get('/0/fleet/devices/enrollment');
      this.$patch({ deviceEnrollment: response.data });
      return response.data;
    },

    async setDeviceEnrollment(deviceIds: string[], newStatus: string): Promise<any> {
      const response = await getClient().req.post('/0/fleet/devices/enrollment', {
        device_ids: deviceIds,
        status: newStatus,
      });
      return response.data;
    },

    async deleteEnrolledDevices(deviceIds: string[]): Promise<any> {
      const response = await getClient().req.delete('/0/fleet/devices/enrollment', {
        data: { device_ids: deviceIds },
      });
      return response.data;
    },

    // Moving the fleet server to another machine / IP.
    async loadFleetEndpoint(): Promise<any> {
      const response = await getClient().req.get('/0/admin/fleet-endpoint');
      this.$patch({ fleetEndpoint: response.data });
      return response.data;
    },

    async saveFleetEndpoint(payload = {}): Promise<any> {
      const response = await getClient().req.post('/0/admin/fleet-endpoint', payload);
      this.$patch({ fleetEndpoint: response.data?.config || null });
      return response.data;
    },

    async loadUser(username: string, params = {}): Promise<IFleetUserDetail> {
      // Monotonic sequence: when several loads overlap (e.g. rapid "Next day"
      // clicks), only the most recently started one may write the store, so a
      // slow stale response can never overwrite newer data.
      const seq = ((this as any)._userLoadSeq = ((this as any)._userLoadSeq || 0) + 1);
      const response = await getClient().req.get(`/0/fleet/users/${encodeURIComponent(username)}`, {
        params,
        // First-time computation of a long range can exceed the global request
        // timeout; cached ranges return instantly. Allow up to 10 minutes here.
        timeout: 600000,
      });
      if (seq !== (this as any)._userLoadSeq) {
        return response.data;
      }
      this.userDetails = {
        ...this.userDetails,
        [username]: response.data,
      };
      return response.data;
    },

    async loadUserSummaryProgress(username: string, params = {}): Promise<any> {
      const response = await getClient().req.get(
        `/0/fleet/users/${encodeURIComponent(username)}/summary/progress`,
        { params, timeout: 15000 }
      );
      return response.data;
    },

    async recalculateUserSummary(username: string, payload = {}): Promise<IFleetUserDetail> {
      const response = await getClient().req.post(
        `/0/fleet/users/${encodeURIComponent(username)}/summary/recalculate`,
        payload,
        { timeout: 600000 }
      );
      const cachedSummary = response.data;
      const existing = this.userDetails[username];
      if (existing) {
        this.userDetails = {
          ...this.userDetails,
          [username]: {
            ...existing,
            totals: cachedSummary.totals,
            summary_cache: cachedSummary.summary_cache,
          },
        };
      }
      return this.userDetails[username] || cachedSummary;
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
