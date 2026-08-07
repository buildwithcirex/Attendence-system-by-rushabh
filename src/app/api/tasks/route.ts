import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.member_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tasks: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const body = await req.json();
    const { task_id, status } = body;

    if (!task_id || !status) {
      return NextResponse.json({ error: 'Missing task_id or status' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Only allow updating tasks belonging to the current user
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', task_id)
      .eq('user_id', session.member_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
