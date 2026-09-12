"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/upload-limits";

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
  size?: number;
}

export function PreviewModal({
  file,
  onClose,
  onDownload,
  onShare,
}: {
  file: PreviewTarget | null;
  onClose: () => void;
  onDownload: () => void;
  onShare?: () => void;
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

  const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
  const meta = file.size ? `${formatBytes(file.size)} · ${ext}` : ext;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-sand-950">
      <div
        className="flex items-center justify-between gap-2.5 px-2.5 py-2.5 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/12 transition hover:bg-white/20"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[14px] font-medium">{file.name}</p>
          {meta && <p className="truncate text-[12px] text-white/60">{meta}</p>}
        </div>
        <button
          onClick={onDownload}
          aria-label="Download"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/12 transition hover:bg-white/20"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M12 4v12" />
            <path d="M7 11l5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto px-3 py-2"
        onClick={onClose}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-full w-full items-center justify-center"
        >
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={file.name}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
          )}

          {kind === "pdf" && (
            <iframe
              src={file.url}
              title={file.name}
              className="h-[75vh] w-full max-w-4xl rounded-lg border-0 bg-white"
            />
          )}

          {kind === "video" && (
            <video
              src={file.url}
              controls
              className="max-h-[75vh] w-full max-w-3xl rounded-lg"
            />
          )}

          {kind === "audio" && (
            <div className="w-full max-w-md rounded-xl bg-white p-6">
              <audio src={file.url} controls className="w-full" />
            </div>
          )}

          {kind === "text" && (
            <div className="max-h-[75vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4">
              {textError && <p className="text-sm text-brick-600">{textError}</p>}
              {!textError && textContent === null && (
                <p className="text-sm text-sand-400">Loading…</p>
              )}
              {!textError && textContent !== null && (
                <pre className="whitespace-pre-wrap break-words text-xs text-sand-800">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {kind === "unsupported" && (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-10 text-center text-sm text-sand-600">
              <p>Preview isn&apos;t supported for this file type.</p>
              <button
                onClick={onDownload}
                className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sage-700"
              >
                Download file
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-2.5 px-4 py-4"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onDownload}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15.5px] font-semibold text-sand-900 transition hover:bg-sand-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M12 4v12" />
            <path d="M7 11l5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
          Download
        </button>
        {onShare && (
          <button
            onClick={onShare}
            aria-label="Share"
            className="grid h-[50px] w-16 shrink-0 place-items-center rounded-2xl bg-white/14 text-white transition hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
              <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
              <path d="M8 12h8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
