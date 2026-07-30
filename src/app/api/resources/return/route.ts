import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

// Mark an open borrow returned. The borrower can return their own; an admin can return
// any. The record logs who returned it (returned_by) and when (returned_at).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { borrow_id } = await req.json();
    if (!borrow_id || typeof borrow_id !== 'string') {
      return NextResponse.json({ error: 'Missing borrow_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: borrow, error: borrowErr } = await supabase
      .from('resource_borrows')
      .select('id, member_id, returned_at')
      .eq('id', borrow_id)
      .single();

    if (borrowErr || !borrow) {
      return NextResponse.json({ error: 'Borrow record not found.' }, { status: 404 });
    }
    if (borrow.returned_at) {
      return NextResponse.json({ error: 'This resource has already been returned.' }, { status: 409 });
    }

    const isAdmin = session.role === 'admin';
    const isOwner = borrow.member_id === session.member_id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'You can only return resources you borrowed.' }, { status: 403 });
    }

    const { error: updateErr } = await supabase
      .from('resource_borrows')
      .update({ returned_at: new Date().toISOString(), returned_by: isAdmin && !isOwner ? 'admin' : 'borrower' })
      .eq('id', borrow_id)
      .is('returned_at', null);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to mark returned.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
