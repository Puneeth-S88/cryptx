import crypto from 'crypto';

/**
 * In-Memory Real-Time Broadcast & Notice Dispatcher
 * Synchronizes organizer announcements across /display projector, participant play arena, and leaderboard.
 */

export interface Announcement {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
  active: boolean;
  author: string;
}

// Global in-memory storage (preserved across hot reloads in Next.js development)
declare global {
  // eslint-disable-next-line no-var
  var __cryptex_announcements: Announcement[] | undefined;
}

if (!globalThis.__cryptex_announcements) {
  globalThis.__cryptex_announcements = [
    {
      id: 'init-notice',
      message: 'WELCOME TO CRYPTEX 2026. Round 1 "The Secret Code" is now open. Verify all submissions before final confirm.',
      priority: 'normal',
      createdAt: new Date().toISOString(),
      active: true,
      author: 'Event Command Room (DFL04)',
    },
  ];
}

export function getAllAnnouncements(): Announcement[] {
  return globalThis.__cryptex_announcements || [];
}

export function getActiveAnnouncement(): Announcement | null {
  const list = globalThis.__cryptex_announcements || [];
  return list.find((a) => a.active) || null;
}

export function postAnnouncement(
  message: string,
  priority: 'normal' | 'urgent' = 'normal',
  author: string = 'Command Room'
): Announcement {
  const list = globalThis.__cryptex_announcements || [];

  // Deactivate previous active notices so the newest one takes precedence
  list.forEach((a) => {
    a.active = false;
  });

  const newNotice: Announcement = {
    id: `notice_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    message: message.trim(),
    priority,
    createdAt: new Date().toISOString(),
    active: true,
    author,
  };

  list.unshift(newNotice);
  // Keep last 50 notices max
  if (list.length > 50) {
    list.pop();
  }

  globalThis.__cryptex_announcements = list;
  return newNotice;
}

export function clearActiveAnnouncement(): void {
  const list = globalThis.__cryptex_announcements || [];
  list.forEach((a) => {
    a.active = false;
  });
  globalThis.__cryptex_announcements = list;
}
