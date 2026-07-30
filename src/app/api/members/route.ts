import { NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';

// Directory of approved members for project collaborator / task-assignee pickers.
// Only id/name/pnr are exposed (never email or phone), matching how member
// references already appear elsewhere in the app.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('members')
      .select('id, name, pnr_number')
      .eq('status', 'approved')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, members: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
