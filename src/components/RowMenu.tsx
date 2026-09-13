"use client";

import { useEffect, useRef, useState } from "react";

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  glyph: React.ReactNode;
}

export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={label}
        title={label}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-sand-400 transition hover:bg-sand-100 hover:text-sage-700"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-sand-100 bg-white py-1 shadow-overlay"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-sand-50 ${
                item.danger ? "text-brick-600" : "text-sand-700"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                {item.glyph}
              </svg>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
