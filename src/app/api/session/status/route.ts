import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: member } = await supabase
      .from('members')
      .select('deleted_at')
      .eq('id', session.member_id)
      .single();

    if (member?.deleted_at) {
      await clearSession();
      return NextResponse.json({ authenticated: false, reason: 'account_deleted' }, { status: 401 });
    }

    const loginTime = new Date(session.login_time).getTime();
    const now = Date.now();
    const elapsed = now - loginTime;
    const MAX_DURATION = 4 * 60 * 60 * 1000; // 4 hours in ms

    if (elapsed >= MAX_DURATION) {
      // Auto-logout
      await supabase
        .from('sessions')
        .update({
          logout_time: new Date(loginTime + MAX_DURATION).toISOString(),
          logout_type: 'auto',
          duration_minutes: 4 * 60,
        })
        .eq('id', session.session_id);

      await clearSession();

      return NextResponse.json({ authenticated: false, reason: 'auto_logout' }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true, session, serverNow: Date.now() });
  } catch (err) {
    console.error('Session status error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
