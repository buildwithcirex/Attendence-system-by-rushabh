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
      .from('calendar_events')
      .select('id, title, event_date, created_by, created_at')
      .order('event_date', { ascending: true });

    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: data });
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
    const { title, event_date } = body;

    if (!title || !event_date) {
      return NextResponse.json({ error: 'Missing title or event_date' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('calendar_events')
      .insert([
        { title, event_date, created_by: admin.member_id }
      ]);

    if (error) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
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
    const event_id = searchParams.get('event_id');

    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', event_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
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
    const { event_id, action } = body;

    if (!event_id || action !== 'restore') {
      return NextResponse.json({ error: 'Missing event_id or invalid action' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: null, deleted_via_member_cascade: false })
      .eq('id', event_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to restore event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
