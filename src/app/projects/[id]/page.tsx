"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Trash2,
  X,
  CalendarClock,
  Wallet,
  ArrowRight,
  Box,
} from "lucide-react";
import { GradientBackground } from "@/components/GradientBackground";
import { Avatar, ProgressRing, ProjectStatusIcon } from "@/components/ProjectPrimitives";

type ActivityEntry = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  actor: { id: string; name: string } | null;
};

type MemberRef = { id: string; name: string; pnr_number: string };
type ProjectStatus = "active" | "completed" | "archived";
type MilestoneStatus = "open" | "completed";
type TaskStatus = "todo" | "in_progress" | "done";

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
};

type Task = {
  id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  assignee: MemberRef | null;
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  owner: MemberRef | null;
  members: MemberRef[];
  milestones: Milestone[];
  tasks: Task[];
};

type SessionInfo = { member_id: string; role: "member" | "admin" };
type Tab = "overview" | "milestones" | "activity";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [directory, setDirectory] = useState<MemberRef[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 403 || res.status === 404) {
      setError("This project doesn't exist or you don't have access to it.");
      setProject(null);
      return;
    }
    const data = await res.json();
    if (data.success) {
      setProject(data.project);
      setError("");
      const activityRes = await fetch(`/api/projects/${projectId}/activity`);
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (activityData.success) setActivity(activityData.activity);
      }
    } else {
      setError(data.error || "Failed to load project.");
    }
  }, [projectId, router]);

  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await fetch("/api/session/status");
        const statusData = statusRes.ok ? await statusRes.json() : null;
        if (!statusData?.authenticated) {
          router.push("/login");
          return;
        }
        setSession({ member_id: statusData.session.member_id, role: statusData.session.role });
        const [membersRes] = await Promise.all([fetch("/api/members"), load()]);
        const membersData = await membersRes.json();
        if (membersData.success) setDirectory(membersData.members);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, load]);

  const canManageProject = useMemo(() => {
    if (!project || !session) return false;
    return session.role === "admin" || project.owner?.id === session.member_id;
  }, [project, session]);

  const progress = useMemo(() => {
    if (!project) return 0;
    const total = project.tasks.length;
    if (!total) return 0;
    return Math.round((project.tasks.filter((t) => t.status === "done").length / total) * 100);
  }, [project]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen relative">
        <GradientBackground />
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-muted mb-6">{error || "Project not found."}</p>
          <button onClick={() => router.push("/projects")} className="btn-primary px-4 py-2 rounded-xl">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const remove = async () => {
    if (!confirm("Delete this project and everything in it? This cannot be undone.")) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/projects");
    else alert("Failed to delete project.");
  };

  const setStatus = async (status: ProjectStatus) => {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "milestones", label: "Milestones" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="min-h-screen relative">
      <GradientBackground />
      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <button onClick={() => router.push("/projects")} className="text-muted hover:text-foreground transition-colors">
              Projects
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-faint shrink-0" />
            <span className="text-foreground font-medium truncate">{project.name}</span>
          </div>
          {canManageProject && (
            <button
              onClick={remove}
              className="seg flex items-center gap-1.5 px-2.5 py-1.5 text-sm hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>

        {/* Icon + title header */}
        <div className="mt-6 flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(241,254,200,0.08)", border: "1px solid var(--color-border-strong)" }}
          >
            <Box className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-[28px] font-bold text-foreground leading-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted mt-1.5 max-w-2xl text-[15px] leading-relaxed">{project.description}</p>
            )}
          </div>
        </div>

        {/* Properties row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2">
          {canManageProject ? (
            <label className="relative inline-flex items-center gap-1.5 panel px-2.5 py-1.5 text-[13px] cursor-pointer hover:bg-white/5 transition-colors">
              <ProjectStatusIcon status={project.status} />
              <span className="text-foreground">{STATUS_LABEL[project.status]}</span>
              <select
                value={project.status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Project status"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          ) : (
            <span className="inline-flex items-center gap-1.5 panel px-2.5 py-1.5 text-[13px] text-foreground">
              <ProjectStatusIcon status={project.status} />
              {STATUS_LABEL[project.status]}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 panel px-2.5 py-1.5 text-[13px] text-muted">
            {project.owner ? (
              <>
                <Avatar name={project.owner.name} size={16} />
                {project.owner.name}
              </>
            ) : (
              "No lead"
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 panel px-2.5 py-1.5 text-[13px] text-muted">
            <CalendarClock className="w-3.5 h-3.5 text-faint" />
            {formatDate(project.due_date) ?? "No target date"}
          </span>

          <span className="inline-flex items-center gap-1.5 panel px-2.5 py-1.5 text-[13px] text-muted">
            <ProgressRing value={progress} size={14} />
            {progress}%
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative px-3 py-2 text-[13px] font-medium transition-colors"
              style={{ color: tab === t.key ? "var(--color-foreground)" : "var(--color-muted)" }}
            >
              {t.label}
              {tab === t.key && <span className="absolute left-0 -bottom-px h-0.5 w-full bg-accent rounded-full" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="space-y-6">
                {activity[0] && <LatestUpdate entry={activity[0]} />}
                <section>
                  <h2 className="col-head mb-2">Description</h2>
                  <p className="text-[15px] text-foreground/90 leading-relaxed">
                    {project.description || <span className="text-faint">No description.</span>}
                  </p>
                </section>
                <Timeline project={project} />
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => router.push(`/projects/${project.id}/budget`)}
                  className="w-full text-left panel p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <h2 className="font-semibold text-foreground text-[15px]">Budget</h2>
                    </div>
                    <ArrowRight className="w-4 h-4 text-faint group-hover:text-muted transition-colors" />
                  </div>
                  <p className="text-[13px] text-muted">Plan spend, get it approved, print a PDF.</p>
                </button>
                <MembersPanel
                  project={project}
                  directory={directory}
                  canManage={canManageProject}
                  onChanged={load}
                />
              </div>
            </div>
          )}

          {tab === "milestones" && (
            <Board project={project} canManage={canManageProject} onChanged={load} />
          )}

          {tab === "activity" && <ActivityPanel activity={activity} />}
        </div>
      </div>
    </div>
  );
}

// --- Latest update ----------------------------------------------------------

function LatestUpdate({ entry }: { entry: ActivityEntry }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="col-head">Latest update</span>
      </div>
      <div className="flex items-start gap-2.5">
        <Avatar name={entry.actor?.name ?? "System"} size={22} />
        <div className="min-w-0">
          <p className="text-[15px] text-foreground leading-snug">{entry.detail ?? entry.action}</p>
          <p className="text-xs text-faint mt-1">
            {entry.actor?.name ?? "Someone"} · {fmt(entry.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Board (milestones + tasks) ---------------------------------------------

function Board({
  project,
  canManage,
  onChanged,
}: {
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");

  const groups = useMemo(() => {
    const byMilestone = new Map<string | null, Task[]>();
    for (const t of project.tasks) {
      const key = t.milestone_id;
      const list = byMilestone.get(key) ?? [];
      list.push(t);
      byMilestone.set(key, list);
    }
    return byMilestone;
  }, [project.tasks]);

  const createMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: milestoneTitle.trim(),
        due_date: milestoneDue || undefined,
      }),
    });
    setMilestoneTitle("");
    setMilestoneDue("");
    setAddingMilestone(false);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground">Milestones</h2>
        {canManage && (
          <button
            onClick={() => setAddingMilestone((v) => !v)}
            className="seg flex items-center gap-1.5 px-2.5 py-1.5 text-[13px]"
          >
            <Plus className="w-4 h-4" /> Milestone
          </button>
        )}
      </div>

      {addingMilestone && (
        <form onSubmit={createMilestone} className="panel p-3 flex flex-col sm:flex-row gap-2">
          <input
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            placeholder="Milestone title"
            autoFocus
            className="field flex-1 px-3 py-2 rounded-lg text-sm"
          />
          <input
            type="date"
            value={milestoneDue}
            onChange={(e) => setMilestoneDue(e.target.value)}
            className="field px-3 py-2 rounded-lg text-sm"
          />
          <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-sm">Add</button>
        </form>
      )}

      {project.milestones.map((m) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          tasks={groups.get(m.id) ?? []}
          project={project}
          canManage={canManage}
          onChanged={onChanged}
        />
      ))}

      <UnassignedTasks
        tasks={groups.get(null) ?? []}
        project={project}
        canManage={canManage}
        onChanged={onChanged}
      />
    </div>
  );
}

function MilestoneCard({
  milestone,
  tasks,
  project,
  canManage,
  onChanged,
}: {
  milestone: Milestone;
  tasks: Task[];
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const toggle = async () => {
    await fetch("/api/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestone_id: milestone.id,
        status: milestone.status === "completed" ? "open" : "completed",
      }),
    });
    await onChanged();
  };

  const remove = async () => {
    if (!confirm("Delete this milestone? Its tasks will remain, unlinked.")) return;
    await fetch(`/api/milestones?milestone_id=${milestone.id}`, { method: "DELETE" });
    await onChanged();
  };

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggle}
              disabled={!canManage}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border disabled:opacity-70 transition-colors ${
                milestone.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {milestone.status === "completed" ? "Completed" : "Open"}
            </button>
            <h3 className="font-semibold text-foreground truncate">{milestone.title}</h3>
          </div>
          <div className="text-xs text-faint mt-1.5 flex items-center gap-3">
            {milestone.due_date && <span>Due {formatDate(milestone.due_date)}</span>}
            <span className="inline-flex items-center gap-1.5">
              <ProgressRing value={pct} size={12} />
              {done}/{tasks.length} done
            </span>
          </div>
        </div>
        {canManage && (
          <button onClick={remove} className="text-faint hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <TaskList tasks={tasks} project={project} canManage={canManage} onChanged={onChanged} />
      <AddTaskForm project={project} milestoneId={milestone.id} canManage={canManage} onChanged={onChanged} />
    </div>
  );
}

function UnassignedTasks({
  tasks,
  project,
  canManage,
  onChanged,
}: {
  tasks: Task[];
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  if (tasks.length === 0 && !canManage) return null;
  return (
    <div className="panel p-5">
      <h3 className="font-semibold text-foreground mb-3 text-[15px]">No milestone</h3>
      <TaskList tasks={tasks} project={project} canManage={canManage} onChanged={onChanged} />
      <AddTaskForm project={project} milestoneId={null} canManage={canManage} onChanged={onChanged} />
    </div>
  );
}

function TaskList({
  tasks,
  project,
  canManage,
  onChanged,
}: {
  tasks: Task[];
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const patchTask = async (taskId: string, body: Record<string, unknown>) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, ...body }),
    });
    await onChanged();
  };

  const removeTask = async (taskId: string) => {
    await fetch(`/api/tasks?task_id=${taskId}`, { method: "DELETE" });
    await onChanged();
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-faint py-2">No tasks yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="list-row flex items-center gap-3 px-3 py-2 rounded-lg border border-border"
        >
          <select
            value={t.status}
            onChange={(e) => patchTask(t.id, { status: e.target.value })}
            className="field rounded-md px-2 py-1 text-xs"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          <span className={`flex-1 min-w-0 truncate text-sm ${t.status === "done" ? "line-through text-faint" : "text-foreground"}`}>
            {t.title}
          </span>

          {canManage ? (
            <select
              value={t.assignee?.id ?? ""}
              onChange={(e) => patchTask(t.id, { assignee_id: e.target.value || null })}
              className="field rounded-md px-2 py-1 text-xs max-w-[9rem]"
            >
              <option value="">Unassigned</option>
              {project.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              {t.assignee ? <Avatar name={t.assignee.name} size={16} /> : null}
              {t.assignee?.name ?? "Unassigned"}
            </span>
          )}

          {t.due_date && <span className="text-xs text-faint hidden sm:inline tabular-nums">{formatDate(t.due_date)}</span>}

          {canManage && (
            <button onClick={() => removeTask(t.id)} className="text-faint hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AddTaskForm({
  project,
  milestoneId,
  canManage,
  onChanged,
}: {
  project: ProjectDetail;
  milestoneId: string | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canManage) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          milestone_id: milestoneId ?? undefined,
          title: title.trim(),
          assignee_id: assigneeId || undefined,
          due_date: dueDate || undefined,
        }),
      });
      setTitle("");
      setAssigneeId("");
      setDueDate("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mt-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="field flex-1 px-3 py-2 rounded-lg text-sm"
      />
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="field px-2 py-2 rounded-lg text-sm"
      >
        <option value="">Unassigned</option>
        {project.members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="field px-2 py-2 rounded-lg text-sm"
      />
      <button type="submit" disabled={busy} className="btn-secondary px-3 py-2 rounded-lg text-sm disabled:opacity-60">
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
}

// --- Members ----------------------------------------------------------------

function MembersPanel({
  project,
  directory,
  canManage,
  onChanged,
}: {
  project: ProjectDetail;
  directory: MemberRef[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [selected, setSelected] = useState("");

  const candidates = directory.filter((d) => !project.members.some((m) => m.id === d.id));

  const add = async () => {
    if (!selected) return;
    const res = await fetch(`/api/projects/${project.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: selected }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to add member.");
    }
    setSelected("");
    await onChanged();
  };

  const remove = async (memberId: string) => {
    const res = await fetch(`/api/projects/${project.id}/members?member_id=${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to remove member.");
    }
    await onChanged();
  };

  return (
    <div className="panel p-4 h-fit">
      <h2 className="col-head mb-3">Team · {project.members.length}</h2>

      <div className="space-y-2">
        {project.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 min-w-0 text-sm">
              <Avatar name={m.name} size={20} />
              <span className="text-foreground truncate">{m.name}</span>
              {project.owner?.id === m.id && <span className="text-faint text-xs shrink-0">· lead</span>}
            </span>
            {canManage && project.owner?.id !== m.id && (
              <button onClick={() => remove(m.id)} className="text-faint hover:text-red-400 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-3 flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="field flex-1 px-2 py-2 rounded-lg text-sm min-w-0"
          >
            <option value="">Add member…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.pnr_number})</option>
            ))}
          </select>
          <button onClick={add} className="btn-secondary px-3 py-2 rounded-lg shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// --- Timeline ---------------------------------------------------------------

function Timeline({ project }: { project: ProjectDetail }) {
  const items = useMemo(() => {
    const dated: { date: string; label: string; kind: "milestone" | "task"; done: boolean }[] = [];
    for (const m of project.milestones) {
      if (m.due_date) dated.push({ date: m.due_date, label: m.title, kind: "milestone", done: m.status === "completed" });
    }
    for (const t of project.tasks) {
      if (t.due_date) dated.push({ date: t.due_date, label: t.title, kind: "task", done: t.status === "done" });
    }
    return dated.sort((a, b) => a.date.localeCompare(b.date));
  }, [project]);

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="col-head mb-3">Timeline</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-16 text-faint tabular-nums text-xs">{formatDate(item.date)}</span>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                item.done ? "bg-emerald-500" : item.kind === "milestone" ? "bg-amber-400" : "bg-white/40"
              }`}
            />
            <span className={item.done ? "line-through text-faint" : "text-foreground"}>
              {item.label}
              {item.kind === "milestone" && <span className="text-faint text-xs"> · milestone</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (activity.length === 0) {
    return <p className="text-sm text-faint">No activity yet.</p>;
  }

  return (
    <div className="space-y-1">
      {activity.map((a) => (
        <div key={a.id} className="flex gap-3 text-sm px-1 py-2">
          <Avatar name={a.actor?.name ?? "System"} size={22} />
          <div className="min-w-0">
            <span className="text-foreground">{a.detail ?? a.action}</span>
            <div className="text-xs text-faint mt-0.5">
              {a.actor?.name ?? "Someone"} · {fmt(a.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
