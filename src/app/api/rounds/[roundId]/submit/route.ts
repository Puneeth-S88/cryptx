import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAuditLog } from '@/lib/audit';
import { validateSession } from '@/lib/session';
import { updateTeamScore } from '@/lib/teams';
import { getRoundById, getRoundByIdAsync } from '@/lib/rounds';
import { getQuestionsForRound, getQuestionsForRoundAsync } from '@/lib/questions';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { recordSubmissionAndScore } from '@/lib/supabase/sync';
import {
  evaluateRound1,
  evaluateRound2,
  evaluateRound3,
  evaluateRound4,
  evaluateRound5,
  evaluateRound6,
  evaluateRound7,
  evaluateRound8,
  type EvaluationResult,
} from '@/lib/crypto/evaluators';
import {
  evaluateStandardQuizRound,
  type StandardQuestionSecret,
  type StandardQuestionSubmission,
} from '@/lib/crypto/standard-quiz-evaluator';

// Default official secret keys (matches seeded PostgreSQL private tables)
const DEFAULT_R1_SECRETS = {
  answers: { '1': 'B', '2': 'A', '3': 'C', '4': 'B', '5': 'KEY' },
  points_per_item: 20,
};

const DEFAULT_R2_SECRETS = {
  items: [
    { id: 1, method: 'Caesar Shift 3', plaintext: 'CAT', points: 50 },
    { id: 2, method: 'Atbash Cipher', plaintext: 'THE', points: 50 },
    { id: 3, method: 'Binary (ASCII)', plaintext: 'HI', points: 50 },
  ],
};

const DEFAULT_R3_SECRETS = {
  normalized_plaintext: 'MEETATGATE',
  points: 150,
};

const DEFAULT_R4_SECRETS = {
  solutions: {
    '1': 'VIGENERE',
    '2': 'ALPHABET',
    '3': 'PUZZLE',
    '4': 'LEVEL',
    '5': 'TEXT',
  },
  points_per_word: 30,
};

const DEFAULT_R5_SECRETS = {
  solutions: {
    UQZT: 'GATE',
    XFRTK: 'UNDER',
    QEETLL: 'ACCESS',
    KTLTZ: 'RESET',
    RGGK: 'DOOR',
  },
  points_per_word: 40,
};

const DEFAULT_R6_SECRETS = {
  normalized_plaintext: 'MEETATDAWN',
  base_points: 200,
};

const DEFAULT_R7_SECRETS = {
  normalized_plaintext: 'CODE',
  points: 200,
};

const DEFAULT_R8_SECRETS = {
  plaintext: 'ATTACKATDAWN',
  plaintext_points: 150,
  explanation_points: 150,
  required_explanation_keywords: [
    'vigenere',
    'lemon',
    'repeat',
    'shift',
    'modular',
    'polyalphabetic',
  ],
};

export async function POST(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  try {
    const roundId = params.roundId;
    const body = await request.json().catch(() => ({}));
    let { teamId, payload, telemetry, answers } = body;
    if (!payload && answers) {
      payload = answers;
    }

    // 0. Single-Device Session Validation & Team Identity Verification
    const sessionToken =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Session required for answer submission.' },
        { status: 401 }
      );
    }

    const val = validateSession(sessionToken);
    if (val.superseded) {
      return NextResponse.json(
        {
          success: false,
          superseded: true,
          error:
            'Another device has logged into this account. For competition integrity, your session on this device has ended.',
        },
        { status: 401 }
      );
    }

    if (!val.valid || !val.session) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

    if (!teamId) {
      teamId = val.session.teamId || val.session.accountId;
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId is required for submission.' },
        { status: 400 }
      );
    }

    // Verify team identity: participants can only submit for their own team
    if (val.session.role !== 'organizer' && val.session.teamId !== teamId && val.session.accountId !== teamId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You cannot submit answers on behalf of another team.' },
        { status: 403 }
      );
    }

    // 1. Rate Limiting: Max 20 submissions per team per minute
    const rl = checkRateLimit({
      key: `sub_limit_${teamId}_${roundId}`,
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many submissions. Please wait ${Math.ceil(rl.resetInMs / 1000)}s.`,
        },
        { status: 429 }
      );
    }

    // 2. Round Lifecycle Gate (authoritatively queried from Supabase/event_rounds)
    const isMock =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');
    let roundState: string | undefined;

    if (!isMock) {
      const clean = String(roundId).trim();
      let query = supabaseAdmin.from('event_rounds').select('id, round_number, state');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(clean)) {
        query = query.eq('id', clean);
      } else if (clean.toLowerCase().startsWith('r')) {
        const num = parseInt(clean.slice(1), 10);
        query = query.eq('round_number', num);
      } else if (/^\d+$/.test(clean)) {
        query = query.eq('round_number', parseInt(clean, 10));
      } else {
        query = query.eq('id', clean);
      }
      const { data: dbRound } = await query.maybeSingle();
      if (dbRound) {
        roundState = dbRound.state;
      }
    }

    if (!roundState) {
      const serverRound = await getRoundByIdAsync(roundId);
      roundState = serverRound?.state;
    }

    if (roundState !== 'open') {
      return NextResponse.json(
        {
          success: false,
          error: 'Round is closed or locked. Submissions are no longer accepted.',
        },
        { status: 403 }
      );
    }

    let result: EvaluationResult;

    // Normalize round identification (e.g. 'r1', 'r2', etc. or UUIDs)
    const rid = String(roundId).toLowerCase();
    const serverQuestions = await getQuestionsForRoundAsync(roundId);

    // If Round 2 structured cipher items are submitted, score via evaluateRound2
    if ((rid === 'r2' || rid.includes('round-2') || rid === '2') && payload?.items) {
      result = evaluateRound2(
        { items: payload.items },
        DEFAULT_R2_SECRETS
      );
    } else if (serverQuestions && serverQuestions.length > 0) {
      let earnedScore = 0;
      const breakdown: Record<string, any> = {};

      serverQuestions.forEach((q, idx) => {
        const qKey = q.id || `q${idx + 1}`;
        const ans =
          payload?.[qKey] ??
          payload?.[`q${idx + 1}`] ??
          payload?.[String(idx + 1)] ??
          payload?.text_answer ??
          (Array.isArray(payload)
            ? payload.find((p: any) => p.question_id === qKey || p.question_id === String(idx + 1))?.answer ??
              payload.find((p: any) => p.question_id === qKey || p.question_id === String(idx + 1))?.text_answer ??
              payload.find((p: any) => p.question_id === qKey || p.question_id === String(idx + 1))?.selected_option_index
            : undefined);

        let isCorrect = false;

        if (q.question_type === 'mcq') {
          const correctLetter = String.fromCharCode(65 + q.correct_option_index);
          const cleanAns = String(ans ?? '').trim().toUpperCase();
          isCorrect = cleanAns === correctLetter || cleanAns === String(q.correct_option_index);
        } else if (q.question_type === 'text') {
          const cleanAns = String(ans ?? '').trim();
          const ignoreCase = q.text_settings?.ignore_case ?? true;
          const ignorePunct = q.text_settings?.ignore_punct_space ?? true;
          const norm = (s: string) => {
            let res = s.trim();
            if (ignoreCase) res = res.toUpperCase();
            if (ignorePunct) res = res.replace(/[^A-Z0-9]/gi, '');
            else res = res.replace(/\s+/g, ' ');
            return res;
          };
          const normalizedAns = norm(cleanAns);
          isCorrect = (q.accepted_answers || []).some((a) => norm(a) === normalizedAns);
        }

        const pts = isCorrect ? q.points : 0;
        earnedScore += pts;
        breakdown[qKey] = {
          is_correct: isCorrect,
          points_awarded: pts,
          max_points: q.points,
        };
      });

      const totalPossible = serverQuestions.reduce((acc, q) => acc + q.points, 0);
      result = {
        score: earnedScore,
        maxScore: totalPossible,
        breakdown,
        isFullyCorrect: earnedScore === totalPossible && totalPossible > 0,
      };
    } else if (rid === 'r1' || rid.includes('round-1') || rid.includes('1')) {
      if (Array.isArray(payload)) {
        // Standard question format
        const standardSecrets: StandardQuestionSecret[] = [
          { question_id: '1', type: 'mcq', points: 20, correct_option_index: 1 },
          { question_id: '2', type: 'mcq', points: 20, correct_option_index: 0 },
          { question_id: '3', type: 'mcq', points: 20, correct_option_index: 2 },
          { question_id: '4', type: 'mcq', points: 20, correct_option_index: 1 },
          {
            question_id: '5',
            type: 'text',
            points: 20,
            accepted_answers: ['KEY', 'THE KEY'],
          },
        ];
        result = evaluateStandardQuizRound(payload as StandardQuestionSubmission[], standardSecrets);
      } else {
        result = evaluateRound1(
          { answers: payload?.answers || payload || {} },
          DEFAULT_R1_SECRETS
        );
      }
    } else if (rid === 'r2' || rid.includes('round-2') || rid.includes('2')) {
      result = evaluateRound2(
        { items: payload?.items || [] },
        DEFAULT_R2_SECRETS
      );
    } else if (rid === 'r3' || rid.includes('round-3') || rid.includes('3')) {
      result = evaluateRound3(
        { message: payload?.message || payload?.plaintext || '' },
        DEFAULT_R3_SECRETS
      );
    } else if (rid === 'r4' || rid.includes('round-4') || rid.includes('4')) {
      result = evaluateRound4(
        payload?.solutions || payload || {},
        DEFAULT_R4_SECRETS
      );
    } else if (rid === 'r5' || rid.includes('round-5') || rid.includes('5')) {
      result = evaluateRound5(
        payload?.decodings || payload || {},
        DEFAULT_R5_SECRETS
      );
    } else if (rid === 'r6' || rid.includes('round-6') || rid.includes('6')) {
      const hintsCount = Number(payload?.hintsUsed || 0);
      result = evaluateRound6(
        payload || {},
        DEFAULT_R6_SECRETS,
        hintsCount
      );
    } else if (rid === 'r7' || rid.includes('round-7') || rid.includes('7')) {
      result = evaluateRound7(
        payload || {},
        DEFAULT_R7_SECRETS
      );
    } else if (rid === 'r8' || rid.includes('round-8') || rid.includes('8')) {
      result = evaluateRound8(
        payload || {},
        DEFAULT_R8_SECRETS
      );
    } else {
      // Generic standard quiz fallback
      if (Array.isArray(payload)) {
        result = evaluateStandardQuizRound(payload, []);
      } else {
        result = {
          score: 0,
          maxScore: 100,
          breakdown: {},
          isFullyCorrect: false,
        };
      }
    }

    // Extract numeric round number (e.g. 'r1' -> 1, '2' -> 2)
    const roundNumber = rid.startsWith('r')
      ? parseInt(rid.slice(1), 10) || 1
      : parseInt(rid, 10) || 1;

    // Update authoritative team scores in memory
    updateTeamScore(teamId, roundNumber, result.score);

    // Synchronize score and submission to Supabase
    await recordSubmissionAndScore({
      teamIdOrCode: teamId,
      roundIdOrNumber: roundId,
      score: result.score,
      breakdown: result.breakdown,
      submissionPayload: payload,
    });

    // Server-side audit logging
    await createAuditLog({
      action: 'TEAM_ROUND_SUBMISSION',
      entityType: 'submission',
      entityId: `${teamId}_${roundId}`,
      details: {
        roundId,
        teamId,
        score: result.score,
        maxScore: result.maxScore,
        isFullyCorrect: result.isFullyCorrect,
        telemetry: telemetry || {},
      },
    });

    return NextResponse.json({
      success: true,
      score: result.score,
      scoreAwarded: result.score,
      maxScore: result.maxScore,
      breakdown: result.breakdown,
      isFullyCorrect: result.isFullyCorrect,
    });
  } catch (err: any) {
    console.error('Submission processing error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error while scoring submission.' },
      { status: 500 }
    );
  }
}
