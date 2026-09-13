"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadButton } from "./UploadButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { PreviewModal, type PreviewTarget } from "./PreviewModal";
import { ShareModal, type ShareTarget } from "./ShareModal";
import { ActionSheet } from "./ActionSheet";
import { RenameDialog } from "./RenameDialog";
import { MoveDialog, type MoveItem } from "./MoveDialog";
import { RowMenu } from "./RowMenu";
import { FileTypeIcon, getFileKind } from "./FileTypeIcon";
import { formatBytes } from "@/lib/upload-limits";

interface FileEntry {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  thumbnailUrl: string | null;
}

interface TrashFileEntry {
  id: string;
  type: "file";
  originalPath: string;
  originalName: string;
  size: number;
  deletedAt: string;
}

interface TrashFolderEntry {
  id: string;
  type: "folder";
  originalPath: string;
  originalName: string;
  deletedAt: string;
}

type TrashEntry = TrashFileEntry | TrashFolderEntry;

type SortKey = "name" | "size" | "date";
type SortDir = "asc" | "desc";
type ViewMode = "files" | "trash";

const SORT_LABEL: Record<SortKey, string> = {
  name: "name",
  size: "size",
  date: "date",
};

// Below this width the section renders single-tap mobile rows (icon + name +
// combined meta line, actions collapse into the ActionSheet). At and above it,
// the dashboard lays the two sections out side by side with room for a real
// table (separate size/date columns, hover actions) — matching the `lg`
// Tailwind breakpoint used for the row grid below.
const DESKTOP_BREAKPOINT_PX = 1024;

function folderOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx + 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (isSameDay(date, now)) return `Today, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: date.getFullYear() === now.getFullYear() ? undefined : "2-digit",
  });
}

async function fetchDownloadUrl(
  key: string,
  disposition: "inline" | "attachment"
): Promise<string> {
  const res = await fetch(
    `/api/files/download-url?key=${encodeURIComponent(key)}&disposition=${disposition}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not get file URL");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

function Breadcrumbs({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  if (!currentPath) return null;
  const segments = currentPath.split("/");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-sand-500">
      <button onClick={() => onNavigate("")} className="hover:underline">
        Home
      </button>
      {segments.map((segment, index) => {
        const pathUpTo = segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        return (
          <span key={pathUpTo} className="flex items-center gap-1.5">
            <span className="text-sand-300">/</span>
            <button
              onClick={() => onNavigate(pathUpTo)}
              className={isLast ? "font-medium text-sand-900" : "hover:underline"}
            >
              {segment}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === activeKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide whitespace-nowrap ${
        active ? "text-sand-700" : "text-sand-400 hover:text-sand-600"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      {active && <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
  variant = "ghost",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "ghost" | "outline";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition ${
        variant === "outline"
          ? "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
          : "text-sand-400 hover:bg-sand-100 hover:text-sand-600"
      }`}
    >
      {children}
    </button>
  );
}

export function ScopeSection({
  scope,
  title,
}: {
  scope: "personal" | "shared";
  title: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("files");
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [folders, setFolders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  type PendingDelete =
    | { type: "file"; key: string; name: string }
    | { type: "folder"; name: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [actionSheetFile, setActionSheetFile] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [moveTarget, setMoveTarget] = useState<MoveItem | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(
    null
  );

  const [trashFiles, setTrashFiles] = useState<TrashFileEntry[] | null>(null);
  const [trashFolders, setTrashFolders] = useState<TrashFolderEntry[] | null>(null);
  const [pendingPurge, setPendingPurge] = useState<TrashEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/files/list?scope=${scope}&path=${encodeURIComponent(currentPath)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not load files");
      }
      const data = (await res.json()) as { files: FileEntry[]; folders: string[] };
      setFiles(data.files);
      setFolders(data.folders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load files");
    }
  }, [scope, currentPath]);

  const loadTrash = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/list-trash?scope=${scope}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not load trash");
      }
      const data = (await res.json()) as {
        files: TrashFileEntry[];
        folders: TrashFolderEntry[];
      };
      setTrashFiles(data.files);
      setTrashFolders(data.folders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trash");
    }
  }, [scope]);

  useEffect(() => {
    if (viewMode !== "files") return;
    setFiles(null);
    setFolders(null);
    load();
  }, [load, viewMode]);

  useEffect(() => {
    if (viewMode !== "trash") return;
    setTrashFiles(null);
    setTrashFolders(null);
    loadTrash();
  }, [loadTrash, viewMode]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sortedFolders = useMemo(
    () => (folders ? [...folders].sort((a, b) => a.localeCompare(b)) : null),
    [folders]
  );

  const sortedFiles = useMemo(() => {
    if (!files) return null;
    return [...files].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = (a.lastModified ?? "").localeCompare(b.lastModified ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [files, sortKey, sortDir]);

  async function handlePreview(file: FileEntry) {
    setError(null);
    try {
      const url = await fetchDownloadUrl(file.key, "inline");
      setPreview({ key: file.key, name: file.name, url, size: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open file");
    }
  }

  async function handleDownload(key: string) {
    setError(null);
    try {
      const url = await fetchDownloadUrl(key, "attachment");
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download file");
    }
  }

  async function handleRename(newName: string) {
    if (!renameTarget) return;
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await fetch("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: renameTarget.key, newName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not rename file");
      }
      setRenameTarget(null);
      await load();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Could not rename file");
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleMove(destPath: string) {
    if (!moveTarget) return;
    setMoveBusy(true);
    setMoveError(null);
    try {
      const body =
        moveTarget.type === "file"
          ? { scope, destPath, item: { type: "file", key: moveTarget.key } }
          : {
              scope,
              destPath,
              item: { type: "folder", path: moveTarget.parentPath, name: moveTarget.name },
            };
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        throw new Error(
          responseBody.error ?? `Could not move ${moveTarget.type === "file" ? "file" : "folder"}`
        );
      }
      setMoveTarget(null);
      await load();
    } catch (err) {
      setMoveError(
        err instanceof Error
          ? err.message
          : `Could not move ${moveTarget.type === "file" ? "file" : "folder"}`
      );
    } finally {
      setMoveBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const busyId =
      pendingDelete.type === "file" ? pendingDelete.key : `folder:${pendingDelete.name}`;

    setError(null);
    setBusyKey(busyId);
    try {
      const res =
        pendingDelete.type === "file"
          ? await fetch("/api/files/trash", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: pendingDelete.key }),
            })
          : await fetch("/api/files/trash-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope, path: currentPath, name: pendingDelete.name }),
            });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ?? (pendingDelete.type === "file" ? "Could not delete file" : "Could not delete folder")
        );
      }
      await load();
      setPendingDelete(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : pendingDelete.type === "file"
          ? "Could not delete file"
          : "Could not delete folder"
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestore(entry: TrashEntry) {
    setError(null);
    setBusyKey(`restore:${entry.id}`);
    try {
      const res = await fetch("/api/files/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, id: entry.id, type: entry.type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not restore");
      }
      await loadTrash();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore");
    } finally {
      setBusyKey(null);
    }
  }

  async function confirmPurge() {
    if (!pendingPurge) return;
    setError(null);
    setBusyKey(`purge:${pendingPurge.id}`);
    try {
      const res = await fetch("/api/files/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, id: pendingPurge.id, type: pendingPurge.type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not delete permanently");
      }
      await loadTrash();
      setPendingPurge(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete permanently");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    setError(null);
    setFolderBusy(true);
    try {
      const res = await fetch("/api/files/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, path: currentPath, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not create folder");
      }
      setNewFolderName("");
      setCreatingFolder(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder");
    } finally {
      setFolderBusy(false);
    }
  }

  const isLoading = files === null && folders === null && !error && viewMode === "files";
  const isEmpty =
    files !== null && folders !== null && files.length === 0 && folders.length === 0;
  const hasRows =
    (sortedFolders && sortedFolders.length > 0) || (sortedFiles && sortedFiles.length > 0);

  const trashLoading =
    trashFiles === null && trashFolders === null && !error && viewMode === "trash";
  const trashEmpty =
    trashFiles !== null && trashFolders !== null &&
    trashFiles.length === 0 && trashFolders.length === 0;
  const trashHasRows =
    (trashFolders && trashFolders.length > 0) || (trashFiles && trashFiles.length > 0);

  const rowGrid =
    "grid-cols-[40px_minmax(0,1fr)_auto] lg:grid-cols-[40px_minmax(0,1fr)_72px_112px_184px]";

  return (
    <section className="w-full rounded-[20px] border border-sand-100 bg-white p-4 shadow-card lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[17px] font-semibold tracking-tight text-sand-900">
            {viewMode === "trash" ? `${title} — Trash` : title}
          </span>
          {viewMode === "files" && (
            <span className="shrink-0 text-[13px] text-sand-400">
              {(sortedFolders?.length ?? 0) + (sortedFiles?.length ?? 0) || null}
            </span>
          )}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {viewMode === "files" ? (
            <>
              <IconButton label="Trash" onClick={() => setViewMode("trash")}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </IconButton>
              <IconButton
                label="New folder"
                variant="outline"
                onClick={() => setCreatingFolder((v) => !v)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                  <path d="M12 12v5" />
                  <path d="M9.5 14.5h5" />
                </svg>
              </IconButton>
              <UploadButton
                scope={scope}
                folder={currentPath}
                label="Upload"
                onUploaded={load}
                onProgress={setUploadProgress}
              />
            </>
          ) : (
            <button
              onClick={() => setViewMode("files")}
              className="whitespace-nowrap rounded-[10px] border border-sand-200 px-3 py-1.5 text-sm text-sand-700 transition hover:bg-sand-50"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {viewMode === "files" && <Breadcrumbs currentPath={currentPath} onNavigate={setCurrentPath} />}
      {viewMode === "trash" && (
        <p className="mb-3 text-[13px] text-sand-400">
          Items stay here until you delete them for good.
        </p>
      )}

      {viewMode === "files" && creatingFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="mb-3 flex flex-col gap-2.5 rounded-2xl border border-sand-200 bg-sand-50 p-3"
        >
          <div className="flex h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-sage-600 bg-white px-3">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9AA097" strokeWidth="1.8" strokeLinecap="round">
              <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
            </svg>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-sand-900 outline-none placeholder:text-sand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(false);
                setNewFolderName("");
              }}
              className="h-11 rounded-xl border border-sand-200 bg-white text-[15px] font-medium text-sand-700 transition hover:bg-sand-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={folderBusy || !newFolderName.trim()}
              className="h-11 rounded-xl bg-sage-600 text-[15px] font-semibold text-white transition hover:bg-sage-700 disabled:opacity-50"
            >
              {folderBusy ? "…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-2 text-sm text-brick-600">{error}</p>}

      {viewMode === "files" && (
        <>
          {uploadProgress && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-sand-100 bg-white p-3.5 shadow-card">
              <FileTypeIcon kind="generic" size={36} />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13.5px]">
                  <span className="truncate font-medium text-sand-900">{uploadProgress.name}</span>
                  <span className="shrink-0 text-sand-500">{uploadProgress.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sand-100">
                  <div
                    className="h-full rounded-full bg-sage-600 transition-all"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="animate-pulse space-y-0 rounded-2xl border border-sand-100 px-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-sand-100" : ""}`}
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-sand-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-3/5 rounded bg-sand-100" />
                    <div className="h-2 w-2/5 rounded bg-sand-50" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50 text-sage-600">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                </svg>
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-sand-900">Nothing here yet</p>
                <p className="max-w-xs text-[13.5px] leading-relaxed text-sand-500">
                  Upload a photo or document, or create a folder to sort things first.
                </p>
              </div>
              <div className="mt-1">
                <UploadButton
                  scope={scope}
                  folder={currentPath}
                  label="Upload a file"
                  size="lg"
                  onUploaded={load}
                  onProgress={setUploadProgress}
                />
              </div>
            </div>
          )}

          {hasRows && (
            <div>
              <div
                className={`hidden ${rowGrid} gap-3 border-b border-sand-100 pb-2 lg:grid`}
              >
                <span />
                <SortHeader label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader
                  label="Size"
                  sortKey="size"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="Date"
                  sortKey="date"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <span />
              </div>

              <div>
                {sortedFolders?.map((folder, index) => (
                  <div
                    key={`folder-${folder}`}
                    className={`grid ${rowGrid} min-h-[60px] items-center gap-3 ${
                      index > 0 ? "border-t border-sand-100" : ""
                    }`}
                  >
                    <FileTypeIcon kind="folder" />
                    <button
                      onClick={() =>
                        setCurrentPath(currentPath ? `${currentPath}/${folder}` : folder)
                      }
                      className="flex min-w-0 flex-col items-start gap-0.5 text-left"
                    >
                      <span className="truncate text-[15px] font-medium text-sand-900">
                        {folder}
                      </span>
                      <span className="text-[12.5px] text-sand-400 lg:hidden">Folder</span>
                    </button>
                    <span className="hidden text-right text-[13px] text-sand-300 lg:block">—</span>
                    <span className="hidden text-right text-[13px] text-sand-300 lg:block">—</span>
                    <div className="flex items-center justify-end gap-1">
                      {busyKey === `folder:${folder}` ? (
                        <span className="grid h-8 w-8 shrink-0 place-items-center text-sand-400">…</span>
                      ) : (
                        <RowMenu
                          items={[
                            {
                              label: "Move to…",
                              glyph: (
                                <>
                                  <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                                  <path d="M8.5 13h6" />
                                  <path d="M12 10l3 3-3 3" />
                                </>
                              ),
                              onSelect: () =>
                                setMoveTarget({ type: "folder", name: folder, parentPath: currentPath }),
                            },
                            {
                              label: "Delete folder",
                              danger: true,
                              glyph: (
                                <>
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                </>
                              ),
                              onSelect: () => setPendingDelete({ type: "folder", name: folder }),
                            },
                          ]}
                        />
                      )}
                      <span className="grid h-8 w-8 shrink-0 place-items-center text-sand-300">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </span>
                    </div>
                  </div>
                ))}
                {sortedFiles?.map((file, index) => {
                  const kind = getFileKind(file.name);
                  const hasBorder = (sortedFolders?.length ?? 0) > 0 || index > 0;
                  return (
                    <div
                      key={file.key}
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          window.innerWidth < DESKTOP_BREAKPOINT_PX
                        ) {
                          setActionSheetFile(file);
                        } else {
                          handlePreview(file);
                        }
                      }}
                      className={`grid ${rowGrid} min-h-[60px] cursor-pointer items-center gap-3 transition hover:bg-sand-50 ${
                        hasBorder ? "border-t border-sand-100" : ""
                      }`}
                    >
                      {file.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbnailUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <FileTypeIcon kind={kind} />
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-medium text-sand-900">
                          {file.name}
                        </span>
                        <span className="truncate text-[12.5px] text-sand-400 lg:hidden">
                          {formatBytes(file.size)} · {formatDate(file.lastModified)}
                        </span>
                      </div>
                      <span className="hidden whitespace-nowrap text-right text-[13px] text-sand-500 lg:block">
                        {formatBytes(file.size)}
                      </span>
                      <span className="hidden whitespace-nowrap text-right text-[13px] text-sand-500 lg:block">
                        {formatDate(file.lastModified)}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        <div className="hidden items-center gap-1 lg:flex">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePreview(file);
                            }}
                            aria-label="Preview"
                            title="Preview"
                            className="grid h-8 w-8 place-items-center rounded-md text-sand-400 transition hover:bg-sand-100 hover:text-sage-700"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setShareTarget({ key: file.key, name: file.name });
                            }}
                            aria-label="Share"
                            title="Share"
                            className="grid h-8 w-8 place-items-center rounded-md text-sand-400 transition hover:bg-sand-100 hover:text-sage-700"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                              <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
                              <path d="M8 12h8" />
                            </svg>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDownload(file.key);
                            }}
                            aria-label="Download"
                            title="Download"
                            className="grid h-8 w-8 place-items-center rounded-md text-sand-400 transition hover:bg-sand-100 hover:text-sage-700"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M12 4v12" />
                              <path d="M7 11l5 5 5-5" />
                              <path d="M4 20h16" />
                            </svg>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingDelete({ type: "file", key: file.key, name: file.name });
                            }}
                            disabled={busyKey === file.key}
                            aria-label="Delete"
                            title="Delete"
                            className="grid h-8 w-8 place-items-center rounded-md text-sand-400 transition hover:bg-brick-50 hover:text-brick-600 disabled:opacity-50"
                          >
                            {busyKey === file.key ? (
                              "…"
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                              </svg>
                            )}
                          </button>
                          <RowMenu
                            items={[
                              {
                                label: "Rename",
                                glyph: (
                                  <>
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </>
                                ),
                                onSelect: () => {
                                  setRenameTarget(file);
                                  setRenameError(null);
                                },
                              },
                              {
                                label: "Move to…",
                                glyph: (
                                  <>
                                    <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                                    <path d="M8.5 13h6" />
                                    <path d="M12 10l3 3-3 3" />
                                  </>
                                ),
                                onSelect: () => {
                                  setMoveTarget({
                                    type: "file",
                                    key: file.key,
                                    name: file.name,
                                    parentPath: currentPath,
                                  });
                                  setMoveError(null);
                                },
                              },
                            ]}
                          />
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionSheetFile(file);
                          }}
                          aria-label="File actions"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-sand-400 transition hover:bg-sand-100 lg:hidden"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="19" cy="12" r="1.6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-center text-[12.5px] text-sand-400 lg:hidden">
                Sorted by {SORT_LABEL[sortKey]} · {sortDir === "desc" ? "newest first" : "oldest first"}
              </p>
            </div>
          )}
        </>
      )}

      {viewMode === "trash" && (
        <>
          {trashLoading && (
            <div className="animate-pulse space-y-0 rounded-2xl border border-sand-100 px-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-sand-100" : ""}`}
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-sand-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-3/5 rounded bg-sand-100" />
                    <div className="h-2 w-2/5 rounded bg-sand-50" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {trashEmpty && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sand-50 text-sand-400">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </span>
              <p className="text-[15px] font-medium text-sand-900">Trash is empty</p>
            </div>
          )}

          {trashHasRows && (
            <div className="flex flex-col gap-3">
              {trashFolders?.map((entry) => (
                <div
                  key={`trash-folder-${entry.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-sand-100 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <FileTypeIcon kind="folder" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium text-sand-900">
                        {entry.originalName}
                      </span>
                      {folderOf(entry.originalPath) && (
                        <span className="truncate text-[12.5px] text-sand-400">
                          {folderOf(entry.originalPath)}
                        </span>
                      )}
                      <span className="text-[12.5px] text-sand-300">
                        Deleted {formatDate(entry.deletedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRestore(entry)}
                      disabled={busyKey === `restore:${entry.id}`}
                      className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-sand-200 text-[13.5px] font-medium text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
                    >
                      {busyKey === `restore:${entry.id}` ? "…" : "Restore"}
                    </button>
                    <button
                      onClick={() => setPendingPurge(entry)}
                      disabled={busyKey === `purge:${entry.id}`}
                      className="flex h-10 items-center justify-center rounded-xl border border-brick-100 text-[13.5px] font-medium text-brick-600 transition hover:bg-brick-50 disabled:opacity-50"
                    >
                      {busyKey === `purge:${entry.id}` ? "…" : "Delete forever"}
                    </button>
                  </div>
                </div>
              ))}
              {trashFiles?.map((entry) => (
                <div
                  key={`trash-file-${entry.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-sand-100 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <FileTypeIcon kind={getFileKind(entry.originalName)} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium text-sand-900">
                        {entry.originalName}
                      </span>
                      {folderOf(entry.originalPath) && (
                        <span className="truncate text-[12.5px] text-sand-400">
                          {folderOf(entry.originalPath)}
                        </span>
                      )}
                      <span className="text-[12.5px] text-sand-300">
                        Deleted {formatDate(entry.deletedAt)} · {formatBytes(entry.size)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRestore(entry)}
                      disabled={busyKey === `restore:${entry.id}`}
                      className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-sand-200 text-[13.5px] font-medium text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
                    >
                      {busyKey === `restore:${entry.id}` ? "…" : "Restore"}
                    </button>
                    <button
                      onClick={() => setPendingPurge(entry)}
                      disabled={busyKey === `purge:${entry.id}`}
                      className="flex h-10 items-center justify-center rounded-xl border border-brick-100 text-[13.5px] font-medium text-brick-600 transition hover:bg-brick-50 disabled:opacity-50"
                    >
                      {busyKey === `purge:${entry.id}` ? "…" : "Delete forever"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        icon={pendingDelete?.type === "folder" ? "folder" : "trash"}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description={
          pendingDelete?.type === "folder"
            ? "The folder and everything inside it — all nested files and subfolders — moves to Trash together. You can restore it from there."
            : "The file moves to Trash, where you can restore it."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        busy={
          pendingDelete
            ? busyKey ===
              (pendingDelete.type === "file" ? pendingDelete.key : `folder:${pendingDelete.name}`)
            : false
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingPurge !== null}
        icon="warning"
        title={`Delete "${pendingPurge?.originalName ?? ""}" forever?`}
        description="This can't be undone — the data will be permanently removed from S3."
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        danger
        busy={pendingPurge ? busyKey === `purge:${pendingPurge.id}` : false}
        onConfirm={confirmPurge}
        onCancel={() => setPendingPurge(null)}
      />

      <PreviewModal
        file={preview}
        onClose={() => setPreview(null)}
        onDownload={() => preview && handleDownload(preview.key)}
        onShare={() => {
          if (!preview) return;
          setShareTarget({ key: preview.key, name: preview.name });
          setPreview(null);
        }}
      />

      <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />

      <RenameDialog
        open={renameTarget !== null}
        currentName={renameTarget?.name ?? ""}
        busy={renameBusy}
        error={renameError}
        onConfirm={handleRename}
        onCancel={() => {
          setRenameTarget(null);
          setRenameError(null);
        }}
      />

      <MoveDialog
        open={moveTarget !== null}
        scope={scope}
        item={moveTarget}
        busy={moveBusy}
        error={moveError}
        onConfirm={handleMove}
        onCancel={() => {
          setMoveTarget(null);
          setMoveError(null);
        }}
      />

      <ActionSheet
        open={actionSheetFile !== null}
        title={actionSheetFile?.name ?? ""}
        subtitle={
          actionSheetFile
            ? `${formatBytes(actionSheetFile.size)} · ${formatDate(actionSheetFile.lastModified)}`
            : undefined
        }
        kind={actionSheetFile ? getFileKind(actionSheetFile.name) : undefined}
        thumbnailUrl={actionSheetFile?.thumbnailUrl}
        onClose={() => setActionSheetFile(null)}
        options={
          actionSheetFile
            ? [
                {
                  label: "Preview",
                  icon: "preview",
                  onSelect: () => handlePreview(actionSheetFile),
                },
                {
                  label: "Rename",
                  icon: "rename",
                  onSelect: () => {
                    setRenameTarget(actionSheetFile);
                    setRenameError(null);
                  },
                },
                {
                  label: "Move to…",
                  icon: "move",
                  onSelect: () => {
                    setMoveTarget({
                      type: "file",
                      key: actionSheetFile.key,
                      name: actionSheetFile.name,
                      parentPath: currentPath,
                    });
                    setMoveError(null);
                  },
                },
                {
                  label: "Share",
                  icon: "share",
                  onSelect: () =>
                    setShareTarget({ key: actionSheetFile.key, name: actionSheetFile.name }),
                },
                {
                  label: "Download",
                  icon: "download",
                  onSelect: () => handleDownload(actionSheetFile.key),
                },
                {
                  label: "Move to trash",
                  icon: "trash",
                  danger: true,
                  onSelect: () =>
                    setPendingDelete({
                      type: "file",
                      key: actionSheetFile.key,
                      name: actionSheetFile.name,
                    }),
                },
              ]
            : []
        }
      />
    </section>
  );
}
