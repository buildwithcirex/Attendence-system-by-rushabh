"use client";

import { useEffect, useState, useMemo } from "react";
import { Calendar as CalendarIcon, Palmtree, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Holidays from "date-holidays";
import { format, isSameDay, parseISO } from "date-fns";

type ECellEvent = {
  id: string;
  title: string;
  event_date: string;
};

type MergedEvent = {
  id: string;
  title: string;
  date: Date;
  type: "holiday" | "ecell";
};

export function CombinedCalendar() {
  const [ecellEvents, setEcellEvents] = useState<ECellEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/calendar");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setEcellEvents(data.events);
          }
        }
      } catch (err) {
        console.error("Failed to fetch calendar events", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const mergedEvents = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const hd = new Holidays("IN"); // India holidays
    const holidays = hd.getHolidays(currentYear);

    const merged: MergedEvent[] = [];

    // Add Holidays
    holidays.forEach((h) => {
      merged.push({
        id: `hol-${h.date}`,
        title: h.name,
        date: new Date(h.date),
        type: "holiday",
      });
    });

    // Add E-Cell Events
    ecellEvents.forEach((ev) => {
      merged.push({
        id: ev.id,
        title: ev.title,
        date: parseISO(ev.event_date),
        type: "ecell",
      });
    });

    // Sort by date ascending, but filter out past events (keep today and future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return merged
      .filter((ev) => ev.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10); // show upcoming 10
  }, [ecellEvents]);

  if (loading) {
    return (
      <div className="w-full glass-card rounded-3xl p-6 md:p-8 flex flex-col mt-4 mb-16 relative overflow-hidden">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-white/10 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-white/5 rounded"></div>
              <div className="h-10 bg-white/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full glass-card rounded-3xl p-6 md:p-8 flex flex-col mt-4 mb-16 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <CalendarIcon className="w-5 h-5 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {mergedEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6 text-muted bg-white/5 rounded-xl border border-white/5"
            >
              No upcoming events!
            </motion.div>
          ) : (
            mergedEvents.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  ev.type === "holiday"
                    ? "bg-blue-500/5 border-blue-500/20 text-blue-100"
                    : "bg-surface-2 border-[color:var(--color-border)] hover:bg-white/5 text-foreground"
                }`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-black/20">
                  {ev.type === "holiday" ? (
                    <Palmtree className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Star className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{ev.title}</div>
                  <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                    {format(ev.date, "EEEE, MMM d, yyyy")}
                    {isSameDay(ev.date, new Date()) && (
                      <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                        Today
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="hidden sm:block text-xs font-medium px-2 py-1 rounded-md bg-white/5 text-faint">
                  {ev.type === "holiday" ? "Holiday" : "E-Cell"}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
