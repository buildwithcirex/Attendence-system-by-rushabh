"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Palmtree, Star, Loader2 } from "lucide-react";
import Holidays from "date-holidays";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Drawer } from "@/components/Drawer";

type ECellEvent = { id: string; title: string; event_date: string };

type DayEvent = { id: string; title: string; date: Date; type: "holiday" | "ecell" };

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface CalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarDrawer({ isOpen, onClose }: CalendarDrawerProps) {
  const [ecellEvents, setEcellEvents] = useState<ECellEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/calendar");
        if (res.ok) {
          const data = await res.json();
          if (data.success) setEcellEvents(data.events);
        }
      } catch (err) {
        console.error("Failed to fetch calendar events", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [isOpen]);

  const events = useMemo<DayEvent[]>(() => {
    const hd = new Holidays("IN");
    const holidays = hd.getHolidays(month.getFullYear());
    const merged: DayEvent[] = holidays.map((h) => ({
      id: `hol-${h.date}`,
      title: h.name,
      date: new Date(h.date),
      type: "holiday",
    }));
    ecellEvents.forEach((ev) => {
      merged.push({ id: ev.id, title: ev.title, date: parseISO(ev.event_date), type: "ecell" });
    });
    return merged;
  }, [ecellEvents, month]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const grid = eachDayOfInterval({ start, end: endOfMonth(month) });
    return { leading: getDay(start), grid };
  }, [month]);

  const selectedEvents = events
    .filter((e) => isSameDay(e.date, selected))
    .sort((a, b) => a.type.localeCompare(b.type));

  const dayHasEvent = (day: Date) => events.some((e) => isSameDay(e.date, day));

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Calendar"
      icon={CalendarIcon}
      accent="bg-purple-500/10 border-purple-500/20 text-purple-400"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="p-2 rounded-lg btn-secondary"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold text-white">{format(month, "MMMM yyyy")}</div>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-lg btn-secondary"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-[10px] font-medium text-faint uppercase py-1">
                {d}
              </div>
            ))}
            {Array.from({ length: days.leading }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.grid.map((day) => {
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, new Date());
              const hasEvent = dayHasEvent(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors ${
                    isSelected
                      ? "bg-accent/20 border border-accent/40 text-white"
                      : isToday
                        ? "text-accent"
                        : isSameMonth(day, month)
                          ? "text-foreground hover:bg-white/5"
                          : "text-faint"
                  }`}
                >
                  {format(day, "d")}
                  {hasEvent && (
                    <span
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        isSelected ? "bg-white" : "bg-purple-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[color:var(--color-border)] pt-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider mb-3">
              {format(selected, "EEEE, MMMM d")}
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-faint">No events on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      ev.type === "holiday"
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-surface-2 border-[color:var(--color-border)]"
                    }`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                      {ev.type === "holiday" ? (
                        <Palmtree className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Star className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{ev.title}</div>
                      <div className="text-xs text-faint">
                        {ev.type === "holiday" ? "Holiday" : "E-Cell Event"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
