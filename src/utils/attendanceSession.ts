import { getSupabaseAdmin } from './supabase';
import { createSession } from './session';

type MemberForSession = {
  id: string;
  pnr_number: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
};

/**
 * Records a new attendance session row and mints the app's JWT cookie for it.
 * Shared by the OTP login route and the admin magic-link callback, which differ
 * only in how the member's identity was proven (otpUsed carries that provenance).
 */
export async function startAttendanceSession(
  member: MemberForSession,
  otpUsed: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabaseAdmin();
  const login_time = new Date().toISOString();

  // Close any session left open by a previous forgotten logout so it
  // doesn't keep counting as "active" forever or overlap with the new one.
  const { data: staleSessions } = await supabase
    .from('sessions')
    .select('id, login_time')
    .eq('member_id', member.id)
    .is('logout_time', null);

  if (staleSessions && staleSessions.length > 0) {
    await Promise.all(
      staleSessions.map((s) =>
        supabase
          .from('sessions')
          .update({
            logout_time: login_time,
            logout_type: 'stale',
            duration_minutes: Math.floor(
              (new Date(login_time).getTime() - new Date(s.login_time).getTime()) / (1000 * 60),
            ),
          })
          .eq('id', s.id),
      ),
    );
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      member_id: member.id,
      otp_used: otpUsed,
      login_time,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: 'Failed to create session' };
  }

  await createSession({
    session_id: data.id,
    member_id: member.id,
    pnr_number: member.pnr_number,
    name: member.name,
    email: member.email,
    role: member.role,
    login_time,
  });

  return { error: null };
}
