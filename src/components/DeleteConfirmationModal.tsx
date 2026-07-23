import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { motion } from "motion/react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  expectedConfirmation?: string; // e.g. "DELETAR" or the item ID
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  expectedConfirmation = "DELETAR"
}: DeleteConfirmationModalProps) {
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedConfirmation.trim().toUpperCase() === expectedConfirmation.trim().toUpperCase()) {
      setError(false);
      onConfirm();
      setTypedConfirmation("");
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-xl space-y-6"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl border border-rose-100 dark:border-rose-900/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Soft Delete with Retention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            You are about to delete <strong className="text-slate-900 dark:text-white font-semibold">"{itemName}"</strong>. This record will be sent to the **Trash** and kept for a **30-day retention period**, where it can be restored. After this period, it will be permanently purged from the system.
          </p>
          
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-3.5 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
            Only users with the <strong className="font-semibold">Owner</strong> or <strong className="font-semibold">Superadmin</strong> role are authorized to perform this operation.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Written Confirmation
            </label>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              To proceed, type <span className="font-mono font-bold text-rose-500 select-all">"{expectedConfirmation}"</span> in the field below:
            </p>
            <input
              type="text"
              required
              value={typedConfirmation}
              onChange={(e) => {
                setTypedConfirmation(e.target.value);
                if (error) setError(false);
              }}
              placeholder={`Type "${expectedConfirmation}"`}
              className={`w-full px-4 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-950 border text-slate-800 dark:text-slate-100 focus:outline-none transition-colors ${
                error 
                  ? "border-rose-500 focus:border-rose-600 ring-1 ring-rose-500" 
                  : "border-slate-200 dark:border-slate-800 focus:border-indigo-500"
              }`}
            />
            {error && (
              <p className="text-[10px] text-rose-500 font-medium">
                The entered text does not match. Please try again.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-650 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-rose-500/10"
            >
              Delete (Soft Delete)
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
