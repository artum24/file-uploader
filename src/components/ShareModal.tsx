"use client";

import { useState } from "react";

export interface ShareTarget {
  key: string;
  name: string;
}

const DURATION_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 година", seconds: 60 * 60 },
  { label: "1 день", seconds: 24 * 60 * 60 },
  { label: "7 днів", seconds: 7 * 24 * 60 * 60 },
];

export function ShareModal({
  file,
  onClose,
}: {
  file: ShareTarget | null;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(DURATION_OPTIONS[1].seconds);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl(null);
    setExpiresAt(null);
    setError(null);
    setCopied(false);
  }

  async function handleGenerate() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/files/share-url?key=${encodeURIComponent(file.key)}&expiresIn=${seconds}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not create share link");
      }
      const data = (await res.json()) as { url: string; expiresAt: string };
      setUrl(data.url);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create share link");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Не вдалося скопіювати — виділіть посилання вручну");
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">Поділитись &quot;{file.name}&quot;</h3>
        <p className="mt-1 text-sm text-gray-500">
          Посилання дозволяє відкрити файл без входу в акаунт і саме стає недійсним
          після завершення терміну.
        </p>

        <div className="mt-3 flex gap-2">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.seconds}
              type="button"
              onClick={() => {
                setSeconds(option.seconds);
                reset();
              }}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition ${
                seconds === option.seconds
                  ? "border-black bg-black text-white"
                  : "hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {!url && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="mt-4 w-full rounded-md bg-black px-3 py-1.5 text-sm text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "…" : "Створити посилання"}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {url && (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(event) => event.target.select()}
                className="min-w-0 flex-1 rounded-md border bg-gray-50 px-2 py-1 text-xs text-gray-700"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md border px-3 py-1 text-sm transition hover:bg-gray-50"
              >
                {copied ? "Скопійовано" : "Копіювати"}
              </button>
            </div>
            {expiresAt && (
              <p className="mt-2 text-xs text-gray-400">
                Діє до {new Date(expiresAt).toLocaleString("uk-UA")}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border px-3 py-1.5 text-sm transition hover:bg-gray-50"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
