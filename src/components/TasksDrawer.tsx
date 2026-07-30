"use client";

import { useEffect, useState } from "react";
import { ListTodo, FolderKanban, Hand, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "@/components/Drawer";

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  project: { id: string; name: string } | null;
};

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "todo", label: "To Do", dot: "bg-muted" },
  { status: "in_progress", label: "In Progress", dot: "bg-blue-400" },
  { status: "done", label: "Done", dot: "bg-emerald-400" },
];

// Which status buttons a card offers, given its current column.
const MOVES: Record<TaskStatus, { to: TaskStatus; label: string }[]> = {
  todo: [
    { to: "in_progress", label: "Start" },
    { to: "done", label: "Complete" },
  ],
  in_progress: [
    { to: "done", label: "Complete" },
    { to: "todo", label: "Back" },
  ],
  done: [{ to: "todo", label: "Reopen" }],
};

interface TasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
}

export function TasksDrawer({ isOpen, onClose, memberId }: TasksDrawerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [claimable, setClaimable] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [mine, avail] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/tasks?scope=claimable"),
        ]);
        if (mine.ok) {
          const data = await mine.json();
          if (!cancelled && data.success) setTasks(data.tasks);
        }
        if (avail.ok) {
          const data = await avail.json();
          if (!cancelled && data.success) setClaimable(data.tasks);
        }
      } catch (err) {
        console.error("Failed to load tasks", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const moveTask = async (task: Task, to: TaskStatus) => {
    const prev = task.status;
    setBusyId(task.id);
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: to } : t)));
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, status: to }),
      });
      if (!res.ok) {
        setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
      }
    } catch {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
    } finally {
      setBusyId(null);
    }
  };

  const claimTask = async (task: Task) => {
    setBusyId(task.id);
    // Optimistically move it out of the available pool and into To Do.
    setClaimable((cs) => cs.filter((c) => c.id !== task.id));
    setTasks((ts) => [{ ...task, status: "todo" }, ...ts]);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, assignee_id: memberId }),
      });
      if (!res.ok) {
        setTasks((ts) => ts.filter((t) => t.id !== task.id));
        setClaimable((cs) => [task, ...cs]);
      }
    } catch {
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
      setClaimable((cs) => [task, ...cs]);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Your Tasks"
      icon={ListTodo}
      accent="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {claimable.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Hand className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
                  Available to claim
                </h3>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {claimable.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      busy={busyId === task.id}
                      actions={[{ label: "Claim", onClick: () => claimTask(task), primary: true }]}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => t.status === col.status);
            return (
              <section key={col.status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                    {col.label}
                  </h3>
                  <span className="text-xs text-faint">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-faint px-1 py-2">Nothing here.</p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {items.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          busy={busyId === task.id}
                          actions={MOVES[task.status].map((m) => ({
                            label: m.label,
                            onClick: () => moveTask(task, m.to),
                            primary: m.to === "done",
                          }))}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}

type CardAction = { label: string; onClick: () => void; primary?: boolean };

function TaskCard({ task, busy, actions }: { task: Task; busy: boolean; actions: CardAction[] }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="p-3 rounded-xl border border-[color:var(--color-border)] bg-surface-2"
    >
      <div className={`text-sm text-foreground ${task.status === "done" ? "line-through text-faint" : ""}`}>
        {task.title}
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-faint">
        {task.project && (
          <span className="inline-flex items-center gap-1">
            <FolderKanban className="w-3 h-3" />
            {task.project.name}
          </span>
        )}
        {task.due_date && <span>Due {task.due_date}</span>}
      </div>
      <div className="flex gap-2 mt-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={busy}
            className={`text-xs font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 ${
              a.primary
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                : "btn-secondary text-foreground"
            }`}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : a.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
