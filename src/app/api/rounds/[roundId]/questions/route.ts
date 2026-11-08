import { NextRequest, NextResponse } from 'next/server';
import {
  getQuestionsForRound,
  getQuestionsForRoundAsync,
  saveQuestionsForRound,
  sanitizeQuestionsForParticipant,
} from '@/lib/questions';
import { parseAndVerifyToken } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  try {
    const roundId = params.roundId;
    const questions = await getQuestionsForRoundAsync(roundId);

    // Check if the caller is an organizer
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const payload = token ? parseAndVerifyToken(token) : null;
    const isOrganizer = payload?.role === 'organizer';

    // If organizer, return full drafts including correct answers; otherwise sanitize
    const responseQuestions = isOrganizer
      ? questions
      : sanitizeQuestionsForParticipant(questions);

    return NextResponse.json({
      success: true,
      roundId,
      questions: responseQuestions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve questions.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  try {
    const roundId = params.roundId;
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const payload = parseAndVerifyToken(token);
    if (!payload || payload.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Forbidden: Organizer privilege required to edit questions.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { questions, config, roundType } = body;

    if (!Array.isArray(questions) && !config) {
      return NextResponse.json(
        { success: false, error: 'Questions array or round config is required.' },
        { status: 400 }
      );
    }

    if (config) {
      const isMockUrl =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

      if (!isMockUrl) {
        try {
          const { supabaseAdmin } = await import('@/lib/supabase/admin');
          await supabaseAdmin
            .from('puzzles')
            .upsert({
              round_id: roundId,
              title: `Round ${roundId.toUpperCase()} Configuration`,
              instructions: `Special round configuration for ${roundType || config.round_type || 'special'}`,
              content: config,
            }, { onConflict: 'round_id' });
        } catch (dbErr) {
          console.error('Supabase special round puzzle save error:', dbErr);
        }
      }

      await createAuditLog({
        action: 'SPECIAL_ROUND_CONFIG_UPDATED',
        entityType: 'round_config',
        entityId: roundId,
        details: {
          roundId,
          roundType: roundType || config.round_type,
          organizer: payload.name,
        },
      });

      return NextResponse.json({
        success: true,
        roundId,
        config,
      });
    }

    const saved = await saveQuestionsForRound(roundId, questions);

    await createAuditLog({
      action: 'QUESTIONS_UPDATED',
      entityType: 'round_questions',
      entityId: roundId,
      details: {
        roundId,
        questionCount: saved.length,
        organizer: payload.name,
      },
    });

    return NextResponse.json({
      success: true,
      roundId,
      questions: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save questions.' },
      { status: 500 }
    );
  }
}
