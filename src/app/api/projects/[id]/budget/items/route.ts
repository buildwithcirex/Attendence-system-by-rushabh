import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { getOrCreateBudgetId, isProjectMember, BUDGET_EDITABLE_STATUSES, type BudgetStatus } from '@/utils/projects';

type EditableBudget = { budgetId: string };
type Guard = EditableBudget | { error: string; status: number };

// Resolves the project's budget and asserts the caller may edit it right now
// (project member or admin, and the budget is in a draft/rejected state).
async function requireEditableBudget(projectId: string, memberId: string, isAdmin: boolean): Promise<Guard> {
  const supabase = getSupabaseAdmin();
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();
  if (projectErr || !project) return { error: 'Project not found.', status: 404 };

  if (!isAdmin && !(await isProjectMember(projectId, memberId))) {
    return { error: 'You do not have access to this project.', status: 403 };
  }

  const budgetId = await getOrCreateBudgetId(projectId);
  if (!budgetId) return { error: 'Failed to load budget.', status: 500 };

  const { data: budget, error: budgetErr } = await supabase
    .from('budgets')
    .select('status')
    .eq('id', budgetId)
    .single();
  if (budgetErr || !budget) return { error: 'Failed to load budget.', status: 500 };

  if (!BUDGET_EDITABLE_STATUSES.includes(budget.status as BudgetStatus)) {
    return { error: 'This budget is locked and cannot be edited.', status: 409 };
  }

  return { budgetId };
}

function parseQuantity(value: unknown): number | null {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || (value as number) < 1) return null;
  return value as number;
}

function parseUnitCost(value: unknown): number | null {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  // Two decimal places, matching NUMERIC(12,2).
  return Math.round(value * 100) / 100;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const guard = await requireEditableBudget(id, session.member_id, session.role === 'admin');
    if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = await req.json();
    const quantity = parseQuantity(body.quantity);
    const unitCost = parseUnitCost(body.unit_cost);
    if (quantity === null) return NextResponse.json({ error: 'Quantity must be a positive whole number.' }, { status: 400 });
    if (unitCost === null) return NextResponse.json({ error: 'Unit cost must be zero or more.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    let name = typeof body.name === 'string' ? body.name.trim() : '';
    let resourceId: string | null = null;
    if (typeof body.resource_id === 'string' && body.resource_id) {
      const { data: resource, error: resourceErr } = await supabase
        .from('resources')
        .select('id, title')
        .eq('id', body.resource_id)
        .single();
      if (resourceErr || !resource) {
        return NextResponse.json({ error: 'Referenced resource not found.' }, { status: 404 });
      }
      resourceId = resource.id;
      if (!name) name = resource.title;
    }

    if (!name) return NextResponse.json({ error: 'A line item name is required.' }, { status: 400 });

    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        budget_id: guard.budgetId,
        resource_id: resourceId,
        name,
        quantity,
        unit_cost: unitCost,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
        sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to add line item.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const guard = await requireEditableBudget(id, session.member_id, session.role === 'admin');
    if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = await req.json();
    const itemId = typeof body.item_id === 'string' ? body.item_id : '';
    if (!itemId) return NextResponse.json({ error: 'item_id is required.' }, { status: 400 });

    const update: Record<string, string | number | null> = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
      update.name = name;
    }
    if (body.quantity !== undefined) {
      const quantity = parseQuantity(body.quantity);
      if (quantity === null) return NextResponse.json({ error: 'Quantity must be a positive whole number.' }, { status: 400 });
      update.quantity = quantity;
    }
    if (body.unit_cost !== undefined) {
      const unitCost = parseUnitCost(body.unit_cost);
      if (unitCost === null) return NextResponse.json({ error: 'Unit cost must be zero or more.' }, { status: 400 });
      update.unit_cost = unitCost;
    }
    if (body.notes !== undefined) {
      update.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Scope the update to this budget so an item id from another project can't be touched.
    const { data, error } = await supabase
      .from('budget_items')
      .update(update)
      .eq('id', itemId)
      .eq('budget_id', guard.budgetId)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Failed to update line item.' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Line item not found.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const guard = await requireEditableBudget(id, session.member_id, session.role === 'admin');
    if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const itemId = req.nextUrl.searchParams.get('item_id');
    if (!itemId) return NextResponse.json({ error: 'item_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', itemId)
      .eq('budget_id', guard.budgetId);
    if (error) return NextResponse.json({ error: 'Failed to delete line item.' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
