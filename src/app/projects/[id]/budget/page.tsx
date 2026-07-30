"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Printer, Send, Check, X, RotateCcw, Receipt } from "lucide-react";
import { GradientBackground } from "@/components/GradientBackground";

type Expense = {
  id: string;
  description: string;
  amount: number;
  spent_on: string;
  created_by: { id: string; name: string } | null;
};

type BudgetStatus = "draft" | "submitted" | "approved" | "rejected";

type BudgetItem = {
  id: string;
  resource_id: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  notes: string | null;
};

type Budget = {
  id: string;
  status: BudgetStatus;
  currency: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  items: BudgetItem[];
};

type Permissions = {
  can_edit: boolean;
  can_submit: boolean;
  can_review: boolean;
  can_reopen: boolean;
};

type ResourceOption = { id: string; title: string };

const STATUS_STYLES: Record<BudgetStatus, string> = {
  draft: "bg-white/5 text-faint border-white/10",
  submitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export default function BudgetPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [spentTotal, setSpentTotal] = useState(0);
  const [error, setError] = useState("");

  const loadExpenses = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/expenses`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses);
        setSpentTotal(data.summary.spent_total);
      }
    }
  }, [projectId]);

  const loadBudget = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/budget`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 403 || res.status === 404) {
      setError("This project doesn't exist or you don't have access to it.");
      return;
    }
    const data = await res.json();
    if (data.success) {
      setBudget(data.budget);
      setPermissions(data.permissions);
      setError("");
    } else {
      setError(data.error || "Failed to load budget.");
    }
  }, [projectId, router]);

  useEffect(() => {
    const init = async () => {
      try {
        const [projectRes, , resourcesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          loadBudget(),
          fetch("/api/resources"),
          loadExpenses(),
        ]);
        if (projectRes.ok) {
          const pd = await projectRes.json();
          if (pd.success) setProjectName(pd.project.name);
        }
        if (resourcesRes.ok) {
          const rd = await resourcesRes.json();
          if (rd.success) setResources(rd.resources.map((r: ResourceOption) => ({ id: r.id, title: r.title })));
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projectId, loadBudget, loadExpenses]);

  const total = useMemo(
    () => (budget?.items ?? []).reduce((sum, it) => sum + it.quantity * it.unit_cost, 0),
    [budget],
  );

  const patchItem = async (itemId: string, body: Record<string, unknown>) => {
    await fetch(`/api/projects/${projectId}/budget/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, ...body }),
    });
    await loadBudget();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/projects/${projectId}/budget/items?item_id=${itemId}`, { method: "DELETE" });
    await loadBudget();
  };

  const runAction = async (action: string, note?: string) => {
    const res = await fetch(`/api/projects/${projectId}/budget`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Action failed.");
    }
    await loadBudget();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
      </div>
    );
  }

  if (error || !budget || !permissions) {
    return (
      <div className="min-h-screen relative">
        <GradientBackground />
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-muted mb-6">{error || "Budget not available."}</p>
          <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-primary px-4 py-2 rounded-xl">
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  const canEdit = permissions.can_edit;

  return (
    <div className="min-h-screen relative">
      <GradientBackground />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="btn-secondary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Project</span>
          </button>
          <button
            onClick={() => router.push(`/projects/${projectId}/budget/print`)}
            className="btn-secondary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          >
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-faint">Budget</p>
              <h1 className="text-2xl font-bold text-white">{projectName}</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[budget.status]}`}>
              {budget.status}
            </span>
          </div>

          {budget.status === "rejected" && budget.review_note && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
              <span className="font-medium">Rejected:</span> {budget.review_note}
            </div>
          )}
          {budget.status === "approved" && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
              Approved{budget.review_note ? ` — ${budget.review_note}` : ""}. This budget is locked.
            </div>
          )}

          {/* Line items */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium w-20">Qty</th>
                  <th className="py-2 px-3 font-medium w-32">Unit cost</th>
                  <th className="py-2 px-3 font-medium w-32 text-right">Total</th>
                  {canEdit && <th className="py-2 pl-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {budget.items.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="py-6 text-center text-faint">
                      No line items yet.
                    </td>
                  </tr>
                ) : (
                  budget.items.map((it) => (
                    <tr key={it.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">
                        {canEdit ? (
                          <input
                            defaultValue={it.name}
                            onBlur={(e) => e.target.value.trim() && e.target.value !== it.name && patchItem(it.id, { name: e.target.value.trim() })}
                            className="w-full bg-transparent text-white focus:outline-none focus:bg-white/5 rounded px-1 py-0.5"
                          />
                        ) : (
                          <span className="text-white">{it.name}</span>
                        )}
                        {it.resource_id && <span className="ml-2 text-[11px] text-blue-400">library</span>}
                      </td>
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <input
                            type="number"
                            min={1}
                            defaultValue={it.quantity}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isInteger(v) && v >= 1 && v !== it.quantity) patchItem(it.id, { quantity: v });
                            }}
                            className="w-16 bg-black/20 border border-white/10 rounded px-2 py-1 text-white"
                          />
                        ) : (
                          it.quantity
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={it.unit_cost}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v) && v >= 0 && v !== it.unit_cost) patchItem(it.id, { unit_cost: v });
                            }}
                            className="w-28 bg-black/20 border border-white/10 rounded px-2 py-1 text-white"
                          />
                        ) : (
                          formatMoney(it.unit_cost, budget.currency)
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-white tabular-nums">
                        {formatMoney(it.quantity * it.unit_cost, budget.currency)}
                      </td>
                      {canEdit && (
                        <td className="py-2 pl-3 text-right">
                          <button onClick={() => deleteItem(it.id)} className="text-faint hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-3 pr-3 text-right font-medium text-muted">Total</td>
                  <td className="py-3 px-3 text-right text-lg font-bold text-white tabular-nums">
                    {formatMoney(total, budget.currency)}
                  </td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {canEdit && <AddLineForm projectId={projectId} resources={resources} onAdded={loadBudget} />}
        </div>

        {/* Workflow actions */}
        <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-3">
          {permissions.can_submit && (
            <button
              onClick={() => runAction("submit")}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl"
            >
              <Send className="w-4 h-4" /> Submit for approval
            </button>
          )}
          {permissions.can_review && (
            <>
              <button
                onClick={() => runAction("approve")}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => {
                  const note = prompt("Reason for rejection (optional):") ?? undefined;
                  runAction("reject", note);
                }}
                className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl text-red-400"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </>
          )}
          {permissions.can_reopen && (
            <button
              onClick={() => runAction("reopen")}
              className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl"
            >
              <RotateCcw className="w-4 h-4" /> Reopen for edits
            </button>
          )}
          {budget.status === "submitted" && !permissions.can_review && (
            <p className="text-sm text-muted">Submitted — awaiting admin approval.</p>
          )}
        </div>

        <SpendSection
          projectId={projectId}
          currency={budget.currency}
          budgetedTotal={total}
          spentTotal={spentTotal}
          expenses={expenses}
          onChanged={loadExpenses}
        />
      </div>
    </div>
  );
}

function SpendSection({
  projectId,
  currency,
  budgetedTotal,
  spentTotal,
  expenses,
  onChanged,
}: {
  projectId: string;
  currency: string;
  budgetedTotal: number;
  spentTotal: number;
  expenses: Expense[];
  onChanged: () => Promise<void>;
}) {
  const pct = budgetedTotal > 0 ? Math.min(100, Math.round((spentTotal / budgetedTotal) * 100)) : 0;
  const over = budgetedTotal > 0 && spentTotal > budgetedTotal;
  const remaining = budgetedTotal - spentTotal;

  const deleteExpense = async (expenseId: string) => {
    await fetch(`/api/projects/${projectId}/expenses?expense_id=${expenseId}`, { method: "DELETE" });
    await onChanged();
  };

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <Receipt className="w-5 h-5 text-purple-400" /> Actual spend
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-2 text-sm">
        <span className="text-muted">
          Spent <span className="text-white font-semibold">{formatMoney(spentTotal, currency)}</span> of{" "}
          {formatMoney(budgetedTotal, currency)} budgeted
        </span>
        <span className={over ? "text-red-400 font-medium" : "text-faint"}>
          {over ? `Over by ${formatMoney(-remaining, currency)}` : `${formatMoney(remaining, currency)} remaining`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-6">
        <div className={`h-full ${over ? "bg-red-500/70" : "bg-purple-500/70"}`} style={{ width: `${pct}%` }} />
      </div>

      {expenses.length > 0 && (
        <div className="space-y-2 mb-4">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-[color:var(--color-border)] text-sm">
              <span className="text-faint w-24 tabular-nums">{e.spent_on}</span>
              <span className="flex-1 min-w-0 truncate text-foreground">{e.description}</span>
              <span className="text-white tabular-nums">{formatMoney(e.amount, currency)}</span>
              <button onClick={() => deleteExpense(e.id)} className="text-faint hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddExpenseForm projectId={projectId} onAdded={onChanged} />
    </div>
  );
}

function AddExpenseForm({ projectId, onAdded }: { projectId: string; onAdded: () => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const amt = parseFloat(amount);
    if (!description.trim()) {
      setErr("Description is required.");
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      setErr("Amount must be zero or more.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), amount: amt, spent_on: spentOn }),
      });
      if (res.ok) {
        setDescription("");
        setAmount("");
        setSpentOn(today);
        await onAdded();
      } else {
        const data = await res.json();
        setErr(data.error || "Failed to log spend.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex flex-col md:flex-row gap-3">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What was bought…"
        className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-white text-sm focus:outline-none focus:border-white/30"
      />
      <input
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-28 px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-white text-sm"
      />
      <input
        type="date"
        value={spentOn}
        onChange={(e) => setSpentOn(e.target.value)}
        className="px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-muted text-sm"
      />
      <button type="submit" disabled={busy} className="btn-primary flex items-center gap-1 px-4 py-2 rounded-lg disabled:opacity-60">
        <Plus className="w-4 h-4" /> Log
      </button>
      </div>
    </form>
  );
}

function AddLineForm({
  projectId,
  resources,
  onAdded,
}: {
  projectId: string;
  resources: ResourceOption[];
  onAdded: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(unitCost);
    if (!name.trim() && !resourceId) {
      setErr("Enter an item name or pick a library resource.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setErr("Quantity must be a positive whole number.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setErr("Unit cost must be zero or more.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/budget/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          resource_id: resourceId || undefined,
          quantity: qty,
          unit_cost: cost,
        }),
      });
      if (res.ok) {
        setName("");
        setResourceId("");
        setQuantity("1");
        setUnitCost("0");
        await onAdded();
      } else {
        const data = await res.json();
        setErr(data.error || "Failed to add line.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 pt-5 border-t border-white/10 space-y-3">
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex flex-col md:flex-row gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name (or pick from library →)"
          className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-white text-sm focus:outline-none focus:border-white/30"
        />
        <select
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          className="px-2 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-muted text-sm max-w-[12rem]"
        >
          <option value="">— custom item —</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20 px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-white text-sm"
          aria-label="Quantity"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="w-28 px-3 py-2 rounded-lg bg-surface-2 border border-[color:var(--color-border)] text-white text-sm"
          aria-label="Unit cost"
        />
        <button type="submit" disabled={busy} className="btn-primary flex items-center gap-1 px-4 py-2 rounded-lg disabled:opacity-60">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </form>
  );
}
