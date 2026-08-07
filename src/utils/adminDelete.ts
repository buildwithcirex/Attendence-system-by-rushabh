import { getSupabaseAdmin } from './supabase';

type CascadeResult = { error: string | null };

/**
 * Soft-deletes a member and, in the same operation, every session/task/
 * calendar_event tied to them. All rows share one deleted_at timestamp so
 * restoreMember can find exactly this batch later via deleted_via_member_cascade.
 */
export async function cascadeDeleteMember(memberId: string): Promise<CascadeResult> {
  const supabase = getSupabaseAdmin();

  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('id, role, deleted_at')
    .eq('id', memberId)
    .single();

  if (fetchError || !member) {
    return { error: 'Member not found' };
  }
  if (member.role === 'admin') {
    return { error: 'Cannot delete an admin account' };
  }
  if (member.deleted_at) {
    return { error: 'Member is already deleted' };
  }

  const deletedAt = new Date().toISOString();

  const { error: memberError } = await supabase
    .from('members')
    .update({ deleted_at: deletedAt })
    .eq('id', memberId);
  if (memberError) {
    return { error: 'Failed to delete member' };
  }

  await Promise.all([
    supabase
      .from('sessions')
      .update({ deleted_at: deletedAt, deleted_via_member_cascade: true })
      .eq('member_id', memberId)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .update({ deleted_at: deletedAt, deleted_via_member_cascade: true })
      .eq('user_id', memberId)
      .is('deleted_at', null),
    supabase
      .from('calendar_events')
      .update({ deleted_at: deletedAt, deleted_via_member_cascade: true })
      .eq('created_by', memberId)
      .is('deleted_at', null),
  ]);

  return { error: null };
}

/**
 * Restores a soft-deleted member and any sessions/tasks/calendar_events that
 * were cascade-deleted alongside them (same deleted_at timestamp).
 */
export async function restoreMember(memberId: string): Promise<CascadeResult> {
  const supabase = getSupabaseAdmin();

  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('id, deleted_at')
    .eq('id', memberId)
    .single();

  if (fetchError || !member) {
    return { error: 'Member not found' };
  }
  if (!member.deleted_at) {
    return { error: 'Member is not deleted' };
  }

  const cascadeTimestamp = member.deleted_at;

  const { error: memberError } = await supabase
    .from('members')
    .update({ deleted_at: null })
    .eq('id', memberId);
  if (memberError) {
    return { error: 'Failed to restore member' };
  }

  await Promise.all([
    supabase
      .from('sessions')
      .update({ deleted_at: null, deleted_via_member_cascade: false })
      .eq('member_id', memberId)
      .eq('deleted_at', cascadeTimestamp)
      .eq('deleted_via_member_cascade', true),
    supabase
      .from('tasks')
      .update({ deleted_at: null, deleted_via_member_cascade: false })
      .eq('user_id', memberId)
      .eq('deleted_at', cascadeTimestamp)
      .eq('deleted_via_member_cascade', true),
    supabase
      .from('calendar_events')
      .update({ deleted_at: null, deleted_via_member_cascade: false })
      .eq('created_by', memberId)
      .eq('deleted_at', cascadeTimestamp)
      .eq('deleted_via_member_cascade', true),
  ]);

  return { error: null };
}
