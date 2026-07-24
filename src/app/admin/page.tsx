"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, RefreshCw, LogOut, Users, Clock, Pencil, X, Settings, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { GradientBackground } from "@/components/GradientBackground";

type Option = { id: string; name: string };

type Member = {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  pnr_number: string;
  status: "pending" | "approved";
  role: "member" | "admin";
  branch: Option | null;
  year: Option | null;
  position: Option | null;
};

type SessionRow = {
  id: string;
  member_name: string;
  pnr_number: string;
  login_time: string;
  logout_time: string | null;
  logout_type: string | null;
  duration_minutes: number | null;
  work_description: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [years, setYears] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'sessions' | 'users'>('users');
  const [editingUser, setEditingUser] = useState<Member | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const fetchSessions = async () => {
    const res = await fetch("/api/admin/sessions");
    if (res.status === 403) {
      throw new Error("Unauthorized access. Admin privileges required.");
    }
    const data = await res.json();
    if (data.success) {
      setSessions(data.sessions);
    } else {
      throw new Error(data.error || "Failed to load sessions");
    }
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      throw new Error("Unauthorized access. Admin privileges required.");
    }
    const data = await res.json();
    if (data.success) {
      setUsers(data.users);
    } else {
      throw new Error(data.error || "Failed to load users");
    }
  };

  const fetchOptions = async () => {
    const res = await fetch("/api/admin/options");
    const data = await res.json();
    if (data.success) {
      setBranches(data.branches.filter((b: Option & { is_active: boolean }) => b.is_active));
      setYears(data.years.filter((y: Option & { is_active: boolean }) => y.is_active));
      setPositions(data.positions.filter((p: Option & { is_active: boolean }) => p.is_active));
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchSessions(), fetchUsers(), fetchOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadData();
    };
    load();
  }, [loadData]);

  const approveUser = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status: "approved" }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        alert("Failed to approve user.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while approving user.");
    }
  };

  const saveUserEdits = async (updates: Record<string, string>) => {
    if (!editingUser) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: editingUser.id, ...updates }),
      });
      if (res.ok) {
        setEditingUser(null);
        await fetchUsers();
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while saving changes.");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = <T extends Record<string, unknown>>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      const aValue = String(a[key] ?? "");
      const bValue = String(b[key] ?? "");

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/70 animate-spin" />
          <p className="text-muted font-light">Loading admin data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-[#0a0a0a]">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-muted">{error}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="btn-secondary mt-4 px-6 py-2 rounded-lg"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden text-white bg-[#0a0a0a]">
      <GradientBackground />

      <header className="flex justify-between items-center mb-6 glass-card rounded-2xl p-4 px-6">
        <div>
          <h1 className="font-extrabold text-2xl text-white">Admin Dashboard</h1>
          <p className="text-sm text-muted">Management Console</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/admin/otp")}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">OTP</span>
          </button>
          <button
            onClick={() => router.push("/admin/settings")}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={loadData}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Admin</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'users' ? 'bg-white text-[#0a0a0a]' : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'sessions' ? 'bg-white text-[#0a0a0a]' : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
          }`}
        >
          <Clock className="w-4 h-4" />
          Session Logs
        </button>
      </div>

      <main className="flex-1 overflow-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          className="w-full glass-card rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-2 text-muted">
                {activeTab === 'users' ? (
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">PNR</th>
                    <th className="px-6 py-4 font-medium">Branch / Year</th>
                    <th className="px-6 py-4 font-medium">Position</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('login_time')}>Date / Time In</th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('member_name')}>Member</th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('logout_time')}>Time Out</th>
                    <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('duration_minutes')}>Duration</th>
                    <th className="px-6 py-4 font-medium">Work Description</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeTab === 'users' ? (
                  sortedData(users).map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{u.name}</td>
                      <td className="px-6 py-4 text-foreground">{u.email}</td>
                      <td className="px-6 py-4 text-foreground">{u.pnr_number}</td>
                      <td className="px-6 py-4 text-muted">
                        {u.branch?.name || "-"} <br />
                        <span className="text-white text-xs font-semibold">{u.year?.name || "-"}</span>
                      </td>
                      <td className="px-6 py-4 text-foreground">{u.position?.name || "-"}</td>
                      <td className="px-6 py-4">
                        {u.status === 'approved' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Approved
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {u.status === 'pending' && (
                            <button
                              onClick={() => approveUser(u.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => setEditingUser(u)}
                            className="btn-secondary flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedData(sessions).map((s) => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{format(new Date(s.login_time), "MMM d, yyyy")}</div>
                        <div className="text-muted text-xs mt-1">{format(new Date(s.login_time), "hh:mm a")}</div>
                      </td>
                      <td className="px-6 py-4 font-medium">{s.member_name}</td>
                      <td className="px-6 py-4">
                        {s.logout_time ? (
                          <div className="flex items-center gap-2">
                            <span className="text-white">{format(new Date(s.logout_time), "hh:mm a")}</span>
                            {s.logout_type === 'auto' && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-500 font-medium">
                                AUTO
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-2 text-xs font-medium">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {s.duration_minutes ? (
                          <span className="bg-white/5 border border-[color:var(--color-border)] px-2 py-1 rounded text-foreground tabular-nums">
                            {s.duration_minutes} min
                          </span>
                        ) : (
                          <span className="text-faint">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-[250px] truncate text-muted" title={s.work_description || undefined}>
                        {s.work_description || <span className="text-faint">-</span>}
                      </td>
                    </tr>
                  ))
                )}

                {activeTab === 'users' && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-faint bg-black/20">
                      No users found.
                    </td>
                  </tr>
                )}

                {activeTab === 'sessions' && sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-faint bg-black/20">
                      No sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          branches={branches}
          years={years}
          positions={positions}
          onClose={() => setEditingUser(null)}
          onSave={saveUserEdits}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  branches,
  years,
  positions,
  onClose,
  onSave,
}: {
  user: Member;
  branches: Option[];
  years: Option[];
  positions: Option[];
  onClose: () => void;
  onSave: (updates: Record<string, string>) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [pnrNumber, setPnrNumber] = useState(user.pnr_number);
  const [branchId, setBranchId] = useState(user.branch?.id || "");
  const [yearId, setYearId] = useState(user.year?.id || "");
  const [positionId, setPositionId] = useState(user.position?.id || "");
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name,
      pnr_number: pnrNumber,
      branch_id: branchId,
      year_id: yearId,
      position_id: positionId,
      status,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
        className="relative w-full max-w-lg glass-card rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-[color:var(--color-border)] flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Edit Member</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field w-full rounded-xl px-4 py-2.5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">PNR Number</label>
            <input
              value={pnrNumber}
              onChange={(e) => setPnrNumber(e.target.value)}
              required
              className="field w-full rounded-xl px-4 py-2.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="field w-full rounded-xl px-4 py-2.5"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Year</label>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                required
                className="field w-full rounded-xl px-4 py-2.5"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Position</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                required
                className="field w-full rounded-xl px-4 py-2.5"
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "approved")}
                className="field w-full rounded-xl px-4 py-2.5"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 px-4 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-2.5 px-4 rounded-xl disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
