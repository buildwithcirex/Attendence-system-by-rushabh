import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { isProjectMember, logActivity, TASK_STATUSES, type TaskStatus } from '@/utils/projects';

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return undefined;
  return value;
}

const TASK_SELECT = `
  id, project_id, milestone_id, title, description, status, due_date, created_at, updated_at,
  project:projects ( id, name )
`;

type RawTask = {
  project: { id: string; name: string } | { id: string; name: string }[] | null;
  [key: string]: unknown;
};

function flattenProject(rows: RawTask[]) {
  return rows.map((t) => ({
    ...t,
    project: Array.isArray(t.project) ? t.project[0] ?? null : t.project,
  }));
}

// Drives the dashboard Tasks drawer.
//   default        -> the member's own tasks (assigned to them), all projects + direct.
//   ?scope=claimable -> unassigned, not-done tasks in projects the member belongs to,
//                       which they may claim for themselves.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const scope = req.nextUrl.searchParams.get('scope');

    if (scope === 'claimable') {
      const { data: memberships, error: memErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('member_id', session.member_id);

      if (memErr) {
        return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 });
      }

      const projectIds = (memberships ?? []).map((m) => m.project_id);
      if (projectIds.length === 0) {
        return NextResponse.json({ success: true, tasks: [] });
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .is('assignee_id', null)
        .neq('status', 'done')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, tasks: flattenProject((data ?? []) as RawTask[]) });
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('assignee_id', session.member_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tasks: flattenProject((data ?? []) as RawTask[]) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Create a task under a project (optionally a milestone / assignee). Direct
// (project-less) assignments are created by admins via /api/admin/tasks.
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
    if (!title) return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });

    const isAdmin = session.role === 'admin';
    if (!isAdmin && !(await isProjectMember(projectId, session.member_id))) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const dueDate = parseOptionalDate(body.due_date);
    if (dueDate === undefined) return NextResponse.json({ error: 'Invalid due_date.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const milestoneId = typeof body.milestone_id === 'string' && body.milestone_id ? body.milestone_id : null;
    if (milestoneId) {
      const { data: milestone, error: mErr } = await supabase
        .from('milestones')
        .select('id, project_id')
        .eq('id', milestoneId)
        .single();
      if (mErr || !milestone || milestone.project_id !== projectId) {
        return NextResponse.json({ error: 'Milestone does not belong to this project.' }, { status: 400 });
      }
    }

    const assigneeId = typeof body.assignee_id === 'string' && body.assignee_id ? body.assignee_id : null;
    if (assigneeId && !(await isProjectMember(projectId, assigneeId))) {
      return NextResponse.json({ error: 'Assignee must be a member of the project.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        milestone_id: milestoneId,
        assignee_id: assigneeId,
        created_by_id: session.member_id,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        due_date: dueDate,
        status: 'todo',
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
    }

    await logActivity(projectId, session.member_id, 'task.created', `Created task "${title}"`);

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
    const taskId = typeof body.task_id === 'string' ? body.task_id : '';
    if (!taskId) return NextResponse.json({ error: 'task_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: task, error: findErr } = await supabase
      .from('tasks')
      .select('id, project_id, assignee_id, title')
      .eq('id', taskId)
      .single();
    if (findErr || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    const isAssignee = task.assignee_id === session.member_id;
    const isMember = task.project_id ? await isProjectMember(task.project_id, session.member_id) : false;

    // Project tasks: any project member (or admin) may edit any field. Direct tasks:
    // only the assignee (status only) or an admin.
    const canEditAll = isAdmin || (task.project_id !== null && isMember);
    if (!canEditAll && !isAssignee) {
      return NextResponse.json({ error: 'You cannot edit this task.' }, { status: 403 });
    }

    const update: Record<string, string | number | null> = {};

    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status as TaskStatus)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      update.status = body.status;
    }

    // Fields beyond status require full-edit rights (not merely being the assignee).
    const wantsMore =
      body.title !== undefined ||
      body.description !== undefined ||
      body.due_date !== undefined ||
      body.milestone_id !== undefined ||
      body.assignee_id !== undefined ||
      body.sort_order !== undefined;

    if (wantsMore && !canEditAll) {
      return NextResponse.json({ error: 'You can only change this task’s status.' }, { status: 403 });
    }

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return NextResponse.json({ error: 'Task title cannot be empty.' }, { status: 400 });
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
    if (body.sort_order !== undefined) {
      if (!Number.isInteger(body.sort_order)) {
        return NextResponse.json({ error: 'Invalid sort_order.' }, { status: 400 });
      }
      update.sort_order = body.sort_order;
    }
    if (body.milestone_id !== undefined) {
      const milestoneId = typeof body.milestone_id === 'string' && body.milestone_id ? body.milestone_id : null;
      if (milestoneId) {
        const { data: milestone, error: mErr } = await supabase
          .from('milestones')
          .select('id, project_id')
          .eq('id', milestoneId)
          .single();
        if (mErr || !milestone || milestone.project_id !== task.project_id) {
          return NextResponse.json({ error: 'Milestone does not belong to this project.' }, { status: 400 });
        }
      }
      update.milestone_id = milestoneId;
    }
    if (body.assignee_id !== undefined) {
      const assigneeId = typeof body.assignee_id === 'string' && body.assignee_id ? body.assignee_id : null;
      if (assigneeId && task.project_id && !(await isProjectMember(task.project_id, assigneeId))) {
        return NextResponse.json({ error: 'Assignee must be a member of the project.' }, { status: 400 });
      }
      update.assignee_id = assigneeId;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }
    update.updated_at = new Date().toISOString();

    const { error } = await supabase.from('tasks').update(update).eq('id', taskId);
    if (error) {
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
    }

    if (task.project_id && body.status === 'done') {
      await logActivity(task.project_id, session.member_id, 'task.completed', `Completed task "${task.title}"`);
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

    const taskId = req.nextUrl.searchParams.get('task_id');
    if (!taskId) return NextResponse.json({ error: 'task_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: task, error: findErr } = await supabase
      .from('tasks')
      .select('id, project_id')
      .eq('id', taskId)
      .single();
    if (findErr || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    // Direct (project-less) tasks are admin-owned; only project members delete project tasks.
    const allowed = task.project_id
      ? isAdmin || (await isProjectMember(task.project_id, session.member_id))
      : isAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'You cannot delete this task.' }, { status: 403 });
    }

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
