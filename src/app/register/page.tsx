"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Option = { id: string; name: string };

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    pnr_number: "",
    branch_id: "",
    year_id: "",
  });
  const [branches, setBranches] = useState<Option[]>([]);
  const [years, setYears] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await fetch("/api/options");
        const data = await res.json();
        if (data.success) {
          setBranches(data.branches);
          setYears(data.years);
          setFormData((prev) => ({
            ...prev,
            branch_id: data.branches[0]?.id || "",
            year_id: data.years[0]?.id || "",
          }));
        }
      } catch {
        setError("Failed to load branch/year options. Please refresh.");
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.endsWith("@kccemsr.edu.in")) {
      setError("Registration is restricted to @kccemsr.edu.in emails only.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone_number: formData.phone,
          pnr_number: formData.pnr_number,
          branch_id: formData.branch_id,
          year_id: formData.year_id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a]">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[60%] h-[45%] rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="w-full max-w-md glass-card rounded-2xl p-8 relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
            <UserPlus className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Registration Successful</h2>
          <p className="text-muted font-light mb-6">
            Your account is currently <span className="text-amber-400 font-medium">Pending Approval</span>.
            You will be able to log in once an admin approves your request.
          </p>
          <Link href="/">
            <button className="btn-secondary w-full py-3 rounded-xl">
              Return Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 relative overflow-y-auto overflow-x-hidden bg-[#0a0a0a]">
      <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[40%] rounded-full bg-white/[0.035] blur-[140px]" />

      <div className="w-full max-w-2xl mx-auto pt-8 pb-16 relative z-10">
        <Link href="/" className="inline-flex items-center text-muted hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white">Create an Account</h1>
            <p className="text-muted font-light mt-1">Join the E-Cell Attendance Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl"
              >
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-muted ml-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="field w-full rounded-xl px-4 py-3"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted ml-1">College Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="field w-full rounded-xl px-4 py-3"
              />
              <p className="text-xs text-faint ml-1">Must end in @kccemsr.edu.in</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted ml-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="field w-full rounded-xl px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted ml-1">PNR Number</label>
                <input
                  type="text"
                  name="pnr_number"
                  required
                  value={formData.pnr_number}
                  onChange={handleChange}
                  className="field w-full rounded-xl px-4 py-3"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted ml-1">Branch</label>
                <select
                  name="branch_id"
                  required
                  disabled={optionsLoading}
                  value={formData.branch_id}
                  onChange={handleChange}
                  className="field w-full rounded-xl px-4 py-3 appearance-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted ml-1">Year</label>
                <select
                  name="year_id"
                  required
                  disabled={optionsLoading}
                  value={formData.year_id}
                  onChange={handleChange}
                  className="field w-full rounded-xl px-4 py-3 appearance-none"
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || optionsLoading}
              className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              {loading ? "Submitting..." : "Submit Registration"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
