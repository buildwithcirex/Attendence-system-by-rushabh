"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Fingerprint, Loader2, Mail } from "lucide-react";
import { OTPInput } from "@/components/OTPInput";
import { GradientBackground } from "@/components/GradientBackground";

const ADMIN_ERRORS: Record<string, string> = {
  invalid_link: "That admin login link is invalid or has expired. Request a new one below.",
  not_admin: "That account isn't an approved admin.",
  session_failed: "Couldn't start your session. Please try again.",
  server_error: "Something went wrong signing you in. Please try again.",
};

function LoginForm() {
  const router = useRouter();
  const adminErrorCode = useSearchParams().get("admin_error");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(
    adminErrorCode ? ADMIN_ERRORS[adminErrorCode] ?? "Admin login failed. Please try again." : "",
  );
  const [loading, setLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSent, setAdminSent] = useState(false);

  const requestAdminLink = async () => {
    if (!email) {
      setError("Enter your admin email above first.");
      return;
    }

    setAdminLoading(true);
    setError("");
    setAdminSent(false);

    try {
      const res = await fetch("/api/auth/admin-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setAdminSent(true);
      } else {
        setError(data.error || "Could not send the admin link.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || otp.length !== 6) {
      setError("Please enter a valid Email and 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <GradientBackground />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-[color:var(--color-border-strong)] flex items-center justify-center mb-4">
            <Fingerprint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-center">E-Cell Portal</h1>
          <p className="text-sm text-muted font-light mt-2 text-center">Secure authentication via OTP generator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full rounded-xl px-4 py-3"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted ml-1">One-Time Password (OTP)</label>
            <OTPInput value={otp} onChange={setOtp} length={6} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? "Authenticating..." : "Access Portal"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[color:var(--color-border)]">
          {adminSent && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm p-3 rounded-xl text-center mb-4">
              If that email belongs to an admin, a login link is on its way. Check your inbox.
            </div>
          )}

          <button
            type="button"
            onClick={requestAdminLink}
            disabled={adminLoading}
            className="btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Email me an admin login link
          </button>
          <p className="text-xs text-faint mt-2 text-center">
            Admins can sign in with a one-time email link instead of an OTP.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
