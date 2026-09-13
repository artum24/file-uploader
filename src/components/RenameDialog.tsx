"use client";

import { useEffect, useRef, useState } from "react";

export function RenameDialog({
  open,
  currentName,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  currentName: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    const id = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const dot = currentName.lastIndexOf(".");
      input.setSelectionRange(0, dot > 0 ? dot : currentName.length);
    });
    return () => cancelAnimationFrame(id);
  }, [open, currentName]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;
    onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/38 p-4"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-sm flex-col gap-3.5 rounded-[24px] bg-white p-[22px] shadow-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-50 text-sage-600"
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
        <h3 className="text-[18.5px] font-semibold tracking-tight text-sand-900">Rename file</h3>

        <div className="flex h-11 items-center rounded-xl border-[1.5px] border-sage-600 bg-white px-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-sand-900 outline-none"
          />
        </div>

        {error && <p className="text-[13px] text-brick-600">{error}</p>}

        <div className="mt-0.5 flex flex-col gap-2">
          <button
            type="submit"
            disabled={busy || !name.trim() || name.trim() === currentName}
            className="h-[50px] rounded-[15px] bg-sage-600 text-[16px] font-semibold text-white shadow-button transition hover:bg-sage-700 disabled:opacity-50"
          >
            {busy ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[50px] rounded-[15px] border border-sand-200 text-[16px] font-medium text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
