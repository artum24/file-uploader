"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadButton } from "./UploadButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { PreviewModal, type PreviewTarget } from "./PreviewModal";
import { ShareModal, type ShareTarget } from "./ShareModal";
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

const ICONS_BY_EXTENSION: Record<string, string> = {
  pdf: "📄",
  doc: "📝", docx: "📝", rtf: "📝", odt: "📝", txt: "📃",
  xls: "📊", xlsx: "📊", csv: "📊", ods: "📊",
  ppt: "📽️", pptx: "📽️", odp: "📽️",
  jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️",
  heic: "🖼️", svg: "🖼️", bmp: "🖼️", tiff: "🖼️",
  mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬", webm: "🎬",
  mp3: "🎵", wav: "🎵", m4a: "🎵", flac: "🎵",
  zip: "🗜️", rar: "🗜️", "7z": "🗜️",
};

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ICONS_BY_EXTENSION[ext] ?? "📎";
}

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
  const time = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

  if (isSameDay(date, now)) return `Сьогодні, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Вчора, ${time}`;

  return date.toLocaleDateString("uk-UA", {
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
    <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
      <button onClick={() => onNavigate("")} className="hover:underline">
        Home
      </button>
      {segments.map((segment, index) => {
        const pathUpTo = segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        return (
          <span key={pathUpTo} className="flex items-center gap-1">
            <span>/</span>
            <button
              onClick={() => onNavigate(pathUpTo)}
              className={isLast ? "font-medium text-gray-900" : "hover:underline"}
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
      className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
        active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      {active && <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>}
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
    () => (folders ? [...folders].sort((a, b) => a.localeCompare(b, "uk")) : null),
    [folders]
  );

  const sortedFiles = useMemo(() => {
    if (!files) return null;
    return [...files].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "uk");
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = (a.lastModified ?? "").localeCompare(b.lastModified ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [files, sortKey, sortDir]);

  async function handlePreview(file: FileEntry) {
    setError(null);
    try {
      const url = await fetchDownloadUrl(file.key, "inline");
      setPreview({ key: file.key, name: file.name, url });
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

  return (
    <section className="w-full max-w-md rounded-lg border p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate">
            {viewMode === "trash" ? `${title} — Кошик` : title}
          </span>
          {viewMode === "files" && (
            <button
              onClick={() => setViewMode("trash")}
              aria-label="Кошик"
              title="Кошик"
              className="shrink-0 text-sm text-gray-400 transition hover:text-gray-700"
            >
              🗑️
            </button>
          )}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {viewMode === "files" ? (
            <>
              <button
                onClick={() => setCreatingFolder((v) => !v)}
                className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition hover:bg-gray-50"
              >
                New folder
              </button>
              <UploadButton scope={scope} folder={currentPath} label="Upload" onUploaded={load} />
            </>
          ) : (
            <button
              onClick={() => setViewMode("files")}
              className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition hover:bg-gray-50"
            >
              ← Назад
            </button>
          )}
        </div>
      </div>

      {viewMode === "files" && <Breadcrumbs currentPath={currentPath} onNavigate={setCurrentPath} />}

      {viewMode === "files" && creatingFolder && (
        <form onSubmit={handleCreateFolder} className="mb-3 flex gap-2">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Назва папки"
            className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={folderBusy || !newFolderName.trim()}
            className="rounded-md bg-black px-3 py-1 text-sm text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {folderBusy ? "…" : "Створити"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName("");
            }}
            className="rounded-md border px-3 py-1 text-sm transition hover:bg-gray-50"
          >
            Скасувати
          </button>
        </form>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {viewMode === "files" && (
        <>
          {isLoading && <p className="text-sm text-gray-400">Завантаження…</p>}
          {isEmpty && <p className="text-sm text-gray-400">Тут ще нічого немає</p>}

          {hasRows && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1.5 pr-2 text-left">
                      <SortHeader
                        label="Назва"
                        sortKey="name"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="hidden w-16 py-1.5 pr-2 text-right sm:table-cell">
                      <SortHeader
                        label="Розмір"
                        sortKey="size"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </th>
                    <th className="w-24 py-1.5 pr-2 text-right">
                      <SortHeader
                        label="Дата"
                        sortKey="date"
                        activeKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </th>
                    <th className="w-28 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {sortedFolders?.map((folder) => (
                    <tr key={`folder-${folder}`} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <button
                          onClick={() =>
                            setCurrentPath(currentPath ? `${currentPath}/${folder}` : folder)
                          }
                          className="flex w-full items-center gap-2 text-left hover:text-blue-600"
                        >
                          <span aria-hidden>📁</span>
                          <span className="truncate">{folder}</span>
                        </button>
                      </td>
                      <td className="hidden py-2 pr-2 text-right text-gray-300 sm:table-cell">—</td>
                      <td className="py-2 pr-2 text-right text-gray-300">—</td>
                      <td className="py-2">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setPendingDelete({ type: "folder", name: folder })}
                            disabled={busyKey === `folder:${folder}`}
                            aria-label="Delete folder"
                            title="Delete folder"
                            className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {busyKey === `folder:${folder}` ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedFiles?.map((file) => (
                    <tr
                      key={file.key}
                      onClick={() => handlePreview(file)}
                      className="cursor-pointer border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {file.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={file.thumbnailUrl}
                              alt=""
                              className="h-6 w-6 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <span aria-hidden>{getFileIcon(file.name)}</span>
                          )}
                          <span className="truncate">{file.name}</span>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap py-2 pr-2 text-right text-xs text-gray-500 sm:table-cell">
                        {formatBytes(file.size)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-right text-xs text-gray-500">
                        {formatDate(file.lastModified)}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePreview(file);
                            }}
                            aria-label="Preview"
                            title="Preview"
                            className="text-gray-500 hover:text-blue-600"
                          >
                            👁️
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setShareTarget({ key: file.key, name: file.name });
                            }}
                            aria-label="Share"
                            title="Share"
                            className="text-gray-500 hover:text-blue-600"
                          >
                            🔗
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDownload(file.key);
                            }}
                            aria-label="Download"
                            title="Download"
                            className="text-gray-500 hover:text-blue-600"
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingDelete({ type: "file", key: file.key, name: file.name });
                            }}
                            disabled={busyKey === file.key}
                            aria-label="Delete"
                            title="Delete"
                            className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {busyKey === file.key ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {viewMode === "trash" && (
        <>
          {trashLoading && <p className="text-sm text-gray-400">Завантаження…</p>}
          {trashEmpty && <p className="text-sm text-gray-400">Кошик порожній</p>}

          {trashHasRows && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1.5 pr-2 text-left text-xs font-medium text-gray-400">
                      Назва
                    </th>
                    <th className="w-24 py-1.5 pr-2 text-right text-xs font-medium text-gray-400">
                      Видалено
                    </th>
                    <th className="w-16 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {trashFolders?.map((entry) => (
                    <tr key={`trash-folder-${entry.id}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span aria-hidden>📁</span>
                          <div className="min-w-0">
                            <div className="truncate">{entry.originalName}</div>
                            {folderOf(entry.originalPath) && (
                              <div className="truncate text-xs text-gray-400">
                                {folderOf(entry.originalPath)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-right text-xs text-gray-500">
                        {formatDate(entry.deletedAt)}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleRestore(entry)}
                            disabled={busyKey === `restore:${entry.id}`}
                            aria-label="Restore"
                            title="Відновити"
                            className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
                          >
                            {busyKey === `restore:${entry.id}` ? "…" : "♻️"}
                          </button>
                          <button
                            onClick={() => setPendingPurge(entry)}
                            disabled={busyKey === `purge:${entry.id}`}
                            aria-label="Delete forever"
                            title="Видалити назавжди"
                            className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {busyKey === `purge:${entry.id}` ? "…" : "❌"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {trashFiles?.map((entry) => (
                    <tr key={`trash-file-${entry.id}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span aria-hidden>{getFileIcon(entry.originalName)}</span>
                          <div className="min-w-0">
                            <div className="truncate">{entry.originalName}</div>
                            {folderOf(entry.originalPath) && (
                              <div className="truncate text-xs text-gray-400">
                                {folderOf(entry.originalPath)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-right text-xs text-gray-500">
                        {formatDate(entry.deletedAt)}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleRestore(entry)}
                            disabled={busyKey === `restore:${entry.id}`}
                            aria-label="Restore"
                            title="Відновити"
                            className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
                          >
                            {busyKey === `restore:${entry.id}` ? "…" : "♻️"}
                          </button>
                          <button
                            onClick={() => setPendingPurge(entry)}
                            disabled={busyKey === `purge:${entry.id}`}
                            aria-label="Delete forever"
                            title="Видалити назавжди"
                            className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {busyKey === `purge:${entry.id}` ? "…" : "❌"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Видалити "${pendingDelete?.name ?? ""}"?`}
        description={
          pendingDelete?.type === "folder"
            ? "Папка і весь її вміст (усі вкладені файли та підпапки) переміститься в Кошик, звідки їх можна відновити."
            : "Файл переміститься в Кошик, звідки його можна відновити."
        }
        confirmLabel="Видалити"
        cancelLabel="Скасувати"
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
        title={`Видалити "${pendingPurge?.originalName ?? ""}" назавжди?`}
        description="Цю дію не можна скасувати — дані буде видалено з S3 остаточно."
        confirmLabel="Видалити назавжди"
        cancelLabel="Скасувати"
        danger
        busy={pendingPurge ? busyKey === `purge:${pendingPurge.id}` : false}
        onConfirm={confirmPurge}
        onCancel={() => setPendingPurge(null)}
      />

      <PreviewModal
        file={preview}
        onClose={() => setPreview(null)}
        onDownload={() => preview && handleDownload(preview.key)}
      />

      <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />
    </section>
  );
}
