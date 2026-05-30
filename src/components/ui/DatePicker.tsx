"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations, useLocale } from "next-intl";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface DatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  error,
}: DatePickerProps) {
  const t = useTranslations("datePicker");
  const locale = useLocale();

  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"day" | "year">("day");
  useBodyScrollLock(open);
  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? today.getMonth()
  );

  // Localised month name
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(viewYear, viewMonth, 1)
  );

  // Short weekday headers starting Sunday
  const weekdayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(2023, 0, i + 1) // Jan 1 2023 = Sunday
    )
  );

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const yyyy = String(viewYear);
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
    setMode("day");
  };

  const jumpToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const displayValue = selected
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(selected)
    : "";

  // Year range: 20 years back to 10 years forward
  const years = Array.from(
    { length: 31 },
    (_, i) => today.getFullYear() - 20 + i
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          // Reset view to selected or today when opening
          if (selected) {
            setViewYear(selected.getFullYear());
            setViewMonth(selected.getMonth());
          } else {
            setViewYear(today.getFullYear());
            setViewMonth(today.getMonth());
          }
          setMode("day");
          setOpen(true);
        }}
        className={clsx(
          "w-full flex items-center gap-2 px-3 py-2.5 bg-[var(--card)] border rounded-xl text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#7dc0ff]/20",
          error
            ? "border-red-500"
            : "border-[var(--card-border)] hover:border-[#7dc0ff]",
          displayValue ? "text-[var(--foreground)]" : "text-[var(--muted)]"
        )}
      >
        <Calendar className="h-4 w-4 text-[var(--muted)] flex-shrink-0" />
        <span className="flex-1">
          {displayValue || placeholder || t("selectDate")}
        </span>
        {value && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="p-0.5 text-[var(--muted)] hover:text-red-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />

            {/* Bottom sheet */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] border-t border-[var(--card-border)] rounded-t-3xl px-5 pt-4 pb-8 max-w-md mx-auto shadow-2xl"
            >
              {/* Handle bar */}
              <div className="w-10 h-1 rounded-full bg-[var(--card-border)] mx-auto mb-5" />

              {mode === "day" && (
                <>
                  {/* Month/year navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center hover:border-[#7dc0ff] transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4 text-[var(--foreground)]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("year")}
                      className="flex items-center gap-1 text-base font-semibold text-[var(--foreground)] px-3 py-1.5 rounded-xl hover:bg-[var(--card)] transition-colors capitalize"
                    >
                      {monthName} {viewYear}
                      <ChevronRight className="h-3.5 w-3.5 rotate-90 text-[var(--muted)]" />
                    </button>

                    <button
                      type="button"
                      onClick={nextMonth}
                      className="w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center hover:border-[#7dc0ff] transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 text-[var(--foreground)]" />
                    </button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {weekdayHeaders.map((d) => (
                      <div
                        key={d}
                        className="text-center text-[11px] text-[var(--muted)] font-medium py-1 capitalize"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`blank-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                      (day) => {
                        const isSelected =
                          selected &&
                          selected.getFullYear() === viewYear &&
                          selected.getMonth() === viewMonth &&
                          selected.getDate() === day;
                        const isToday =
                          today.getFullYear() === viewYear &&
                          today.getMonth() === viewMonth &&
                          today.getDate() === day;

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDayClick(day)}
                            className={clsx(
                              "w-full aspect-square rounded-full text-sm font-medium transition-all flex items-center justify-center active:scale-95",
                              isSelected
                                ? "bg-[#7dc0ff] text-white shadow-md shadow-[#7dc0ff]/40"
                                : isToday
                                ? "border-2 border-[#7dc0ff] text-[#7dc0ff]"
                                : "text-[var(--foreground)] hover:bg-[var(--card)]"
                            )}
                          >
                            {day}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Today shortcut */}
                  <button
                    type="button"
                    onClick={jumpToToday}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-[#7dc0ff] border border-[#7dc0ff]/30 hover:bg-[#7dc0ff]/8 transition-colors"
                  >
                    {t("today")}
                  </button>
                </>
              )}

              {mode === "year" && (
                <>
                  <p className="text-center text-base font-semibold text-[var(--foreground)] mb-4">
                    {t("selectYear")}
                  </p>

                  <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pb-1">
                    {years.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setViewYear(yr);
                          setMode("day");
                        }}
                        className={clsx(
                          "py-3 rounded-xl text-sm font-semibold transition-all active:scale-95",
                          yr === viewYear
                            ? "bg-[#7dc0ff] text-white shadow-md shadow-[#7dc0ff]/30"
                            : yr === today.getFullYear()
                            ? "border-2 border-[#7dc0ff] text-[#7dc0ff]"
                            : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-[#7dc0ff]"
                        )}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMode("day")}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
