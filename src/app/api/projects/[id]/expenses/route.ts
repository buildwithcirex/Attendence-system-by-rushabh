import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getSupabaseAdmin } from '@/utils/supabase';
import { getOrCreateBudgetId, isProjectMember, logActivity } from '@/utils/projects';

async function requireProjectAccess(projectId: string, memberId: string, isAdmin: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: project, error } = await supabase.from('projects').select('id').eq('id', projectId).single();
  if (error || !project) return { ok: false as const, status: 404, error: 'Project not found.' };
  if (!isAdmin && !(await isProjectMember(projectId, memberId))) {
    return { ok: false as const, status: 403, error: 'You do not have access to this project.' };
  }
  return { ok: true as const };
}

function parseAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return undefined;
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const access = await requireProjectAccess(id, session.member_id, session.role === 'admin');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const supabase = getSupabaseAdmin();
    const budgetId = await getOrCreateBudgetId(id);

    const [expensesRes, itemsRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, budget_item_id, description, amount, spent_on, created_by:members!created_by_id ( id, name, pnr_number )')
        .eq('project_id', id)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      budgetId
        ? supabase.from('budget_items').select('quantity, unit_cost').eq('budget_id', budgetId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (expensesRes.error || itemsRes.error) {
      return NextResponse.json({ error: 'Failed to load expenses.' }, { status: 500 });
    }

    const budgetedTotal = (itemsRes.data ?? []).reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
      0,
    );
    const expenses = (expensesRes.data ?? []).map((e) => ({
      ...e,
      created_by: Array.isArray(e.created_by) ? e.created_by[0] ?? null : e.created_by,
    }));
    const spentTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return NextResponse.json({
      success: true,
      expenses,
      summary: { budgeted_total: budgetedTotal, spent_total: spentTotal },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { id } = await params;
    const access = await requireProjectAccess(id, session.member_id, session.role === 'admin');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = parseAmount(body.amount);
    const spentOn = parseDate(body.spent_on);
    if (!description) return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
    if (amount === null) return NextResponse.json({ error: 'Amount must be zero or more.' }, { status: 400 });
    if (spentOn === undefined) return NextResponse.json({ error: 'Invalid spend date.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    let budgetItemId: string | null = null;
    if (typeof body.budget_item_id === 'string' && body.budget_item_id) {
      // The referenced line must belong to this project's budget.
      const budgetId = await getOrCreateBudgetId(id);
      const { data: item } = await supabase
        .from('budget_items')
        .select('id')
        .eq('id', body.budget_item_id)
        .eq('budget_id', budgetId)
        .maybeSingle();
      if (!item) return NextResponse.json({ error: 'Budget line not found for this project.' }, { status: 400 });
      budgetItemId = item.id;
    }

    const { error } = await supabase.from('expenses').insert({
      project_id: id,
      budget_item_id: budgetItemId,
      description,
      amount,
      spent_on: spentOn ?? undefined,
      created_by_id: session.member_id,
    });
    if (error) return NextResponse.json({ error: 'Failed to record expense.' }, { status: 500 });

    await logActivity(id, session.member_id, 'expense.added', `Logged spend "${description}" (${amount})`);

    return NextResponse.json({ success: true }, { status: 201 });
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
    const isAdmin = session.role === 'admin';
    const access = await requireProjectAccess(id, session.member_id, isAdmin);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const expenseId = typeof body.expense_id === 'string' ? body.expense_id : '';
    if (!expenseId) return NextResponse.json({ error: 'expense_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: expense, error: findErr } = await supabase
      .from('expenses')
      .select('id, created_by_id')
      .eq('id', expenseId)
      .eq('project_id', id)
      .single();
    if (findErr || !expense) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 });
    if (!isAdmin && expense.created_by_id !== session.member_id) {
      return NextResponse.json({ error: 'You can only edit expenses you logged.' }, { status: 403 });
    }

    const update: Record<string, string | number | null> = {};
    if (body.description !== undefined) {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!description) return NextResponse.json({ error: 'Description cannot be empty.' }, { status: 400 });
      update.description = description;
    }
    if (body.amount !== undefined) {
      const amount = parseAmount(body.amount);
      if (amount === null) return NextResponse.json({ error: 'Amount must be zero or more.' }, { status: 400 });
      update.amount = amount;
    }
    if (body.spent_on !== undefined) {
      const spentOn = parseDate(body.spent_on);
      if (spentOn === undefined || spentOn === null) return NextResponse.json({ error: 'Invalid spend date.' }, { status: 400 });
      update.spent_on = spentOn;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { error } = await supabase.from('expenses').update(update).eq('id', expenseId);
    if (error) return NextResponse.json({ error: 'Failed to update expense.' }, { status: 500 });

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
    const isAdmin = session.role === 'admin';
    const access = await requireProjectAccess(id, session.member_id, isAdmin);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const expenseId = req.nextUrl.searchParams.get('expense_id');
    if (!expenseId) return NextResponse.json({ error: 'expense_id is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: expense, error: findErr } = await supabase
      .from('expenses')
      .select('id, created_by_id')
      .eq('id', expenseId)
      .eq('project_id', id)
      .single();
    if (findErr || !expense) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 });
    if (!isAdmin && expense.created_by_id !== session.member_id) {
      return NextResponse.json({ error: 'You can only delete expenses you logged.' }, { status: 403 });
    }

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) return NextResponse.json({ error: 'Failed to delete expense.' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
