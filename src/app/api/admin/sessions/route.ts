import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabase';
import { requireAdmin } from '@/utils/session';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const showDeleted = searchParams.get('view') === 'deleted';

    const supabase = getSupabaseAdmin();

    let query = supabase
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

    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

    const { data, error } = await query;

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

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', session_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { session_id, action } = body;

    if (!session_id || action !== 'restore') {
      return NextResponse.json({ error: 'Missing session_id or invalid action' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('sessions')
      .update({ deleted_at: null, deleted_via_member_cascade: false })
      .eq('id', session_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to restore session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
