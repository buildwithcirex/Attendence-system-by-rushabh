import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { logActivity } from '@/utils/projects';

// Owner or admin may manage a project's membership. Returns the project's owner_id
// on success so the caller can protect the owner from removal.
async function requireManager(projectId: string, memberId: string, isAdmin: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();
  if (error || !project) return { ok: false as const, status: 404, error: 'Project not found.' };
  if (!isAdmin && project.owner_id !== memberId) {
    return { ok: false as const, status: 403, error: 'Only the project owner can manage members.' };
  }
  return { ok: true as const, ownerId: project.owner_id };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const newMemberId = typeof body.member_id === 'string' ? body.member_id : '';
    if (!newMemberId) {
      return NextResponse.json({ error: 'member_id is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, name, status')
      .eq('id', newMemberId)
      .single();
    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }
    if (member.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved members can be added.' }, { status: 409 });
    }

    const { error: insertErr } = await supabase
      .from('project_members')
      .insert({ project_id: id, member_id: newMemberId });
    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'That member is already on the project.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 });
    }

    await logActivity(id, session.member_id, 'member.added', `Added ${member.name} to the project`);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const targetMemberId = req.nextUrl.searchParams.get('member_id');
    if (!targetMemberId) {
      return NextResponse.json({ error: 'member_id is required.' }, { status: 400 });
    }
    if (targetMemberId === guard.ownerId) {
      return NextResponse.json({ error: 'The owner cannot be removed from the project.' }, { status: 409 });
    }

    const supabase = getSupabaseAdmin();

    // Unassign this member from any of the project's tasks before removing them.
    const { error: unassignErr } = await supabase
      .from('tasks')
      .update({ assignee_id: null })
      .eq('project_id', id)
      .eq('assignee_id', targetMemberId);
    if (unassignErr) {
      return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 });
    }

    const { data: removed } = await supabase
      .from('members')
      .select('name')
      .eq('id', targetMemberId)
      .maybeSingle();

    const { error: deleteErr } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', id)
      .eq('member_id', targetMemberId);
    if (deleteErr) {
      return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 });
    }

    await logActivity(id, session.member_id, 'member.removed', `Removed ${removed?.name ?? 'a member'} from the project`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
