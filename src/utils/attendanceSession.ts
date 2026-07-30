import { getSupabaseAdmin } from './supabase';
import { createSession } from './session';

type MemberForSession = {
  id: string;
  pnr_number: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
};

const DEFAULT_TARGET_MINUTES = 4 * 60;

// Calendar-day comparison in IST — the members are on-campus in India, so an
// evening session must not "roll over" at midnight UTC and be treated as stale.
function istDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Records (or resumes) an attendance session and mints the app's JWT cookie for it.
 *
 * There is no auto-logout: a session stays open until the member checks out. So on
 * login we reuse an already-open session started on the same day (letting the timer
 * continue seamlessly on a second device) and auto-close any open sessions left over
 * from a previous day as 'abandoned' so they don't produce multi-day timers.
 *
 * Shared by the OTP login route and the admin magic-link callback, which differ only
 * in how the member's identity was proven (otpUsed carries that provenance).
 */
export async function startAttendanceSession(
  member: MemberForSession,
  otpUsed: string,
  targetMinutes: number = DEFAULT_TARGET_MINUTES,
): Promise<{ error: string | null }> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const today = istDay(nowIso);

  const { data: openSessions, error: openErr } = await supabase
    .from('sessions')
    .select('id, login_time, target_minutes')
    .eq('member_id', member.id)
    .is('logout_time', null)
    .order('login_time', { ascending: false });

  if (openErr) {
    return { error: 'Failed to check existing session' };
  }

  const resumable = (openSessions ?? []).find((s) => istDay(s.login_time) === today) ?? null;
  const stale = (openSessions ?? []).filter((s) => s.id !== resumable?.id);

  // Close abandoned prior-day (or superseded) sessions: no verified duration.
  for (const s of stale) {
    await supabase
      .from('sessions')
      .update({ logout_time: s.login_time, logout_type: 'abandoned', duration_minutes: 0 })
      .eq('id', s.id);
  }

  let sessionId: string;
  let loginTime: string;
  let sessionTarget: number;

  if (resumable) {
    sessionId = resumable.id;
    loginTime = resumable.login_time;
    sessionTarget = resumable.target_minutes ?? targetMinutes;
  } else {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        member_id: member.id,
        otp_used: otpUsed,
        login_time: nowIso,
        target_minutes: targetMinutes,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { error: 'Failed to create session' };
    }

    sessionId = data.id;
    loginTime = nowIso;
    sessionTarget = targetMinutes;
  }

  await createSession({
    session_id: sessionId,
    member_id: member.id,
    pnr_number: member.pnr_number,
    name: member.name,
    email: member.email,
    role: member.role,
    login_time: loginTime,
    target_minutes: sessionTarget,
  });

  return { error: null };
}
