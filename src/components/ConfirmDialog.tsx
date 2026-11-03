"use client";

import { useEffect, useRef } from "react";
import { button } from "./ui";

/**
 * Confirmation for destructive actions. Uses the native <dialog> so focus is
 * trapped while open, Escape cancels, and focus returns to the trigger.
 * Cancel is focused by default.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      className="m-auto w-[min(400px,calc(100vw-2rem))] rounded-2xl border border-separator bg-surface p-5 text-label shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <h2 id="confirm-title" className="text-lg font-semibold">
        {title}
      </h2>
      <p id="confirm-body" className="mt-1.5 text-sm leading-normal text-label-2">
        {body}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button ref={cancelRef} type="button" className={button.gray} onClick={onClose} autoFocus>
          Cancel
        </button>
        <button
          type="button"
          className={button.destructive}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
