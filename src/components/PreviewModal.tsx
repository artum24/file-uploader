"use client";

import { useEffect, useState } from "react";

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "svg", "bmp", "tiff"];
const VIDEO_EXT = ["mp4", "mov", "avi", "mkv", "webm"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "flac"];
const TEXT_EXT = ["txt", "csv"];

function getPreviewKind(name: string): PreviewKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (TEXT_EXT.includes(ext)) return "text";
  return "unsupported";
}

export interface PreviewTarget {
  key: string;
  name: string;
  url: string;
}

export function PreviewModal({
  file,
  onClose,
  onDownload,
}: {
  file: PreviewTarget | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  const kind = file ? getPreviewKind(file.name) : "unsupported";
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || kind !== "text") {
      setTextContent(null);
      setTextError(null);
      return;
    }
    let cancelled = false;
    setTextContent(null);
    setTextError(null);
    fetch(file.url)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load file");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 50_000));
      })
      .catch((err) => {
        if (!cancelled) {
          setTextError(err instanceof Error ? err.message : "Could not load file");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.url, kind]);

  useEffect(() => {
    if (!file) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, onClose]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
          <div className="flex shrink-0 items-center gap-3">
            <button onClick={onDownload} className="text-sm text-blue-600 hover:underline">
              Download
            </button>
            <button
              onClick={onClose}
              aria-label="Закрити"
              className="text-lg leading-none text-gray-400 hover:text-gray-900"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={file.name}
              className="mx-auto max-h-[75vh] max-w-full object-contain p-2"
            />
          )}

          {kind === "pdf" && (
            <iframe src={file.url} title={file.name} className="h-[75vh] w-full border-0" />
          )}

          {kind === "video" && (
            <div className="flex items-center justify-center p-2">
              <video src={file.url} controls className="max-h-[75vh] w-full" />
            </div>
          )}

          {kind === "audio" && (
            <div className="flex h-32 items-center justify-center p-4">
              <audio src={file.url} controls className="w-full max-w-md" />
            </div>
          )}

          {kind === "text" && (
            <>
              {textError && <p className="p-4 text-sm text-red-600">{textError}</p>}
              {!textError && textContent === null && (
                <p className="p-4 text-sm text-gray-400">Завантаження…</p>
              )}
              {!textError && textContent !== null && (
                <pre className="whitespace-pre-wrap break-words p-4 text-xs text-gray-800">
                  {textContent}
                </pre>
              )}
            </>
          )}

          {kind === "unsupported" && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <p>Перегляд для цього типу файлу не підтримується.</p>
              <button onClick={onDownload} className="text-blue-600 hover:underline">
                Завантажити файл
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
