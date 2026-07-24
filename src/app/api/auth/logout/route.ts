import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';
import { getSession, clearSession } from '@/utils/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { logout_type, logout_time, work_description } = await req.json();

    const supabase = getSupabaseAdmin();

    const loginTime = new Date(session.login_time).getTime();
    const logoutTime = logout_time ? new Date(logout_time).getTime() : Date.now();
    const duration_minutes = Math.floor((logoutTime - loginTime) / (1000 * 60));

    const { error } = await supabase
      .from('sessions')
      .update({
        logout_time: new Date(logoutTime).toISOString(),
        logout_type: logout_type || 'manual',
        work_description: work_description || null,
        duration_minutes,
      })
      .eq('id', session.session_id);

    if (error) {
      console.error('Logout error:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
