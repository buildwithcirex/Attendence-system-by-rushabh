import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';
import { requireAdmin } from '@/utils/session';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        login_time,
        logout_time,
        duration_minutes,
        work_description,
        logout_type,
        members (
          name,
          pnr_number
        )
      `)
      .order('login_time', { ascending: false });

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const formattedData = data.map((session) => {
      const member = Array.isArray(session.members) ? session.members[0] : session.members;
      return {
        id: session.id,
        member_name: member?.name || 'Unknown',
        pnr_number: member?.pnr_number || 'Unknown',
        login_time: session.login_time,
        logout_time: session.logout_time,
        duration_minutes: session.duration_minutes,
        work_description: session.work_description,
        logout_type: session.logout_type,
      };
    });

    return NextResponse.json({ success: true, sessions: formattedData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
