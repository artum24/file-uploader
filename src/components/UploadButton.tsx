"use client";

import { useRef, useState } from "react";
import {
  MAX_UPLOAD_SIZE_BYTES,
  formatBytes,
  isAllowedExtension,
} from "@/lib/upload-limits";

type Status = "idle" | "uploading" | "done" | "error";

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const text = xhr.responseText || "";
      const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
      const message = text.match(/<Message>(.*?)<\/Message>/)?.[1];
      reject(
        new Error(
          `S3 upload failed (${xhr.status}${code ? ` ${code}` : ""}): ${
            message ?? text.slice(0, 300) ?? "unknown error"
          }`
        )
      );
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadButton({
  scope,
  folder,
  label,
  size = "sm",
  onUploaded,
  onProgress,
}: {
  scope: "personal" | "shared";
  /** Current folder path within the scope, e.g. "Documents/2026". Omit for the root. */
  folder?: string;
  label: string;
  /** "sm" — compact header button. "lg" — larger empty-state button. */
  size?: "sm" | "lg";
  onUploaded?: () => void;
  /** Reports upload progress to a parent that wants to render its own indicator. */
  onProgress?: (state: { name: string; percent: number } | null) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    if (!isAllowedExtension(file.name)) {
      setErrorMessage(`This file type isn't allowed: ${file.name}`);
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMessage(
        `File is ${formatBytes(file.size)}, which is over the ${formatBytes(
          MAX_UPLOAD_SIZE_BYTES
        )} limit`
      );
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setStatus("uploading");
    onProgress?.({ name: file.name, percent: 0 });

    try {
      const presignRes = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          scope,
          folder,
        }),
      });

      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not prepare upload");
      }

      const { url } = (await presignRes.json()) as { url: string };

      await uploadWithProgress(url, file, (percent) =>
        onProgress?.({ name: file.name, percent })
      );

      setStatus("done");
      onUploaded?.();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setStatus("error");
    } finally {
      onProgress?.(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const sizeClasses =
    size === "lg"
      ? "h-12 gap-2 rounded-2xl px-[22px] text-[15.5px] font-semibold"
      : "h-9 gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold";

  return (
    <div className="flex flex-col items-center gap-1">
      <label
        className={`flex cursor-pointer items-center whitespace-nowrap bg-sage-600 text-white shadow-button transition hover:bg-sage-700 ${sizeClasses} ${
          status === "uploading" ? "opacity-60" : ""
        }`}
      >
        <svg
          width={size === "lg" ? 18 : 15}
          height={size === "lg" ? 18 : 15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
        >
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {status === "uploading" ? "Uploading…" : label}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={status === "uploading"}
        />
      </label>
      {status === "error" && (
        <span className="max-w-[16rem] break-words text-center text-xs text-brick-600">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
