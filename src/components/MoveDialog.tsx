"use client";

import { useCallback, useEffect, useState } from "react";
import { FileTypeIcon } from "./FileTypeIcon";

export type MoveItem =
  | { type: "file"; key: string; name: string; parentPath: string }
  | { type: "folder"; name: string; parentPath: string };

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function MoveDialog({
  open,
  scope,
  item,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  scope: "personal" | "shared";
  item: MoveItem | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: (destPath: string) => void;
  onCancel: () => void;
}) {
  const [browsePath, setBrowsePath] = useState("");
  const [folders, setFolders] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBrowsePath("");
  }, [open, item]);

  const load = useCallback(async () => {
    setFolders(null);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/files/list?scope=${scope}&path=${encodeURIComponent(browsePath)}`
      );
      if (!res.ok) throw new Error("Could not load folders");
      const data = (await res.json()) as { folders: string[] };
      setFolders(data.folders);
    } catch {
      setLoadError("Could not load folders");
    }
  }, [scope, browsePath]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  if (!open || !item) return null;

  const excludedPath = item.type === "folder" ? joinPath(item.parentPath, item.name) : null;
  const isInsideExcluded =
    excludedPath !== null &&
    (browsePath === excludedPath || browsePath.startsWith(`${excludedPath}/`));
  const isCurrentLocation = browsePath === item.parentPath;
  const canMoveHere = !isInsideExcluded && !isCurrentLocation;

  const segments = browsePath ? browsePath.split("/") : [];

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
        <div className="flex items-center gap-3">
          <FileTypeIcon kind={item.type === "folder" ? "folder" : "generic"} size={36} />
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold text-sand-900">Move &quot;{item.name}&quot;</h3>
            <p className="text-[12.5px] text-sand-400">Choose a destination folder</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-sand-500">
          <button onClick={() => setBrowsePath("")} className="hover:underline">
            Home
          </button>
          {segments.map((segment, index) => {
            const pathUpTo = segments.slice(0, index + 1).join("/");
            const isLast = index === segments.length - 1;
            return (
              <span key={pathUpTo} className="flex items-center gap-1.5">
                <span className="text-sand-300">/</span>
                <button
                  onClick={() => setBrowsePath(pathUpTo)}
                  className={isLast ? "font-medium text-sand-900" : "hover:underline"}
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </div>

        <div className="h-[220px] overflow-y-auto rounded-2xl border border-sand-100">
          {folders === null && !loadError && (
            <div className="flex h-full items-center justify-center text-[13px] text-sand-400">
              Loading…
            </div>
          )}
          {loadError && (
            <div className="flex h-full items-center justify-center text-[13px] text-brick-600">
              {loadError}
            </div>
          )}
          {folders !== null && folders.length === 0 && (
            <div className="flex h-full items-center justify-center text-[13px] text-sand-400">
              No subfolders here
            </div>
          )}
          {folders?.map((folder, index) => {
            const fullPath = joinPath(browsePath, folder);
            const disabled = excludedPath !== null && fullPath === excludedPath;
            return (
              <button
                key={folder}
                type="button"
                disabled={disabled}
                onClick={() => setBrowsePath(fullPath)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  index > 0 ? "border-t border-sand-100" : ""
                } ${disabled ? "" : "hover:bg-sand-50"}`}
              >
                <FileTypeIcon kind="folder" size={28} />
                <span className="min-w-0 flex-1 truncate text-sand-900">{folder}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-sand-300">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            );
          })}
        </div>

        {isCurrentLocation && (
          <p className="text-[12.5px] text-sand-400">Already here — pick a different folder.</p>
        )}
        {isInsideExcluded && !isCurrentLocation && (
          <p className="text-[12.5px] text-sand-400">Can&apos;t move a folder into itself.</p>
        )}
        {error && <p className="text-[13px] text-brick-600">{error}</p>}

        <div className="mt-0.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onConfirm(browsePath)}
            disabled={busy || !canMoveHere}
            className="h-[50px] rounded-[15px] bg-sage-600 text-[16px] font-semibold text-white shadow-button transition hover:bg-sage-700 disabled:opacity-50"
          >
            {busy ? "…" : browsePath ? `Move here` : "Move to Home"}
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
      </div>
    </div>
  );
}
