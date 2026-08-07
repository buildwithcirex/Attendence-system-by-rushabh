import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';

const MAX_DURATION_MINUTES = 4 * 60;

// Sweeps sessions left open because the user closed the tab/browser instead
// of logging out — the client-side auto-logout in /api/session/status only
// fires while a tab is actually polling it, so it never catches these.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - MAX_DURATION_MINUTES * 60 * 1000).toISOString();

  const { data: staleSessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, login_time')
    .is('logout_time', null)
    .is('deleted_at', null)
    .lt('login_time', cutoff);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!staleSessions || staleSessions.length === 0) {
    return NextResponse.json({ closed: 0 });
  }

  await Promise.all(
    staleSessions.map((s) => {
      const logoutTime = new Date(
        new Date(s.login_time).getTime() + MAX_DURATION_MINUTES * 60 * 1000,
      ).toISOString();
      return supabase
        .from('sessions')
        .update({
          logout_time: logoutTime,
          logout_type: 'auto',
          duration_minutes: MAX_DURATION_MINUTES,
        })
        .eq('id', s.id);
    }),
  );

  return NextResponse.json({ closed: staleSessions.length });
}
