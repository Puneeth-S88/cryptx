import { describe, it, expect } from 'vitest';
import { createSession, validateSession } from '../../src/lib/session';
import {
  postAnnouncement,
  getActiveAnnouncement,
  clearActiveAnnouncement,
  getAllAnnouncements,
} from '../../src/lib/broadcast';

describe('Single Device Session Enforcement', () => {
  it('allows initial session for a team', () => {
    const { token, session } = createSession(
      { id: 'team_alpha', name: 'Alpha Team', role: 'participant' },
      { ipAddress: '192.168.1.10', deviceInfo: 'Laptop Chrome' }
    );

    const val = validateSession(token);
    expect(val.valid).toBe(true);
    expect(val.session?.accountName).toBe('Alpha Team');
  });

  it('automatically invalidates and supersedes old device when new device signs in', () => {
    // 1. Device 1 signs in
    const device1 = createSession(
      { id: 'team_beta', name: 'Beta Team', role: 'participant' },
      { ipAddress: '192.168.1.20', deviceInfo: 'Device 1 Phone' }
    );

    expect(validateSession(device1.token).valid).toBe(true);

    // 2. Device 2 signs into the SAME team account
    const device2 = createSession(
      { id: 'team_beta', name: 'Beta Team', role: 'participant' },
      { ipAddress: '192.168.1.30', deviceInfo: 'Device 2 Desktop' }
    );

    // 3. Device 2 is now the active valid device
    const val2 = validateSession(device2.token);
    expect(val2.valid).toBe(true);

    // 4. Device 1 MUST be detected as superseded (auto-logged out)
    const val1 = validateSession(device1.token);
    expect(val1.valid).toBe(false);
    expect(val1.superseded).toBe(true);
    expect(val1.error).toContain('Another device has logged into this account');
  });
});

describe('Real-Time Announcement Dispatcher', () => {
  it('broadcasts announcements and updates active notice', () => {
    clearActiveAnnouncement();
    expect(getActiveAnnouncement()).toBeNull();

    const notice = postAnnouncement('Round 1 extended by 5 minutes!', 'urgent', 'Command Room');
    expect(notice.message).toBe('Round 1 extended by 5 minutes!');
    expect(notice.priority).toBe('urgent');

    const active = getActiveAnnouncement();
    expect(active?.id).toBe(notice.id);
    expect(active?.message).toBe('Round 1 extended by 5 minutes!');

    const all = getAllAnnouncements();
    expect(all[0].id).toBe(notice.id);
  });
});
