"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Box } from "lucide-react";
import { GradientBackground } from "@/components/GradientBackground";
import { Avatar, ProgressRing, ProjectStatusIcon } from "@/components/ProjectPrimitives";

type ProjectStatus = "active" | "completed" | "archived";

type ProjectCard = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  owner: { id: string; name: string; pnr_number: string } | null;
  task_done: number;
  task_total: number;
};

type Filter = "all" | ProjectStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All projects" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

// "2026-07-31" -> "Jul 31". Returns null for absent/malformed input.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadProjects = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/projects");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/session/status");
        const data = res.ok ? await res.json() : null;
        if (!data?.authenticated) {
          router.push("/login");
          return;
        }
        await loadProjects();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, loadProjects]);

  const visible = useMemo(
    () => (filter === "all" ? projects : projects.filter((p) => p.status === filter)),
    [projects, filter],
  );

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          due_date: dueDate || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/projects/${data.id}`);
      } else {
        setFormError(data.error || "Failed to create project.");
      }
    } catch {
      setFormError("Network error while creating project.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <GradientBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/dashboard")}
              className="seg flex items-center gap-1.5 px-2.5 py-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              <Box className="w-4 h-4 text-muted" />
              <h1 className="text-[15px] font-semibold text-foreground truncate">Projects</h1>
            </div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New project</span>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              data-active={filter === f.key}
              onClick={() => setFilter(f.key)}
              className="seg px-3 py-1.5 text-[13px]"
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="panel mt-4 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_100px_70px] items-center gap-4 px-4 py-2.5 border-b border-border col-head">
            <span>Name</span>
            <span className="hidden sm:block">Lead</span>
            <span className="hidden sm:block">Target</span>
            <span className="text-right">Progress</span>
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Box className="w-8 h-8 mx-auto mb-3 text-faint" />
              <p className="text-sm">
                {filter === "all" ? "No projects yet. Create your first one." : `No ${filter} projects.`}
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((p, i) => {
                const pct = p.task_total ? Math.round((p.task_done / p.task_total) * 100) : 0;
                const target = formatDate(p.due_date);
                return (
                  <li key={p.id} className={i > 0 ? "border-t border-border" : undefined}>
                    <button
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="list-row w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_100px_70px] items-center gap-4 px-4 py-3 text-left"
                    >
                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProjectStatusIcon status={p.status} />
                        <span className="font-medium text-foreground truncate">{p.name}</span>
                        {p.task_total > 0 && (
                          <span className="hidden md:inline text-xs text-faint tabular-nums shrink-0">
                            {p.task_total} {p.task_total === 1 ? "task" : "tasks"}
                          </span>
                        )}
                      </div>

                      {/* Lead */}
                      <div className="hidden sm:flex items-center gap-2 min-w-0">
                        {p.owner ? (
                          <>
                            <Avatar name={p.owner.name} />
                            <span className="text-[13px] text-muted truncate">{p.owner.name}</span>
                          </>
                        ) : (
                          <span className="text-[13px] text-faint">—</span>
                        )}
                      </div>

                      {/* Target */}
                      <div className="hidden sm:block text-[13px] text-muted tabular-nums">
                        {target ?? <span className="text-faint">—</span>}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center justify-end">
                        <ProgressRing value={pct} showLabel />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setCreateOpen(false)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={createProject}
              className="w-full max-w-md glass-card rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">New project</h2>
                <button type="button" onClick={() => setCreateOpen(false)} className="text-faint hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm text-muted mb-1.5">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field w-full px-3 py-2 rounded-lg"
                  placeholder="Startup Expo 2026"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1.5">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="field w-full px-3 py-2 rounded-lg resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1.5">Target date (optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="field w-full px-3 py-2 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-2.5 rounded-xl disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create project"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
