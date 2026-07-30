import { NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isOverdue, type ResourceListItem, type ResourceCategory } from '@/utils/resources';

// Member-facing catalog. Returns active resources with their availability, but never
// borrower contact details (Q5 privacy: name + due date only).
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const [resourcesRes, categoriesRes] = await Promise.all([
      supabase
        .from('resources')
        .select('id, title, author, description, condition, cover_image_url, category:resource_categories ( id, name )')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('resource_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    if (resourcesRes.error || categoriesRes.error) {
      return NextResponse.json({ error: 'Failed to load resources' }, { status: 500 });
    }

    const resources = resourcesRes.data ?? [];
    const resourceIds = resources.map((r) => r.id);

    const openBorrows = resourceIds.length
      ? await supabase
          .from('resource_borrows')
          .select('resource_id, borrower_name, expected_return_date')
          .is('returned_at', null)
          .in('resource_id', resourceIds)
      : { data: [], error: null };

    if (openBorrows.error) {
      return NextResponse.json({ error: 'Failed to load resources' }, { status: 500 });
    }

    const borrowByResource = new Map(
      (openBorrows.data ?? []).map((b) => [b.resource_id, b]),
    );

    const items: ResourceListItem[] = resources.map((r) => {
      const category = Array.isArray(r.category) ? r.category[0] : r.category;
      const open = borrowByResource.get(r.id);
      return {
        id: r.id,
        title: r.title,
        author: r.author,
        description: r.description,
        condition: r.condition,
        cover_image_url: r.cover_image_url,
        category: (category as ResourceCategory | null) ?? null,
        borrow: open
          ? {
              borrower_name: open.borrower_name,
              expected_return_date: open.expected_return_date,
              overdue: isOverdue(open.expected_return_date),
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, resources: items, categories: categoriesRes.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
