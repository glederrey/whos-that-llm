"use client";

import { useEffect, useRef, useState } from "react";

// The emoji text input of the category icon picker, plus a button that opens a
// searchable grid. The picker is loaded on first open, in the browser only, and
// reads its data from /emoji-data (see scripts/copy-emoji-data.mjs), not a CDN.
export function EmojiPickerField({ defaultValue }: { defaultValue: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const wrap = wrapRef.current;
    const host = hostRef.current;
    if (!wrap || !host) return;
    let picker: HTMLElement | null = null;
    let cancelled = false;

    const choose = (event: Event) => {
      const input = inputRef.current;
      if (!input) return;
      input.value = (event as CustomEvent<{ unicode?: string }>).detail.unicode ?? "";
      wrap.closest(".icon-picker-option")?.querySelector<HTMLInputElement>('input[type="radio"]')?.click();
      setOpen(false);
      input.focus();
    };
    import("emoji-picker-element").then(({ Picker }) => {
      if (cancelled) return;
      picker = new Picker({ dataSource: "/emoji-data/en.json", locale: "en" });
      picker.classList.add("emoji-picker");
      picker.addEventListener("emoji-click", choose);
      host.append(picker);
      picker.shadowRoot?.querySelector<HTMLInputElement>("input.search")?.focus();
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      wrap.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      picker?.remove();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="emoji-field" ref={wrapRef}>
      <input ref={inputRef} type="text" name="emoji" aria-label="Emoji" defaultValue={defaultValue} size={4} />
      <button type="button" className="button-quiet" aria-label="Pick an emoji" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Pick
      </button>
      {open ? <div className="emoji-popover" ref={hostRef} /> : null}
    </div>
  );
}
