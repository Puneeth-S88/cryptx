import { supabaseAdmin } from './supabase/admin';

export interface AuditLogEntry {
  eventId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Appends an entry to the immutable audit log table
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      event_id: entry.eventId || null,
      actor_id: entry.actorId || null,
      actor_email: entry.actorEmail || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      details: entry.details || {},
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    });
  } catch (err) {
    console.error('CRITICAL AUDIT LOG FAILURE:', err);
  }
}
