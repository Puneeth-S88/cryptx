import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAnnouncements,
  getActiveAnnouncement,
  postAnnouncement,
  clearActiveAnnouncement,
} from '@/lib/broadcast';
import { createAuditLog } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseAndVerifyToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const active = getActiveAnnouncement();
  const announcements = getAllAnnouncements();

  return NextResponse.json({
    active,
    announcements,
  });
}

export async function POST(request: NextRequest) {
  try {
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const payload = token ? parseAndVerifyToken(token) : null;
    if (!payload || payload.role !== 'organizer') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Organizer privilege required to post announcements.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message, priority = 'normal', author = payload.name || 'Command Room' } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Notice message cannot be empty.' },
        { status: 400 }
      );
    }

    const announcement = postAnnouncement(message, priority, author);

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        await supabaseAdmin.from('announcements').insert({
          event_id: '20261111-0000-0000-0000-000000002026',
          title: author,
          message: announcement.message,
          priority: announcement.priority,
          is_active: true,
        });
      } catch (dbErr) {
        console.error('Supabase announcement insert error:', dbErr);
      }
    }

    await createAuditLog({
      action: 'ORGANIZER_BROADCAST_NOTICE',
      entityType: 'announcement',
      entityId: announcement.id,
      actorId: payload.accountId,
      actorEmail: payload.name,
      details: {
        message: announcement.message,
        priority: announcement.priority,
        author: announcement.author,
      },
    });

    return NextResponse.json({
      success: true,
      announcement,
    });
  } catch (err: any) {
    console.error('Failed to post announcement:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to broadcast announcement.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const payload = token ? parseAndVerifyToken(token) : null;
    if (!payload || payload.role !== 'organizer') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Organizer privilege required to clear announcements.' },
        { status: 403 }
      );
    }

    clearActiveAnnouncement();

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        await supabaseAdmin
          .from('announcements')
          .update({ is_active: false })
          .eq('event_id', '20261111-0000-0000-0000-000000002026');
      } catch (dbErr) {
        console.error('Supabase clear announcements error:', dbErr);
      }
    }

    await createAuditLog({
      action: 'ORGANIZER_CLEAR_ANNOUNCEMENT',
      entityType: 'announcement',
      actorId: payload.accountId,
      actorEmail: payload.name,
      details: {
        clearedBy: payload.name || 'Command Room',
      },
    });

    return NextResponse.json({ success: true, message: 'Active announcement cleared.' });
  } catch (err: any) {
    console.error('Supabase clear announcements error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to clear announcements.' },
      { status: 500 }
    );
  }
}
