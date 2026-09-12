"use client";

import { useState } from "react";

export interface ShareTarget {
  key: string;
  name: string;
}

const DURATION_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
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
      setError("Couldn't copy — select the link manually");
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-t-[26px] bg-white px-5 pb-7 pt-2.5 shadow-sheet sm:rounded-[24px] sm:pb-6 sm:pt-6 sm:shadow-overlay"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-full bg-sand-200 sm:hidden" />

        <h3 className="text-[19px] font-semibold tracking-tight text-sand-900">Share link</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-sand-500">
          Anyone with this link can open{" "}
          <strong className="font-semibold text-sand-800">{file.name}</strong> without signing in.
          It stops working when it expires.
        </p>

        <div className="mb-2 mt-[18px] text-[12px] font-semibold uppercase tracking-wide text-sand-400">
          Expires in
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.seconds}
              type="button"
              onClick={() => {
                setSeconds(option.seconds);
                reset();
              }}
              className={`grid h-[46px] place-items-center rounded-[14px] border text-[14.5px] transition ${
                seconds === option.seconds
                  ? "border-sage-600 bg-sage-600 font-semibold text-white"
                  : "border-sand-200 text-sand-700 hover:bg-sand-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-brick-600">{error}</p>}

        {!url && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="mt-[18px] h-[52px] w-full rounded-2xl bg-sage-600 text-[16px] font-semibold text-white shadow-button transition hover:bg-sage-700 disabled:opacity-50"
          >
            {busy ? "…" : "Create link"}
          </button>
        )}

        {url && (
          <>
            <div className="mt-[18px] flex flex-col gap-2.5 rounded-2xl border border-sand-100 bg-sand-50 p-3.5">
              <div className="break-all text-[12.5px] leading-snug text-sand-600">{url}</div>
              {expiresAt && (
                <div className="flex items-center gap-2 text-[12px] text-sand-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  Valid until {new Date(expiresAt).toLocaleString("en-GB")}
                </div>
              )}
            </div>

            <div className="mt-[18px] flex gap-2.5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-sage-600 text-[16px] font-semibold text-white shadow-button transition hover:bg-sage-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="h-[52px] w-24 rounded-2xl border border-sand-200 text-[15px] font-medium text-sand-700 transition hover:bg-sand-50"
              >
                Close
              </button>
            </div>
          </>
        )}

        {!url && (
          <button
            type="button"
            onClick={handleClose}
            className="mt-3 flex h-11 w-full items-center justify-center text-[14px] font-medium text-sand-500 transition hover:text-sand-700"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
