import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { supabaseAdmin } from '../supabase/admin';

const ELEVATION_DURATION_MINUTES = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export interface VerifyPasswordResult {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
  isLockedOut?: boolean;
}

/**
 * Verifies Organizer Round Control Password and issues a short-lived elevated session
 */
export async function verifyAndElevateOrganizer(
  eventId: string,
  userId: string,
  providedPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<VerifyPasswordResult> {
  // 1. Fetch salted hash and lockout state from private schema
  const { data: secretData, error: secretError } = await supabaseAdmin
    .from('organizer_control_secrets')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (secretError || !secretData) {
    return { success: false, error: 'Event control secret configuration not found.' };
  }

  // 2. Check if currently locked out
  if (secretData.locked_until && new Date(secretData.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(secretData.locked_until).getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      isLockedOut: true,
      error: `Too many failed attempts. Controls locked for ${minutesLeft} more minute(s).`,
    };
  }

  // 3. Verify bcrypt hash
  const isMatch = await bcrypt.compare(providedPassword, secretData.password_hash);

  if (!isMatch) {
    const updatedFailures = (secretData.failed_attempts || 0) + 1;
    let lockoutTime = null;

    if (updatedFailures >= MAX_FAILED_ATTEMPTS) {
      lockoutTime = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
    }

    await supabaseAdmin
      .from('organizer_control_secrets')
      .update({
        failed_attempts: updatedFailures,
        locked_until: lockoutTime,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId);

    // Audit failed attempt
    await supabaseAdmin.from('audit_log').insert({
      event_id: eventId,
      actor_id: userId,
      action: 'ORGANIZER_PASSWORD_GATE_FAILED',
      entity_type: 'event_control',
      entity_id: eventId,
      details: {
        consecutive_failures: updatedFailures,
        locked_out: !!lockoutTime,
      },
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });

    return {
      success: false,
      error: lockoutTime
        ? `5 consecutive failed attempts. Controls locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
        : `Invalid Round Control Password. (${updatedFailures}/${MAX_FAILED_ATTEMPTS} attempts before lockout)`,
    };
  }

  // 4. Success: Reset failure count
  await supabaseAdmin
    .from('organizer_control_secrets')
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  // 5. Generate elevated session token (random 32 bytes)
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + ELEVATION_DURATION_MINUTES * 60 * 1000).toISOString();

  // Invalidate any old session for this user/event
  await supabaseAdmin
    .from('elevated_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);

  // Store new session
  await supabaseAdmin.from('elevated_sessions').insert({
    user_id: userId,
    event_id: eventId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });

  // Audit successful elevation
  await supabaseAdmin.from('audit_log').insert({
    event_id: eventId,
    actor_id: userId,
    action: 'ORGANIZER_PASSWORD_GATE_SUCCESS',
    entity_type: 'elevated_session',
    entity_id: eventId,
    details: { duration_minutes: ELEVATION_DURATION_MINUTES },
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });

  return {
    success: true,
    token,
    expiresAt,
  };
}

/**
 * Validates that an elevated session is active and unexpired. Auto-extends on activity.
 */
export async function assertElevatedSession(
  eventId: string,
  userId: string,
  token: string
): Promise<boolean> {
  if (!token) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: session, error } = await supabaseAdmin
    .from('elevated_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('token_hash', tokenHash)
    .single();

  if (error || !session) return false;

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    // Delete expired session
    await supabaseAdmin.from('elevated_sessions').delete().eq('id', session.id);
    return false;
  }

  // Auto-extend by ELEVATION_DURATION_MINUTES on active use
  const newExpiresAt = new Date(Date.now() + ELEVATION_DURATION_MINUTES * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('elevated_sessions')
    .update({
      expires_at: newExpiresAt,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  return true;
}

/**
 * Manually locks elevated session (Lock Controls button)
 */
export async function lockOrganizerControls(eventId: string, userId: string): Promise<void> {
  await supabaseAdmin
    .from('elevated_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);

  await supabaseAdmin.from('audit_log').insert({
    event_id: eventId,
    actor_id: userId,
    action: 'ORGANIZER_CONTROLS_MANUALLY_LOCKED',
    entity_type: 'elevated_session',
    entity_id: eventId,
    details: { message: 'Organizer explicitly locked control room' },
  });
}
