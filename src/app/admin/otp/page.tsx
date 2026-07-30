"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert, KeyRound } from "lucide-react";
import { GradientBackground } from "@/components/GradientBackground";

export default function AdminOtpPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOtp = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/otp");
      if (res.status === 403) {
        throw new Error("Unauthorized access. Admin privileges required.");
      }
      const data = await res.json();
      if (data.success) {
        setCode(data.code);
        setExpiresAt(data.expires_at);
        setError("");
      } else {
        throw new Error(data.error || "Failed to load OTP");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OTP");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchOtp();
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [fetchOtp]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
          <p className="text-muted font-light">Loading OTP...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-background">
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
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden text-white bg-background">
      <GradientBackground />

      <header className="flex justify-between items-center mb-6 glass-card rounded-2xl p-4 px-6">
        <div>
          <h1 className="font-extrabold text-2xl text-white">Login OTP</h1>
          <p className="text-sm text-muted">Current code for member check-in</p>
        </div>
        <button
          onClick={() => router.push("/admin")}
          className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="glass-card rounded-3xl p-12 flex flex-col items-center gap-6"
        >
          <div className="flex items-center gap-2 bg-surface-2 py-1.5 px-4 rounded-full border border-[color:var(--color-border)]">
            <KeyRound className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium text-muted uppercase tracking-[0.2em]">Active OTP</span>
          </div>

          <div
            className="font-mono text-7xl md:text-8xl font-bold tracking-[0.3em] text-white tabular-nums"
            style={{ textShadow: "0 0 40px rgba(255,255,255,0.15)" }}
          >
            {code}
          </div>

          <div className="text-sm text-muted">
            Expires in <span className="text-white font-semibold tabular-nums">{secondsLeft}s</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
