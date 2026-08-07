import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const showDeleted = searchParams.get('view') === 'deleted';

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('tasks')
      .select(`
        *,
        member:members ( id, name, pnr_number )
      `)
      .order('created_at', { ascending: false });

    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tasks: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, task_description } = body;

    if (!user_id || !task_description) {
      return NextResponse.json({ error: 'Missing user_id or task_description' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('tasks')
      .insert([
        { user_id, task_description, status: 'pending' }
      ]);

    if (error) {
      return NextResponse.json({ error: 'Failed to assign task' }, { status: 500 });
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
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const body = await req.json();
    const { task_id, status, action } = body;

    if (!task_id) {
      return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (action === 'restore') {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: null, deleted_via_member_cascade: false })
        .eq('id', task_id);

      if (error) {
        return NextResponse.json({ error: 'Failed to restore task' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', task_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get('task_id');

    if (!task_id) {
      return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', task_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
