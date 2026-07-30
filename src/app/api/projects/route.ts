import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { logActivity, type TaskStatus } from '@/utils/projects';

// Optional YYYY-MM-DD date; returns null for absent, undefined for malformed.
function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return undefined;
  return value;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const isAdmin = session.role === 'admin';

    let projectIds: string[] | null = null;
    if (!isAdmin) {
      const { data: memberships, error: membershipErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('member_id', session.member_id);
      if (membershipErr) {
        return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
      }
      projectIds = (memberships ?? []).map((m) => m.project_id);
      if (projectIds.length === 0) {
        return NextResponse.json({ success: true, projects: [] });
      }
    }

    let query = supabase
      .from('projects')
      .select(`
        id, name, description, status, start_date, due_date, created_at,
        owner:members!owner_id ( id, name, pnr_number )
      `)
      .order('created_at', { ascending: false });
    if (projectIds) {
      query = query.in('id', projectIds);
    }

    const { data: projects, error: projectsErr } = await query;
    if (projectsErr) {
      return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
    }

    const ids = (projects ?? []).map((p) => p.id);
    const { data: taskRows, error: tasksErr } = ids.length
      ? await supabase.from('tasks').select('project_id, status').in('project_id', ids)
      : { data: [], error: null };
    if (tasksErr) {
      return NextResponse.json({ error: 'Failed to load task counts.' }, { status: 500 });
    }

    const progress = new Map<string, { done: number; total: number }>();
    for (const row of taskRows ?? []) {
      if (!row.project_id) continue;
      const entry = progress.get(row.project_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if ((row.status as TaskStatus) === 'done') entry.done += 1;
      progress.set(row.project_id, entry);
    }

    const result = (projects ?? []).map((p) => ({
      ...p,
      owner: Array.isArray(p.owner) ? p.owner[0] ?? null : p.owner,
      task_done: progress.get(p.id)?.done ?? 0,
      task_total: progress.get(p.id)?.total ?? 0,
    }));

    return NextResponse.json({ success: true, projects: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
    }
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;
    const startDate = parseOptionalDate(body.start_date);
    const dueDate = parseOptionalDate(body.due_date);
    if (startDate === undefined || dueDate === undefined) {
      return NextResponse.json({ error: 'Dates must be valid (YYYY-MM-DD).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: insertErr } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        owner_id: session.member_id,
        start_date: startDate,
        due_date: dueDate,
      })
      .select('id')
      .single();

    if (insertErr || !project) {
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
    }

    // Owner is also a member, so "projects I belong to" is a single membership query.
    const { error: memberErr } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, member_id: session.member_id });

    if (memberErr) {
      // Roll back the orphaned project rather than leave it ownerless in listings.
      await supabase.from('projects').delete().eq('id', project.id);
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
    }

    await logActivity(project.id, session.member_id, 'project.created', `Created project "${name}"`);

    return NextResponse.json({ success: true, id: project.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
