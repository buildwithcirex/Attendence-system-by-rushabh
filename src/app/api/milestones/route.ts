import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isProjectMember, logActivity, MILESTONE_STATUSES, type MilestoneStatus } from '@/utils/projects';

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return undefined;
  return value;
}

// Any project member (or an admin) may manage that project's milestones.
async function canManageProject(projectId: string, memberId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  return isProjectMember(projectId, memberId);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json();
    const projectId = typeof body.project_id === 'string' ? body.project_id : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!projectId) return NextResponse.json({ error: 'project_id is required.' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Milestone title is required.' }, { status: 400 });

    const dueDate = parseOptionalDate(body.due_date);
    if (dueDate === undefined) return NextResponse.json({ error: 'Invalid due_date.' }, { status: 400 });

    if (!(await canManageProject(projectId, session.member_id, session.role === 'admin'))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        due_date: dueDate,
        sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to create milestone.' }, { status: 500 });
    }

    await logActivity(projectId, session.member_id, 'milestone.created', `Added milestone "${title}"`);

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json();
    const milestoneId = typeof body.milestone_id === 'string' ? body.milestone_id : '';
    if (!milestoneId) return NextResponse.json({ error: 'milestone_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: milestone, error: findErr } = await supabase
      .from('milestones')
      .select('id, project_id, title')
      .eq('id', milestoneId)
      .single();
    if (findErr || !milestone) {
      return NextResponse.json({ error: 'Milestone not found.' }, { status: 404 });
    }

    if (!(await canManageProject(milestone.project_id, session.member_id, session.role === 'admin'))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const update: Record<string, string | number | null> = {};
    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return NextResponse.json({ error: 'Milestone title cannot be empty.' }, { status: 400 });
      update.title = title;
    }
    if (body.description !== undefined) {
      update.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (body.due_date !== undefined) {
      const parsed = parseOptionalDate(body.due_date);
      if (parsed === undefined) return NextResponse.json({ error: 'Invalid due_date.' }, { status: 400 });
      update.due_date = parsed;
    }
    if (body.status !== undefined) {
      if (!MILESTONE_STATUSES.includes(body.status as MilestoneStatus)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.sort_order !== undefined) {
      if (!Number.isInteger(body.sort_order)) {
        return NextResponse.json({ error: 'Invalid sort_order.' }, { status: 400 });
      }
      update.sort_order = body.sort_order;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { error } = await supabase.from('milestones').update(update).eq('id', milestoneId);
    if (error) {
      return NextResponse.json({ error: 'Failed to update milestone.' }, { status: 500 });
    }

    if (body.status === 'completed') {
      await logActivity(milestone.project_id, session.member_id, 'milestone.completed', `Completed milestone "${milestone.title}"`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const milestoneId = req.nextUrl.searchParams.get('milestone_id');
    if (!milestoneId) return NextResponse.json({ error: 'milestone_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: milestone, error: findErr } = await supabase
      .from('milestones')
      .select('id, project_id')
      .eq('id', milestoneId)
      .single();
    if (findErr || !milestone) {
      return NextResponse.json({ error: 'Milestone not found.' }, { status: 404 });
    }

    if (!(await canManageProject(milestone.project_id, session.member_id, session.role === 'admin'))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    // Tasks keep existing but detach from the deleted milestone (FK is ON DELETE SET NULL).
    const { error } = await supabase.from('milestones').delete().eq('id', milestoneId);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete milestone.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
