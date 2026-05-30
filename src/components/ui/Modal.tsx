"use client";

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./Button";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative w-full ${sizeMap[size]} bg-[var(--background)] rounded-3xl shadow-3xl overflow-hidden`}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
                <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
            {footer && (
              <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--card)]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
