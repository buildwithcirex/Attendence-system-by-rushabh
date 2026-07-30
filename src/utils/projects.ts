// Shared types and helpers for the project tracker (Project -> Milestone -> Task).
import { getSupabaseAdmin } from '@/utils/supabase';

export type ProjectStatus = 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'open' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export const PROJECT_STATUSES: ProjectStatus[] = ['active', 'completed', 'archived'];
export const MILESTONE_STATUSES: MilestoneStatus[] = ['open', 'completed'];
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

export type MemberRef = {
  id: string;
  name: string;
  pnr_number: string;
};

export type ProjectTask = {
  id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  sort_order: number;
  assignee: MemberRef | null;
  created_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  owner: MemberRef | null;
  created_at: string;
};

export type ProjectDetail = ProjectSummary & {
  members: MemberRef[];
  milestones: Milestone[];
  tasks: ProjectTask[];
};

export type Expense = {
  id: string;
  budget_item_id: string | null;
  description: string;
  amount: number;
  spent_on: string;
  created_by: MemberRef | null;
};

// Appends a line to a project's activity feed. Best-effort: a logging failure must
// never break the operation it records, so errors are swallowed.
export async function logActivity(
  projectId: string,
  actorId: string | null,
  action: string,
  detail: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('activity_log').insert({
      project_id: projectId,
      actor_id: actorId,
      action,
      detail,
    });
  } catch {
    // ignore — activity logging is non-critical
  }
}

export type BudgetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

// Members may add/edit/remove lines only while the budget is being drafted.
export const BUDGET_EDITABLE_STATUSES: BudgetStatus[] = ['draft', 'rejected'];

export type BudgetItem = {
  id: string;
  resource_id: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  notes: string | null;
  sort_order: number;
};

export type Budget = {
  id: string;
  project_id: string;
  status: BudgetStatus;
  currency: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  items: BudgetItem[];
};

// Returns the project's budget id, creating the (empty, draft) budget row on first
// access. Safe under concurrent first-access via the project_id unique constraint.
export async function getOrCreateBudgetId(projectId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('budgets')
    .insert({ project_id: projectId })
    .select('id')
    .single();
  if (error) {
    // Lost a create race: the row now exists — read it back.
    const { data: retry } = await supabase
      .from('budgets')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle();
    return retry?.id ?? null;
  }
  return created.id;
}

// True when a member owns or collaborates on a project. Admins are handled by the
// caller (they may access any project); this is purely the membership check.
export async function isProjectMember(projectId: string, memberId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}
