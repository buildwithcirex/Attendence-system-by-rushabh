import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isOverdue } from '@/utils/resources';

// Full borrow ledger ("warehouse view"): every borrow ever, open or returned, with
// the item, the member, and the condition/damage record. Admin only. Optional
// filters: ?status=open|returned and ?flagged=true.
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('resource_borrows')
      .select(`
        id, borrower_name, borrower_email, borrowed_at, expected_return_date,
        returned_at, returned_by, condition_out, condition_in, damage_note, flagged,
        resource:resources ( id, title ),
        member:members ( id, name, pnr_number )
      `)
      .order('borrowed_at', { ascending: false })
      .limit(500);

    const status = req.nextUrl.searchParams.get('status');
    if (status === 'open') query = query.is('returned_at', null);
    if (status === 'returned') query = query.not('returned_at', 'is', null);
    if (req.nextUrl.searchParams.get('flagged') === 'true') query = query.eq('flagged', true);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to load borrow history.' }, { status: 500 });
    }

    const borrows = (data ?? []).map((b) => ({
      ...b,
      resource: Array.isArray(b.resource) ? b.resource[0] ?? null : b.resource,
      member: Array.isArray(b.member) ? b.member[0] ?? null : b.member,
      overdue: !b.returned_at && isOverdue(b.expected_return_date),
    }));

    return NextResponse.json({ success: true, borrows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
