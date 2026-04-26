import { defineStore } from 'pinia';

import { getClient } from '~/util/awclient';
import {
  IFleetDeviceDetail,
  IFleetDeviceListItem,
  IFleetLiveResponse,
  IFleetUserDetail,
  IFleetUserListItem,
} from '~/util/interfaces';

interface State {
  live: IFleetLiveResponse | null;
  users: IFleetUserListItem[];
  devices: IFleetDeviceListItem[];
  userDetails: Record<string, IFleetUserDetail>;
  deviceDetails: Record<string, IFleetDeviceDetail>;
}

export const useFleetStore = defineStore('fleet', {
  state: (): State => ({
    live: null,
    users: [],
    devices: [],
    userDetails: {},
    deviceDetails: {},
  }),

  actions: {
    async loadLive(): Promise<IFleetLiveResponse> {
      const response = await getClient().req.get('/0/fleet/live');
      this.$patch({ live: response.data });
      return response.data;
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
