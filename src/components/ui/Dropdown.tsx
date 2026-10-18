"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export interface DropdownOption<Value extends string = string> {
  value: Value;
  label: string;
}

interface DropdownProps<Value extends string> {
  value: Value;
  options: readonly DropdownOption<Value>[];
  onChange: (value: Value) => void;
  ariaLabel?: string;
  leadingIcon?: ReactNode;
  className?: string;
  triggerClassName?: string;
  labelClassName?: string;
}

export function Dropdown<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  leadingIcon,
  className,
  triggerClassName,
  labelClassName,
}: DropdownProps<Value>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel ?? selected?.label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={clsx(
          "flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] text-xs font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          triggerClassName,
        )}
      >
        {leadingIcon}
        {selected && (
          <span className={labelClassName}>{selected.label}</span>
        )}
        <ChevronDown
          className={clsx(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="listbox"
            aria-label={ariaLabel}
            className="absolute right-0 top-full mt-1 z-30 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-xl overflow-hidden min-w-[160px]"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full px-4 py-2.5 text-sm text-left transition-colors",
                  value === option.value
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-[var(--foreground)] hover:bg-[var(--background)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
