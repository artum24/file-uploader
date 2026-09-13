"use client";

import { FileTypeIcon, type FileKind } from "./FileTypeIcon";

type ActionIcon = "preview" | "share" | "download" | "rename" | "move" | "trash";

export interface ActionSheetOption {
  label: string;
  icon: ActionIcon;
  onSelect: () => void;
  danger?: boolean;
}

function OptionGlyph({ icon }: { icon: ActionIcon }) {
  switch (icon) {
    case "preview":
      return (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case "share":
      return (
        <>
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
          <path d="M8 12h8" />
        </>
      );
    case "download":
      return (
        <>
          <path d="M12 4v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M4 20h16" />
        </>
      );
    case "rename":
      return (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      );
    case "move":
      return (
        <>
          <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
          <path d="M8.5 13h6" />
          <path d="M12 10l3 3-3 3" />
        </>
      );
    case "trash":
      return (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </>
      );
  }
}

export function ActionSheet({
  open,
  title,
  subtitle,
  kind,
  thumbnailUrl,
  options,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  kind?: FileKind;
  thumbnailUrl?: string | null;
  options: ActionSheetOption[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 lg:hidden"
      onClick={onClose}
    >
      <div className="flex w-full max-w-md flex-col gap-2.5 p-3">
        <div
          role="dialog"
          aria-modal="true"
          className="overflow-hidden rounded-[22px] bg-white shadow-sheet"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-sand-100 px-[18px] py-3.5">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <FileTypeIcon kind={kind ?? "generic"} size={36} />
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-sand-900">{title}</p>
              {subtitle && <p className="truncate text-[12.5px] text-sand-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-col">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  option.onSelect();
                  onClose();
                }}
                className={`flex h-14 items-center gap-3.5 px-[18px] text-left text-[16px] font-medium transition active:bg-sand-50 ${
                  option.danger ? "text-brick-600" : "text-sand-900"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={option.danger ? "currentColor" : "#5F6560"}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <OptionGlyph icon={option.icon} />
                </svg>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-14 place-items-center rounded-[22px] bg-white text-[16px] font-semibold text-sand-900 shadow-sheet"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
