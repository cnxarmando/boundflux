import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, X, RotateCcw, Trash2 } from "lucide-react";

export interface ToastItem {
  id: string;
  type?: "success" | "info" | "error" | "warning";
  title: string;
  message?: string;
  undoAction?: () => void | Promise<void>;
  undoLabel?: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto bg-slate-900/95 dark:bg-slate-800/95 text-white p-4 rounded-2xl shadow-xl border border-slate-700/60 backdrop-blur-md flex items-start gap-3"
          >
            {toast.type === "error" ? (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            ) : toast.undoAction ? (
              <Trash2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-bold text-slate-100 font-display leading-tight">{toast.title}</h4>
              {toast.message && (
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{toast.message}</p>
              )}

              {toast.undoAction && (
                <button
                  onClick={async () => {
                    try {
                      await toast.undoAction!();
                    } catch (err) {
                      console.error("Error running undo action:", err);
                    } finally {
                      onDismiss(toast.id);
                    }
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg cursor-pointer transition-all shadow-xs active:scale-95"
                >
                  <RotateCcw className="h-3 w-3" />
                  {toast.undoLabel || "Desfazer"}
                </button>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
