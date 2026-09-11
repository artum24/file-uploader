"use client";

import { useRef, useState } from "react";
import {
  MAX_UPLOAD_SIZE_BYTES,
  formatBytes,
  isAllowedExtension,
} from "@/lib/upload-limits";

type Status = "idle" | "uploading" | "done" | "error";

export function UploadButton({
  scope,
  folder,
  label,
  onUploaded,
}: {
  scope: "personal" | "shared";
  /** Current folder path within the scope, e.g. "Documents/2026". Omit for the root. */
  folder?: string;
  label: string;
  onUploaded?: () => void;
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

      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
        const message = text.match(/<Message>(.*?)<\/Message>/)?.[1];
        throw new Error(
          `S3 upload failed (${putRes.status}${code ? ` ${code}` : ""}): ${
            message ?? text.slice(0, 300) ?? "unknown error"
          }`
        );
      }

      setStatus("done");
      onUploaded?.();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <label className="cursor-pointer whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition hover:bg-gray-50">
        {status === "uploading" ? "Uploading…" : label}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={status === "uploading"}
        />
      </label>
      {status === "done" && (
        <span className="text-xs text-green-600">Uploaded</span>
      )}
      {status === "error" && (
        <span className="max-w-[16rem] break-words text-center text-xs text-red-600">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
