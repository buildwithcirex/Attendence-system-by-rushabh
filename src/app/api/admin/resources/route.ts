import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isOverdue } from '@/utils/resources';

const EDITABLE_FIELDS = ['title', 'category_id', 'author', 'description', 'condition', 'cover_image_url'] as const;

// Full admin view: every resource (any status), its donor, and the open borrow WITH
// contact details (admins are the only role allowed to see borrower email — Q5).
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: resources, error: resourcesErr } = await supabase
      .from('resources')
      .select(`
        id, title, author, description, condition, cover_image_url, status, created_at,
        category:resource_categories ( id, name ),
        donor:members!resources_added_by_member_id_fkey ( id, name, pnr_number )
      `)
      .order('created_at', { ascending: false });

    if (resourcesErr) {
      return NextResponse.json({ error: 'Failed to load resources' }, { status: 500 });
    }

    const resourceIds = (resources ?? []).map((r) => r.id);
    const openBorrows = resourceIds.length
      ? await supabase
          .from('resource_borrows')
          .select('id, resource_id, borrower_name, borrower_email, borrowed_at, expected_return_date, member_id')
          .is('returned_at', null)
          .in('resource_id', resourceIds)
      : { data: [], error: null };

    if (openBorrows.error) {
      return NextResponse.json({ error: 'Failed to load borrows' }, { status: 500 });
    }

    const borrowByResource = new Map((openBorrows.data ?? []).map((b) => [b.resource_id, b]));

    const withBorrow = (resources ?? []).map((r) => {
      const open = borrowByResource.get(r.id);
      return {
        ...r,
        category: Array.isArray(r.category) ? r.category[0] ?? null : r.category,
        donor: Array.isArray(r.donor) ? r.donor[0] ?? null : r.donor,
        borrow: open ? { ...open, overdue: isOverdue(open.expected_return_date) } : null,
      };
    });

    return NextResponse.json({ success: true, resources: withBorrow });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Admin adds a resource directly (goes live immediately as 'active').
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const optionalText = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };
    const categoryId = typeof body.category_id === 'string' && body.category_id ? body.category_id : null;

    const supabase = getSupabaseAdmin();
    const { error: insertErr } = await supabase.from('resources').insert({
      title,
      category_id: categoryId,
      author: optionalText(body.author),
      description: optionalText(body.description),
      condition: optionalText(body.condition),
      cover_image_url: optionalText(body.cover_image_url),
      added_by_member_id: admin.member_id,
      status: 'active',
    });

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to add resource.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// action: approve | reject | update | retire | reactivate
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized access.' }, { status: 403 });
    }

    const body = await req.json();
    const { resource_id, action } = body;
    if (!resource_id || typeof resource_id !== 'string') {
      return NextResponse.json({ error: 'Missing resource_id.' }, { status: 400 });
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

    // Guard: a resource with an open borrow can't be rejected or retired (Q12).
    const hasOpenBorrow = async (): Promise<boolean> => {
      const { count } = await supabase
        .from('resource_borrows')
        .select('id', { count: 'exact', head: true })
        .eq('resource_id', resource_id)
        .is('returned_at', null);
      return (count ?? 0) > 0;
    };

    if (action === 'approve') {
      if (resource.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending donations can be approved.' }, { status: 409 });
      }
      const { error } = await supabase.from('resources').update({ status: 'active' }).eq('id', resource_id);
      if (error) return NextResponse.json({ error: 'Failed to approve donation.' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      if (resource.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending donations can be rejected.' }, { status: 409 });
      }
      const { error } = await supabase.from('resources').delete().eq('id', resource_id);
      if (error) return NextResponse.json({ error: 'Failed to reject donation.' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'retire') {
      if (await hasOpenBorrow()) {
        return NextResponse.json({ error: 'Cannot retire a resource that is currently borrowed.' }, { status: 409 });
      }
      const { error } = await supabase.from('resources').update({ status: 'inactive' }).eq('id', resource_id);
      if (error) return NextResponse.json({ error: 'Failed to retire resource.' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'reactivate') {
      const { error } = await supabase.from('resources').update({ status: 'active' }).eq('id', resource_id);
      if (error) return NextResponse.json({ error: 'Failed to reactivate resource.' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const updates: Record<string, unknown> = {};
      for (const field of EDITABLE_FIELDS) {
        if (field in body) {
          const value = body[field];
          updates[field] = typeof value === 'string' && value.trim() === '' ? null : value;
        }
      }
      if ('title' in updates && !updates.title) {
        return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 });
      }
      const { error } = await supabase.from('resources').update(updates).eq('id', resource_id);
      if (error) return NextResponse.json({ error: 'Failed to update resource.' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
