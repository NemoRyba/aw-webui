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
  event_count?: number;
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

export interface IFleetDeviceMetricSample {
  timestamp: string;
  cpu_percent?: number | null;
  memory_percent?: number | null;
  memory_used_bytes?: number | null;
  memory_total_bytes?: number | null;
}

export interface IFleetDeviceMetricsItem {
  device_id: string;
  device_name: string;
  last_updated?: string | null;
  latest_cpu_percent?: number | null;
  latest_memory_percent?: number | null;
  latest_memory_used_bytes?: number | null;
  latest_memory_total_bytes?: number | null;
  samples: IFleetDeviceMetricSample[];
}

export interface IFleetDeviceMetricsResponse {
  generated_at: string;
  range: { start: string; end: string };
  devices: IFleetDeviceMetricsItem[];
}

export interface IFleetTotals {
  active_seconds: number;
  afk_seconds: number;
  locked_seconds: number;
  disconnected_seconds: number;
  logged_in_seconds?: number;
  not_afk_active_seconds?: number;
}

export interface IFleetSummaryCacheMeta {
  cached: boolean;
  calculated_at?: string | null;
  source?: string | null;
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
  summary_cache?: IFleetSummaryCacheMeta;
  apps: Array<{
    app: string;
    seconds: number;
    active_seconds: number;
    afk_seconds: number;
    devices: string[];
  }>;
  sessions: IFleetLiveUser[];
}

export interface IFleetUserSummaryRow extends IFleetUserListItem {
  totals: IFleetTotals;
  selected_devices?: string[];
  summary_cache?: IFleetSummaryCacheMeta;
}

export interface IFleetSummaryResponse {
  generated_at: string;
  range: { start: string; end: string };
  filters?: { exclude_inactive_session_afk?: boolean };
  users: IFleetUserSummaryRow[];
}

export interface IFleetSummaryPrecomputeRun {
  run_key: string;
  range: { start: string; end: string };
  start_of_day: string;
  source: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  users_total: number;
  users_done: number;
  message?: string | null;
}

export interface IFleetSummaryPrecomputeConfig {
  auto_enabled: boolean;
  start_of_day: string;
  runs?: IFleetSummaryPrecomputeRun[];
}

export interface IFleetSummaryPrecomputeResult {
  status: string;
  message?: string;
  run?: IFleetSummaryPrecomputeRun;
  users_total?: number;
  users_done?: number;
  errors?: string[];
  runs?: IFleetSummaryPrecomputeRun[];
}

export interface IRedmineConfig {
  enabled: boolean;
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  table_prefix: string;
  mysql_cli_path: string;
  connect_timeout: number;
  password_present?: boolean;
  clear_password?: boolean;
}

export interface IRedmineComparisonUser {
  username: string;
  email: string;
  display_name?: string;
  ldap_source?: string;
  matched: boolean;
  status: string;
  redmine_user_id?: number | null;
  redmine_login?: string;
  redmine_name?: string;
  redmine_hours?: number | null;
  redmine_seconds?: number | null;
  entry_count: number;
  projects: Array<{
    project_id?: number | null;
    project_name: string;
    hours: number;
    seconds: number;
    entry_count: number;
  }>;
}

export interface IRedmineComparisonResponse {
  generated_at: string;
  enabled: boolean;
  range: { start: string; end: string };
  spent_on_range?: { from: string; to: string } | null;
  users: IRedmineComparisonUser[];
  totals: { redmine_hours: number; redmine_seconds: number };
  message?: string;
  error?: string;
  error_code?: string;
  error_detail?: string;
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
