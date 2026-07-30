"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { LogoutModal } from "@/components/LogoutModal";
import { Navbar } from "@/components/Navbar";
import { TasksDrawer } from "@/components/TasksDrawer";
import { CalendarDrawer } from "@/components/CalendarDrawer";
import { GradientBackground } from "@/components/GradientBackground";
import { format } from "date-fns";
import type { SessionPayload } from "@/utils/session";

const DEFAULT_TARGET_MINUTES = 4 * 60;

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Timer state
  const [elapsedStr, setElapsedStr] = useState("00:00:00");
  const [progressPercent, setProgressPercent] = useState(0);
  const [reachedGoal, setReachedGoal] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkSession = async () => {
      try {
        const res = await fetch("/api/session/status");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setSession(data.session);
            startTimer(data.session.login_time, data.session.target_minutes, data.serverNow);
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Failed to check session", err);
      } finally {
        setLoading(false);
      }
    };

    const startTimer = (loginTimeIso: string, targetMinutes: number | undefined, serverNow?: number) => {
      const loginTime = new Date(loginTimeIso).getTime();
      const targetMs = (targetMinutes ?? DEFAULT_TARGET_MINUTES) * 60 * 1000;

      // Correct for the client's clock being off from the server's.
      const clientClockSkew = serverNow ? serverNow - Date.now() : 0;

      intervalId = setInterval(() => {
        const now = Date.now() + clientClockSkew;
        let elapsed = now - loginTime;
        if (elapsed < 0) elapsed = 0;

        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (n: number) => n.toString().padStart(2, "0");
        setElapsedStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

        setProgressPercent(Math.min((elapsed / targetMs) * 100, 100));
        setReachedGoal(elapsed >= targetMs);
      }, 1000);
    };

    checkSession();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
          <p className="text-muted font-light">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const targetHours = Math.round((session.target_minutes ?? DEFAULT_TARGET_MINUTES) / 60);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden">
      <GradientBackground />

      <Navbar
        session={session}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        onTasksClick={() => setIsTasksOpen(true)}
        onCalendarClick={() => setIsCalendarOpen(true)}
        title="E-Cell Portal"
        subtitle="Active Session"
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full pt-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="w-full relative"
        >
          <div className={`glass-card rounded-3xl p-8 md:p-16 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-1000 ${reachedGoal ? 'border-amber-500/40' : ''}`}>

            <div className="mb-4 flex items-center gap-2 bg-surface-2 py-1.5 px-4 rounded-full border border-[color:var(--color-border)] z-10">
              <Clock className={`w-4 h-4 ${reachedGoal ? 'text-amber-400' : 'text-muted'}`} />
              <span className="text-sm font-medium text-muted uppercase tracking-[0.2em]">
                Session Timer
              </span>
            </div>

            <div
              className={`font-mono text-6xl md:text-8xl font-bold tracking-tighter z-10 mb-8 tabular-nums ${reachedGoal ? 'text-amber-300' : 'text-white'}`}
              style={reachedGoal ? undefined : { textShadow: "0 0 40px rgba(255,255,255,0.15)" }}
            >
              {elapsedStr}
            </div>

            <div className="w-full max-w-md h-1.5 bg-surface-2 rounded-full overflow-hidden z-10 border border-[color:var(--color-border)]">
              <div
                className={`h-full transition-[width] duration-1000 ease-linear ${reachedGoal ? 'bg-amber-500' : 'bg-accent'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-4 flex justify-between w-full max-w-md text-xs text-muted font-medium z-10 px-1">
              <span>Time In: {format(new Date(session.login_time), "hh:mm a")}</span>
              <span className={reachedGoal ? "text-amber-400" : ""}>
                {reachedGoal ? `Goal of ${targetHours}h reached` : `Goal: ${targetHours}h`}
              </span>
            </div>
          </div>
        </motion.div>
      </main>

      <TasksDrawer
        isOpen={isTasksOpen}
        onClose={() => setIsTasksOpen(false)}
        memberId={session.member_id}
      />
      <CalendarDrawer isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onSuccess={() => router.push("/login")}
        loginTime={session?.login_time}
      />
    </div>
  );
}
