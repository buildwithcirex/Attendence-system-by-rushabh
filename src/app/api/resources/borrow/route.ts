import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { MAX_ACTIVE_BORROWS } from '@/utils/resources';

// YYYY-MM-DD, not in the past (date-only comparison in server-local time).
function parseReturnDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const due = new Date(`${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (due.getTime() < today.getTime()) return null;
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json();
    const { resource_id } = body;
    const borrowerName = typeof body.borrower_name === 'string' ? body.borrower_name.trim() : '';
    const borrowerEmailRaw = typeof body.borrower_email === 'string' ? body.borrower_email.trim() : '';
    const expectedReturnDate = parseReturnDate(body.expected_return_date);

    if (!resource_id || typeof resource_id !== 'string') {
      return NextResponse.json({ error: 'Missing resource_id.' }, { status: 400 });
    }
    if (!borrowerName) {
      return NextResponse.json({ error: 'Borrower name is required.' }, { status: 400 });
    }
    if (borrowerEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(borrowerEmailRaw)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    if (!expectedReturnDate) {
      return NextResponse.json({ error: 'A valid return date (today or later) is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: resource, error: resourceErr } = await supabase
      .from('resources')
      .select('id, status')
      .eq('id', resource_id)
      .single();

    if (resourceErr || !resource) {
      return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
    }
    if (resource.status !== 'active') {
      return NextResponse.json({ error: 'This resource is not available to borrow.' }, { status: 409 });
    }

    const { count, error: countErr } = await supabase
      .from('resource_borrows')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', session.member_id)
      .is('returned_at', null);

    if (countErr) {
      return NextResponse.json({ error: 'Failed to verify borrow limit.' }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_ACTIVE_BORROWS) {
      return NextResponse.json(
        { error: `You already have ${MAX_ACTIVE_BORROWS} active borrows. Return one first.` },
        { status: 409 },
      );
    }

    const { error: insertErr } = await supabase.from('resource_borrows').insert({
      resource_id,
      member_id: session.member_id,
      borrower_name: borrowerName,
      borrower_email: borrowerEmailRaw || null,
      expected_return_date: expectedReturnDate,
    });

    if (insertErr) {
      // 23505 = unique_violation on the partial index => already borrowed concurrently.
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'This resource was just borrowed by someone else.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to borrow resource.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
