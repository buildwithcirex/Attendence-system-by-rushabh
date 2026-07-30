"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type Task = {
  id: string;
  task_description: string;
  status: "pending" | "completed";
  created_at: string;
};

export function TaskBar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTasks(data.tasks);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchTasks();
  }, []);

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "pending" ? "completed" : "pending";
    
    // Optimistic update
    setTasks((prev) => 
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });
      
      if (!res.ok) {
        // Revert on failure
        setTasks((prev) => 
          prev.map((t) => (t.id === taskId ? { ...t, status: currentStatus as "pending" | "completed" } : t))
        );
      }
    } catch (err) {
      console.error("Failed to update task", err);
      // Revert on failure
      setTasks((prev) => 
        prev.map((t) => (t.id === taskId ? { ...t, status: currentStatus as "pending" | "completed" } : t))
      );
    }
  };

  if (loading) {
    return (
      <div className="w-full glass-card rounded-3xl p-6 md:p-8 flex flex-col mt-8 relative overflow-hidden">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-white/10 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-white/5 rounded"></div>
              <div className="h-10 bg-white/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full glass-card rounded-3xl p-6 md:p-8 flex flex-col mt-8 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <ListTodo className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Your Tasks</h2>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6 text-muted bg-white/5 rounded-xl border border-white/5"
            >
              No tasks assigned. You&apos;re all caught up!
            </motion.div>
          ) : (
            tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  task.status === 'completed'
                    ? "bg-emerald-500/5 border-emerald-500/20 text-muted"
                    : "bg-surface-2 border-[color:var(--color-border)] hover:bg-white/5 text-foreground"
                }`}
              >
                <button
                  onClick={() => toggleTaskStatus(task.id, task.status)}
                  className="mt-0.5 focus:outline-none flex-shrink-0 transition-transform active:scale-90"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted hover:text-emerald-400 transition-colors" />
                  )}
                </button>
                
                <div className={`flex-1 ${task.status === "completed" ? "line-through text-faint" : ""}`}>
                  {task.task_description}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
