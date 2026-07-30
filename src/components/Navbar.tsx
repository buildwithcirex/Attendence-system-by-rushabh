"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, ShieldCheck, User, LayoutDashboard, Settings } from "lucide-react";
import type { SessionPayload } from "@/utils/session";

interface NavbarProps {
  session: SessionPayload | null;
  onLogoutClick?: () => void;
  title?: string;
  subtitle?: string;
}

export function Navbar({ session, onLogoutClick, title = "E-Cell Portal", subtitle = "Active Session" }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  // Avoid hydration mismatch by only enabling scroll after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setMounted(true);
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (mounted) {
      setIsScrolled(latest > 50);
    }
  });

  const isAdmin = session?.role === "admin";
  const inAdminView = pathname.startsWith("/admin");

  return (
    <motion.header
      className={`fixed z-50 transition-all duration-300 ease-out ${
        isScrolled
          ? "top-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 backdrop-blur-md shadow-2xl py-2 px-6 flex items-center justify-between gap-6 w-[90%] md:w-auto"
          : "top-4 md:top-8 left-4 right-4 md:left-8 md:right-8 rounded-2xl glass-card py-4 px-6 flex justify-between items-center"
      }`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-3">
        {!isScrolled && (
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-[color:var(--color-border-strong)] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
        )}
        <div className={isScrolled ? "hidden md:block" : "block"}>
          <h1 className="font-bold text-lg leading-tight text-white">{title}</h1>
          {!isScrolled && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {session && (
          <div className={`hidden md:flex items-center gap-2 text-sm text-foreground bg-surface-2 py-1.5 px-3 md:py-2 md:px-4 rounded-full border border-[color:var(--color-border)] ${isScrolled ? 'text-xs py-1 px-3' : ''}`}>
            <User className="w-4 h-4 text-muted" />
            <span className="font-medium whitespace-nowrap">{session.name}</span>
            {!isScrolled && <span className="text-faint ml-1">({session.pnr_number})</span>}
          </div>
        )}

        {/* Task 4: Admin Dashboard Navigation Fix */}
        {isAdmin && (
          <>
            {inAdminView ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="btn-secondary py-1.5 px-3 md:py-2 md:px-4 rounded-xl flex items-center gap-2 transition-all hover:bg-white/10 border border-white/5"
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline font-medium text-emerald-400">Timer</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/admin")}
                className="btn-secondary py-1.5 px-3 md:py-2 md:px-4 rounded-xl flex items-center gap-2 transition-all hover:bg-white/10 border border-white/5"
              >
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline font-medium text-purple-400">Admin</span>
              </button>
            )}
          </>
        )}

        {onLogoutClick && (
          <button
            onClick={onLogoutClick}
            className={`${inAdminView ? 'btn-primary' : 'btn-secondary'} py-1.5 px-3 md:py-2 md:px-4 rounded-xl flex items-center gap-2 transition-all`}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{inAdminView ? 'Exit' : 'Checkout'}</span>
          </button>
        )}
      </div>
    </motion.header>
  );
}
