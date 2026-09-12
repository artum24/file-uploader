"use client";

type ConfirmIcon = "trash" | "folder" | "warning";

function IconGlyph({ icon }: { icon: ConfirmIcon }) {
  switch (icon) {
    case "folder":
      return (
        <>
          <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
          <path d="M9.5 13.5h5" />
        </>
      );
    case "warning":
      return (
        <>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z" />
        </>
      );
    case "trash":
    default:
      return (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </>
      );
  }
}

export function ConfirmDialog({
  open,
  icon = "trash",
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  icon?: ConfirmIcon;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/38 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-sm flex-col gap-3.5 rounded-[24px] bg-white p-[22px] shadow-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            danger ? "bg-brick-50 text-brick-600" : "bg-sage-50 text-sage-600"
          }`}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <IconGlyph icon={icon} />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[18.5px] font-semibold tracking-tight text-sand-900">{title}</h3>
          {description && (
            <p className="text-[14px] leading-relaxed text-sand-500">{description}</p>
          )}
        </div>
        <div className="mt-0.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-[50px] rounded-[15px] text-[16px] font-semibold text-white transition disabled:opacity-50 ${
              danger ? "bg-brick-600 hover:bg-brick-700" : "bg-sage-600 shadow-button hover:bg-sage-700"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[50px] rounded-[15px] border border-sand-200 text-[16px] font-medium text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
