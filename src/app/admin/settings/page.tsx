"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, ShieldAlert } from "lucide-react";

type OptionRow = { id: string; name: string; is_active: boolean };
type OptionType = "branches" | "years" | "positions";

const SECTIONS: { type: OptionType; label: string }[] = [
  { type: "branches", label: "Branches" },
  { type: "years", label: "Years" },
  { type: "positions", label: "Positions" },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<OptionRow[]>([]);
  const [years, setYears] = useState<OptionRow[]>([]);
  const [positions, setPositions] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newNames, setNewNames] = useState<Record<OptionType, string>>({ branches: "", years: "", positions: "" });

  const listFor = (type: OptionType) => (type === "branches" ? branches : type === "years" ? years : positions);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/options");
      if (res.status === 403) {
        throw new Error("Unauthorized access. Admin privileges required.");
      }
      const data = await res.json();
      if (data.success) {
        setBranches(data.branches);
        setYears(data.years);
        setPositions(data.positions);
      } else {
        throw new Error(data.error || "Failed to load options");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadOptions();
    };
    load();
  }, [loadOptions]);

  const addOption = async (type: OptionType) => {
    const name = newNames[type].trim();
    if (!name) return;
    try {
      const res = await fetch("/api/admin/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name }),
      });
      if (res.ok) {
        setNewNames((prev) => ({ ...prev, [type]: "" }));
        await loadOptions();
      } else {
        alert(`Failed to add ${type.slice(0, -1)}.`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  const toggleActive = async (type: OptionType, row: OptionRow) => {
    try {
      const res = await fetch("/api/admin/options", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id: row.id, is_active: !row.is_active }),
      });
      if (res.ok) {
        await loadOptions();
      } else {
        alert("Failed to update entry.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/70 animate-spin" />
          <p className="text-muted font-light">Loading settings...</p>
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
      <div className="absolute top-[-25%] left-1/2 -translate-x-1/2 w-[60%] h-[50%] rounded-full bg-white/[0.03] blur-[160px] -z-10" />

      <header className="flex justify-between items-center mb-6 glass-card rounded-2xl p-4 px-6">
        <div>
          <h1 className="font-extrabold text-2xl text-white">Manage Options</h1>
          <p className="text-sm text-muted">Branches, Years &amp; ECELL Positions</p>
        </div>
        <button
          onClick={() => router.push("/admin")}
          className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        {SECTIONS.map(({ type, label }) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-[color:var(--color-border)] bg-surface-2">
              <h2 className="font-semibold text-white">{label}</h2>
            </div>

            <div className="p-4 flex gap-2 border-b border-[color:var(--color-border)]">
              <input
                value={newNames[type]}
                onChange={(e) => setNewNames((prev) => ({ ...prev, [type]: e.target.value }))}
                placeholder={`Add ${label.toLowerCase().slice(0, -1)}...`}
                className="field flex-1 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => addOption(type)}
                className="btn-primary px-3 rounded-lg flex items-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-white/5 flex-1">
              {listFor(type).length === 0 && (
                <div className="p-4 text-center text-faint text-sm">No entries yet.</div>
              )}
              {listFor(type).map((row) => (
                <div key={row.id} className="p-4 flex justify-between items-center">
                  <span className={row.is_active ? "text-white" : "text-faint line-through"}>{row.name}</span>
                  <button
                    onClick={() => toggleActive(type, row)}
                    className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                      row.is_active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                        : "bg-white/5 text-muted border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
                    }`}
                  >
                    {row.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </main>
    </div>
  );
}
