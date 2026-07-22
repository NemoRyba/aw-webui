export interface IEvent {
  timestamp: string;
  duration: number;
  data: Record<string, any>;
}

export interface IBucket {
  id: string;
  display_name?: string;
  hostname: string;
  device_id: string;
  type: string;
  client?: string;
  name?: string;
  data: Record<string, any>;
  metadata?: { start: Date; end: Date };
  last_updated?: Date;
  first_seen?: Date;
  created?: Date;
}

export interface IFleetLiveUser {
  username: string;
  device_id: string;
  device_name: string;
  session_id: string;
  session_type: string;
  hostname?: string;
  domain?: string | null;
  state: string;
  session_state?: string | null;
  session_reason?: string | null;
  afk_status?: string | null;
  current_app?: string | null;
  current_title?: string | null;
  process_name?: string | null;
  process_path?: string | null;
  explorer_path?: string | null;
  last_updated?: string | null;
}

export interface IFleetLiveDeviceSession {
  username: string;
  session_id: string;
  state: string;
  session_state?: string | null;
  afk_status?: string | null;
  current_app?: string | null;
  last_updated?: string | null;
}

export interface IFleetLiveDevice {
  device_id: string;
  device_name: string;
  hostname?: string | null;
  status: string;
  users_logged_in: string[];
  sessions: IFleetLiveDeviceSession[];
  last_updated?: string | null;
}

export interface IFleetLiveResponse {
  generated_at: string;
  users: IFleetLiveUser[];
  devices: IFleetLiveDevice[];
}

export interface IFleetStorageStatus {
  generated_at: string;
  data_dir: string;
  data_size_bytes: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_free_bytes: number;
}

export interface IFleetUserListItem {
  username: string;
  devices: string[];
  last_seen?: string | null;
  active_sessions: number;
}

export interface IFleetDeviceListItem {
  device_id: string;
  device_name: string;
  status: string;
  users: string[];
  last_seen?: string | null;
  session_count: number;
}

export interface IFleetTotals {
  active_seconds: number;
  afk_seconds: number;
  locked_seconds: number;
  disconnected_seconds: number;
  logged_in_seconds?: number;
}

export interface IFleetUserDeviceOption {
  device_id: string;
  device_name: string;
}

export interface IFleetUserDetail {
  username: string;
  range: { start: string; end: string };
  filters?: { exclude_inactive_session_afk?: boolean };
  devices: string[];
  available_devices: IFleetUserDeviceOption[];
  selected_devices: string[];
  totals: IFleetTotals;
  apps: Array<{
    app: string;
    seconds: number;
    active_seconds: number;
    afk_seconds: number;
    devices: string[];
  }>;
  sessions: IFleetLiveUser[];
}

export interface IFleetDeviceDetail {
  device_id: string;
  device_name: string;
  users: string[];
  status: string;
  last_updated?: string | null;
  range: { start: string; end: string };
  filters?: { exclude_inactive_session_afk?: boolean };
  totals: IFleetTotals;
  apps: Array<{
    username: string;
    app: string;
    seconds: number;
    active_seconds: number;
    afk_seconds: number;
  }>;
  sessions: IFleetLiveDeviceSession[];
}
