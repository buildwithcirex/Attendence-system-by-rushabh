import { NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isOverdue } from '@/utils/resources';

// The current member's own active borrows, with the borrow id so they can self-return.
// Kept separate from the public catalog, which never exposes borrow ids or ownership.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('resource_borrows')
      .select('id, borrowed_at, expected_return_date, resource:resources ( id, title )')
      .eq('member_id', session.member_id)
      .is('returned_at', null)
      .order('borrowed_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to load your borrows' }, { status: 500 });
    }

    const borrows = (data ?? []).map((b) => {
      const resource = Array.isArray(b.resource) ? b.resource[0] : b.resource;
      return {
        id: b.id,
        borrowed_at: b.borrowed_at,
        expected_return_date: b.expected_return_date,
        overdue: isOverdue(b.expected_return_date),
        resource_title: resource?.title ?? 'Unknown',
      };
    });

    return NextResponse.json({ success: true, borrows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
