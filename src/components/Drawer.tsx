"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  accent: string;
  children: React.ReactNode;
}

// Right-side overlay panel shared by the dashboard Tasks and Calendar drawers.
export function Drawer({ isOpen, onClose, title, icon: Icon, accent, children }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[61] glass-card rounded-none border-l border-[color:var(--color-border)] flex flex-col"
          >
            <div className="p-5 border-b border-[color:var(--color-border)] flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2.5 text-white">
                <span className={`p-1.5 rounded-lg border ${accent}`}>
                  <Icon className="w-5 h-5" />
                </span>
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
