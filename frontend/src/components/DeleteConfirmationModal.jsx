import React from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import clsx from "clsx";

export default function DeleteConfirmationModal({
  open,
  title = "Delete item",
  message = "This action cannot be undone.",
  itemName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-xl border border-[#d8dde6] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e3e4] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ffdad6] text-[#ba1a1a]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="delete-confirmation-title"
                className="text-base font-bold text-[#191c1d]"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#434654]">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#596170] hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close delete confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {itemName && (
          <div className="px-5 pt-4">
            <div className="rounded-lg border border-[#e1e3e4] bg-[#f8f9fb] px-4 py-3 text-sm font-semibold text-[#191c1d]">
              {itemName}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#b9c0d4] bg-white px-4 text-sm font-semibold text-[#191c1d] transition-colors hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              "bg-[#ba1a1a] hover:bg-[#8f1010]",
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
