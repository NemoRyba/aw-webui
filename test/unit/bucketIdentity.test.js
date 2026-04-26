import { getDesktopQueryTargets } from '~/util/bucketIdentity';

describe('getDesktopQueryTargets', () => {
  test('pairs desktop window and AFK buckets by user/device/session identity', () => {
    const targets = getDesktopQueryTargets([
      {
        id: 'aw-watcher-window-workstation-1',
        type: 'currentwindow',
        hostname: 'workstation-1',
        data: {
          username: 'alice',
          device_id: 'dev-1',
          device_name: 'CAD-01',
          session_id: '2',
          session_type: 'interactive',
        },
        last_updated: '2026-04-26T10:00:00Z',
      },
      {
        id: 'aw-watcher-afk-workstation-1',
        type: 'afkstatus',
        hostname: 'workstation-1',
        data: {
          username: 'alice',
          device_id: 'dev-1',
          device_name: 'CAD-01',
          session_id: '2',
          session_type: 'console',
        },
        last_updated: '2026-04-26T10:00:01Z',
      },
    ]);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      bidWindow: 'aw-watcher-window-workstation-1',
      bidAfk: 'aw-watcher-afk-workstation-1',
      username: 'alice',
      deviceId: 'dev-1',
      sessionId: '2',
      hostname: 'workstation-1',
    });
  });

  test('falls back to hostname pairing for legacy buckets without identity metadata', () => {
    const targets = getDesktopQueryTargets([
      {
        id: 'aw-watcher-window-legacy-box',
        type: 'currentwindow',
        hostname: 'legacy-box',
        data: {},
      },
      {
        id: 'aw-watcher-afk-legacy-box',
        type: 'afkstatus',
        hostname: 'legacy-box',
        data: {},
      },
    ]);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      bidWindow: 'aw-watcher-window-legacy-box',
      bidAfk: 'aw-watcher-afk-legacy-box',
      hostname: 'legacy-box',
    });
  });
});
