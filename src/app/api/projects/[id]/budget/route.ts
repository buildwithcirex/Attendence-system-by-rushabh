import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { getOrCreateBudgetId, isProjectMember, logActivity, BUDGET_EDITABLE_STATUSES, type BudgetStatus } from '@/utils/projects';

type Access = { isAdmin: boolean; isMember: boolean };

// Confirms the project exists and returns the caller's access to it.
async function resolveAccess(projectId: string, memberId: string, isAdmin: boolean): Promise<Access | null> {
  const supabase = getSupabaseAdmin();
  const { data: project, error } = await supabase.from('projects').select('id').eq('id', projectId).single();
  if (error || !project) return null;
  const isMember = isAdmin ? true : await isProjectMember(projectId, memberId);
  return { isAdmin, isMember };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await params;
    const access = await resolveAccess(id, session.member_id, session.role === 'admin');
    if (!access) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (!access.isAdmin && !access.isMember) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const budgetId = await getOrCreateBudgetId(id);
    if (!budgetId) return NextResponse.json({ error: 'Failed to load budget.' }, { status: 500 });

    const supabase = getSupabaseAdmin();
    const [budgetRes, itemsRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('id, project_id, status, currency, submitted_at, reviewed_at, review_note')
        .eq('id', budgetId)
        .single(),
      supabase
        .from('budget_items')
        .select('id, resource_id, name, quantity, unit_cost, notes, sort_order')
        .eq('budget_id', budgetId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (budgetRes.error || !budgetRes.data || itemsRes.error) {
      return NextResponse.json({ error: 'Failed to load budget.' }, { status: 500 });
    }

    const status = budgetRes.data.status as BudgetStatus;
    const editableState = BUDGET_EDITABLE_STATUSES.includes(status);
    const permissions = {
      can_edit: (access.isMember || access.isAdmin) && editableState,
      can_submit: (access.isMember || access.isAdmin) && editableState,
      can_review: access.isAdmin && status === 'submitted',
      can_reopen: access.isAdmin && (status === 'approved' || status === 'rejected'),
    };

    return NextResponse.json({
      success: true,
      budget: { ...budgetRes.data, items: itemsRes.data ?? [] },
      permissions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Workflow transitions. action: submit (member/admin) | approve | reject | reopen (admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = session.role === 'admin';
    const access = await resolveAccess(id, session.member_id, isAdmin);
    if (!access) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (!access.isAdmin && !access.isMember) {
      return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const budgetId = await getOrCreateBudgetId(id);
    if (!budgetId) return NextResponse.json({ error: 'Failed to load budget.' }, { status: 500 });

    const supabase = getSupabaseAdmin();
    const { data: budget, error: budgetErr } = await supabase
      .from('budgets')
      .select('id, status')
      .eq('id', budgetId)
      .single();
    if (budgetErr || !budget) {
      return NextResponse.json({ error: 'Failed to load budget.' }, { status: 500 });
    }
    const status = budget.status as BudgetStatus;
    const now = new Date().toISOString();

    let update: Record<string, string | null>;
    switch (action) {
      case 'submit': {
        if (!BUDGET_EDITABLE_STATUSES.includes(status)) {
          return NextResponse.json({ error: 'Only a draft budget can be submitted.' }, { status: 409 });
        }
        const { count } = await supabase
          .from('budget_items')
          .select('id', { count: 'exact', head: true })
          .eq('budget_id', budgetId);
        if ((count ?? 0) === 0) {
          return NextResponse.json({ error: 'Add at least one line before submitting.' }, { status: 409 });
        }
        update = { status: 'submitted', submitted_at: now, submitted_by_id: session.member_id, updated_at: now };
        break;
      }
      case 'approve':
      case 'reject': {
        if (!isAdmin) return NextResponse.json({ error: 'Only an admin can review a budget.' }, { status: 403 });
        if (status !== 'submitted') {
          return NextResponse.json({ error: 'Only a submitted budget can be reviewed.' }, { status: 409 });
        }
        update = {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: now,
          reviewed_by_id: session.member_id,
          review_note: note,
          updated_at: now,
        };
        break;
      }
      case 'reopen': {
        if (!isAdmin) return NextResponse.json({ error: 'Only an admin can reopen a budget.' }, { status: 403 });
        if (status !== 'approved' && status !== 'rejected') {
          return NextResponse.json({ error: 'Only an approved or rejected budget can be reopened.' }, { status: 409 });
        }
        update = { status: 'draft', submitted_at: null, reviewed_at: null, review_note: null, updated_at: now };
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const { error } = await supabase.from('budgets').update(update).eq('id', budgetId).eq('status', status);
    if (error) {
      return NextResponse.json({ error: 'Failed to update budget.' }, { status: 500 });
    }

    const activityByAction: Record<string, string> = {
      submit: 'Submitted the budget for approval',
      approve: 'Approved the budget',
      reject: 'Rejected the budget',
      reopen: 'Reopened the budget for edits',
    };
    await logActivity(id, session.member_id, `budget.${action}`, activityByAction[action]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
