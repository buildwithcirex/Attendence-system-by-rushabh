import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isProjectMember, PROJECT_STATUSES, type ProjectStatus } from '@/utils/projects';

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return undefined;
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select(`
        id, name, description, status, start_date, due_date, created_at,
        owner:members!owner_id ( id, name, pnr_number )
      `)
      .eq('id', id)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    if (!isAdmin && !(await isProjectMember(id, session.member_id))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const [membersRes, milestonesRes, tasksRes] = await Promise.all([
      supabase
        .from('project_members')
        .select('member:members ( id, name, pnr_number )')
        .eq('project_id', id),
      supabase
        .from('milestones')
        .select('id, project_id, title, description, due_date, status, sort_order, created_at')
        .eq('project_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('tasks')
        .select(`
          id, project_id, milestone_id, title, description, status, due_date, sort_order, created_at,
          assignee:members!assignee_id ( id, name, pnr_number )
        `)
        .eq('project_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (membersRes.error || milestonesRes.error || tasksRes.error) {
      return NextResponse.json({ error: 'Failed to load project details.' }, { status: 500 });
    }

    const members = (membersRes.data ?? [])
      .map((row) => (Array.isArray(row.member) ? row.member[0] ?? null : row.member))
      .filter((m): m is { id: string; name: string; pnr_number: string } => m !== null);

    const tasks = (tasksRes.data ?? []).map((t) => ({
      ...t,
      assignee: Array.isArray(t.assignee) ? t.assignee[0] ?? null : t.assignee,
    }));

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        owner: Array.isArray(project.owner) ? project.owner[0] ?? null : project.owner,
        members,
        milestones: milestonesRes.data ?? [],
        tasks,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Only the owner or an admin may edit or delete a project.
async function requireManager(projectId: string, memberId: string, isAdmin: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();
  if (error || !project) return { ok: false as const, status: 404, error: 'Project not found.' };
  if (!isAdmin && project.owner_id !== memberId) {
    return { ok: false as const, status: 403, error: 'Only the project owner can do this.' };
  }
  return { ok: true as const };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await requireManager(id, session.member_id, session.role === 'admin');
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await req.json();
    const update: Record<string, string | null> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return NextResponse.json({ error: 'Project name cannot be empty.' }, { status: 400 });
      update.name = name;
    }
    if (body.description !== undefined) {
      update.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (body.status !== undefined) {
      if (!PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      update.status = body.status;
    }
    for (const field of ['start_date', 'due_date'] as const) {
      if (body[field] !== undefined) {
        const parsed = parseOptionalDate(body[field]);
        if (parsed === undefined) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
        update[field] = parsed;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }
    update.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('projects').update(update).eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await requireManager(id, session.member_id, session.role === 'admin');
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
