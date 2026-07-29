import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

// A member submits a donation. It lands as a `pending` resource for admin review;
// it is not borrowable until an admin approves it (sets status = 'active').
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
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

    // A suggested category must reference a real, active category.
    if (categoryId) {
      const { data: category, error: categoryErr } = await supabase
        .from('resource_categories')
        .select('id')
        .eq('id', categoryId)
        .eq('is_active', true)
        .single();
      if (categoryErr || !category) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
    }

    const { error: insertErr } = await supabase.from('resources').insert({
      title,
      category_id: categoryId,
      author: optionalText(body.author),
      description: optionalText(body.description),
      condition: optionalText(body.condition),
      cover_image_url: optionalText(body.cover_image_url),
      added_by_member_id: session.member_id,
      status: 'pending',
    });

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to submit donation.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
