export interface IBucketIdentity {
  username: string;
  deviceId: string;
  deviceName: string;
  sessionId: string;
  sessionType: string;
  hostname: string;
  watcherClient: string;
  watcherType: string;
  watcherLabel: string;
}

export interface IDesktopQueryTarget {
  key: string;
  label: string;
  hostname: string;
  username: string;
  deviceId: string;
  deviceName: string;
  sessionId: string;
  sessionType: string;
  bidWindow: string;
  bidAfk: string;
  lastUpdated: string;
}

function hasIdentityValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim();
  return normalized !== '' && normalized.toLowerCase() !== 'unknown';
}

function latestEventData(bucket: any): Record<string, any> {
  if (!Array.isArray(bucket?.events) || bucket.events.length === 0) {
    return {};
  }

  return bucket.events[0]?.data || {};
}

function pickIdentityValue(
  bucketData: Record<string, any>,
  eventData: Record<string, any>,
  key: string,
  fallback?: unknown
) {
  if (hasIdentityValue(bucketData?.[key])) {
    return bucketData[key];
  }
  if (hasIdentityValue(eventData?.[key])) {
    return eventData[key];
  }
  return fallback;
}

export function getBucketIdentity(bucket: any): IBucketIdentity {
  const bucketData = bucket?.data || {};
  const eventData = latestEventData(bucket);
  const hostname = String(
    pickIdentityValue(bucketData, eventData, 'hostname', bucket?.hostname || 'unknown')
  );
  const deviceId = String(
    pickIdentityValue(
      bucketData,
      eventData,
      'device_id',
      bucket?.device_id || hostname || 'unknown'
    )
  );
  const deviceName = String(
    pickIdentityValue(bucketData, eventData, 'device_name', hostname || deviceId)
  );
  const username = String(pickIdentityValue(bucketData, eventData, 'username', 'unknown'));
  const sessionId = String(pickIdentityValue(bucketData, eventData, 'session_id', 'unknown'));
  const sessionType = String(pickIdentityValue(bucketData, eventData, 'session_type', ''));
  const watcherClient = String(bucket?.client || bucket?.type || 'unknown');
  const watcherType = String(bucket?.type || 'unknown');

  return {
    username,
    deviceId,
    deviceName,
    sessionId,
    sessionType,
    hostname,
    watcherClient,
    watcherType,
    watcherLabel:
      watcherClient && watcherClient !== watcherType
        ? `${watcherClient} (${watcherType})`
        : watcherType,
  };
}

function normalizeSelectionValue(value: unknown): string {
  return hasIdentityValue(value) ? String(value).trim() : '';
}

function desktopIdentityKey(identity: IBucketIdentity): string | null {
  const username = normalizeSelectionValue(identity.username);
  const deviceId = normalizeSelectionValue(identity.deviceId);
  const sessionId = normalizeSelectionValue(identity.sessionId);

  if (!username || !deviceId || !sessionId) {
    return null;
  }

  return [username, deviceId, sessionId].join('||');
}

function isDesktopWindowBucket(bucket: any): boolean {
  return (
    bucket?.type === 'currentwindow' && !String(bucket?.id || '').startsWith('aw-watcher-android')
  );
}

function buildDesktopTargetLabel(
  identity: IBucketIdentity,
  hostname: string,
  fallbackId: string
): string {
  const parts: string[] = [];

  if (hasIdentityValue(identity.username)) {
    parts.push(identity.username);
  }

  if (
    hasIdentityValue(identity.deviceName) &&
    identity.deviceName !== identity.username &&
    identity.deviceName !== identity.deviceId
  ) {
    parts.push(identity.deviceName);
  } else if (hasIdentityValue(identity.deviceId)) {
    parts.push(identity.deviceId);
  }

  if (hasIdentityValue(identity.sessionId)) {
    parts.push(
      `Session ${identity.sessionId}${
        hasIdentityValue(identity.sessionType) ? ` (${identity.sessionType})` : ''
      }`
    );
  }

  if (
    hostname &&
    hostname !== identity.deviceName &&
    hostname !== identity.deviceId &&
    hostname !== identity.username
  ) {
    parts.push(hostname);
  }

  if (parts.length === 0) {
    parts.push(fallbackId);
  }

  return parts.join(' | ');
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function getDesktopQueryTargets(buckets: any[]): IDesktopQueryTarget[] {
  const afkByIdentity = new Map<string, any[]>();
  const afkByHostname = new Map<string, any[]>();
  const targets: IDesktopQueryTarget[] = [];
  const seenWindowBuckets = new Set<string>();

  for (const bucket of buckets || []) {
    if (bucket?.type !== 'afkstatus') {
      continue;
    }

    const identity = getBucketIdentity(bucket);
    const identityKey = desktopIdentityKey(identity);
    if (identityKey) {
      const existingBuckets = afkByIdentity.get(identityKey) || [];
      existingBuckets.push(bucket);
      afkByIdentity.set(identityKey, existingBuckets);
    }

    const hostname = normalizeSelectionValue(bucket?.hostname || identity.hostname);
    if (hostname) {
      const existingBuckets = afkByHostname.get(hostname) || [];
      existingBuckets.push(bucket);
      afkByHostname.set(hostname, existingBuckets);
    }
  }

  for (const bucket of buckets || []) {
    if (!isDesktopWindowBucket(bucket)) {
      continue;
    }

    const identity = getBucketIdentity(bucket);
    const hostname = normalizeSelectionValue(bucket?.hostname || identity.hostname);
    const identityKey = desktopIdentityKey(identity);
    let afkBucket = identityKey ? (afkByIdentity.get(identityKey) || [])[0] : null;

    if (!afkBucket && hostname) {
      afkBucket = (afkByHostname.get(hostname) || [])[0];
    }

    if (!afkBucket || seenWindowBuckets.has(String(bucket.id))) {
      continue;
    }

    seenWindowBuckets.add(String(bucket.id));
    targets.push({
      key: String(bucket.id),
      label: buildDesktopTargetLabel(identity, hostname, String(bucket.id)),
      hostname: hostname || identity.hostname,
      username: identity.username,
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
      sessionId: identity.sessionId,
      sessionType: identity.sessionType,
      bidWindow: String(bucket.id),
      bidAfk: String(afkBucket.id),
      lastUpdated: String(bucket?.last_updated || afkBucket?.last_updated || ''),
    });
  }

  return targets.sort((left, right) => {
    if (left.lastUpdated !== right.lastUpdated) {
      return right.lastUpdated.localeCompare(left.lastUpdated);
    }

    return (
      compareText(left.username, right.username) ||
      compareText(left.deviceName, right.deviceName) ||
      compareText(left.sessionId, right.sessionId) ||
      compareText(left.label, right.label)
    );
  });
}
