import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isProjectMember } from '@/utils/projects';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .single();
    if (projectErr || !project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    const isAdmin = session.role === 'admin';
    if (!isAdmin && !(await isProjectMember(id, session.member_id))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, detail, created_at, actor:members!actor_id ( id, name )')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: 'Failed to load activity.' }, { status: 500 });

    const activity = (data ?? []).map((a) => ({
      ...a,
      actor: Array.isArray(a.actor) ? a.actor[0] ?? null : a.actor,
    }));

    return NextResponse.json({ success: true, activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
