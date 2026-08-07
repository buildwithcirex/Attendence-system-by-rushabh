import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { cascadeDeleteMember, restoreMember } from '@/utils/adminDelete';

const EDITABLE_FIELDS = ['name', 'pnr_number', 'branch_id', 'year_id', 'position_id', 'status'] as const;

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
      .from('members')
      .select(`
        id, name, email, phone_number, pnr_number, status, role, created_at,
        branch:branches ( id, name ),
        year:years ( id, name ),
        position:positions ( id, name )
      `)
      .order('created_at', { ascending: false });

    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: data });
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
    const { user_id, action } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    if (action === 'restore') {
      const { error } = await restoreMember(user_id);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
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
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const { error } = await cascadeDeleteMember(user_id);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
