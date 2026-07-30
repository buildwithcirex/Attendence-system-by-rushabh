"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, ShieldCheck, User, LayoutDashboard, Settings, BookOpen, FolderKanban, ListTodo, CalendarDays } from "lucide-react";
import type { SessionPayload } from "@/utils/session";

// Shared nav pill: neutral by default so a single accent (the cream Checkout/Exit
// button) leads the eye, per the one-accent rule.
const NAV_BTN =
  "btn-secondary py-1.5 px-3 md:py-2 md:px-4 rounded-lg flex items-center gap-2 text-sm text-foreground";

interface NavbarProps {
  session: SessionPayload | null;
  onLogoutClick?: () => void;
  onTasksClick?: () => void;
  onCalendarClick?: () => void;
  title?: string;
  subtitle?: string;
}

export function Navbar({ session, onLogoutClick, onTasksClick, onCalendarClick, title = "E-Cell Portal", subtitle = "Active Session" }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll events only fire client-side after hydration, so the collapsed state
  // can be derived directly without a mount guard.
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  const isAdmin = session?.role === "admin";
  const inAdminView = pathname.startsWith("/admin");

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
    >
      <header
        className={`pointer-events-auto origin-top transition-[padding,border-radius,background-color,box-shadow,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isScrolled
            ? "mt-4 rounded-full border border-white/10 bg-black/70 backdrop-blur-md shadow-2xl py-2 px-6 flex items-center justify-between gap-4 md:gap-6 w-max"
            : "mt-4 md:mt-8 w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] max-w-7xl rounded-2xl glass-card py-4 px-6 flex justify-between items-center"
        }`}
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

        {isAdmin && (
          inAdminView ? (
            <button onClick={() => router.push("/dashboard")} className={NAV_BTN}>
              <LayoutDashboard className="w-4 h-4 text-muted" />
              <span className="hidden sm:inline font-medium">Timer</span>
            </button>
          ) : (
            <button onClick={() => router.push("/admin")} className={NAV_BTN}>
              <Settings className="w-4 h-4 text-muted" />
              <span className="hidden sm:inline font-medium">Admin</span>
            </button>
          )
        )}

        {onTasksClick && (
          <button onClick={onTasksClick} className={NAV_BTN}>
            <ListTodo className="w-4 h-4 text-muted" />
            <span className="hidden sm:inline font-medium">Tasks</span>
          </button>
        )}

        {onCalendarClick && (
          <button onClick={onCalendarClick} className={NAV_BTN}>
            <CalendarDays className="w-4 h-4 text-muted" />
            <span className="hidden sm:inline font-medium">Calendar</span>
          </button>
        )}

        {!inAdminView && (
          <button onClick={() => router.push("/projects")} className={NAV_BTN}>
            <FolderKanban className="w-4 h-4 text-muted" />
            <span className="hidden sm:inline font-medium">Projects</span>
          </button>
        )}

        {!inAdminView && (
          <button onClick={() => router.push("/resources")} className={NAV_BTN}>
            <BookOpen className="w-4 h-4 text-muted" />
            <span className="hidden sm:inline font-medium">Resources</span>
          </button>
        )}

        {onLogoutClick && (
          <button
            onClick={onLogoutClick}
            className={`${inAdminView ? "btn-primary" : "btn-secondary"} py-1.5 px-3 md:py-2 md:px-4 rounded-lg flex items-center gap-2 text-sm`}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{inAdminView ? "Exit" : "Checkout"}</span>
          </button>
        )}
      </div>
      </header>
    </motion.div>
  );
}
