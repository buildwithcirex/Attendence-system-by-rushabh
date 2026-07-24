"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loginTime: string;
}

export function LogoutModal({ isOpen, onClose, onSuccess, loginTime }: LogoutModalProps) {
  const [workDescription, setWorkDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const timeIn = loginTime ? new Date(loginTime) : new Date();
  const timeOut = new Date();
  const durationMs = timeOut.getTime() - timeIn.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workDescription.length < 10) {
      setError("Please write at least a short sentence about what you accomplished.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logout_type: "manual",
          logout_time: timeOut.toISOString(),
          work_description: workDescription,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to logout");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
            className="fixed inset-0 m-auto w-full max-w-lg h-fit glass-card rounded-2xl z-50 overflow-hidden"
          >
            <div className="p-6 border-b border-[color:var(--color-border)] flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <LogOut className="w-5 h-5 text-muted" />
                Session Checkout
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-2 p-4 rounded-xl border border-[color:var(--color-border)]">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-wider">Time In</div>
                  <div className="font-mono text-lg tabular-nums">{format(timeIn, "hh:mm a")}</div>
                </div>
                <div className="bg-surface-2 p-4 rounded-xl border border-[color:var(--color-border)]">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-wider">Time Out</div>
                  <div className="font-mono text-lg tabular-nums text-white">{format(timeOut, "hh:mm a")}</div>
                </div>
              </div>

              <div className="bg-surface-3 border border-[color:var(--color-border-strong)] p-4 rounded-xl flex justify-between items-center">
                <span className="text-muted">Total Duration</span>
                <span className="font-mono text-xl font-bold text-white tabular-nums">
                  {durationHours}h {durationMins}m
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted ml-1">
                  What work did you accomplish today at E-Cell? <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  className="field w-full h-32 rounded-xl px-4 py-3 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1 py-3 px-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  Submit & Checkout
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
