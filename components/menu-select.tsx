"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type MenuOption = { value: string; label: string };

/** A dropdown that looks like the date picker. A native `<select>` list cannot be styled, so this draws its own. */
export function MenuSelect({ value, options, onChange }: { value: string; options: MenuOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useId();
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function show() {
    setActive(selected);
    setOpen(true);
  }

  function choose(index: number) {
    setOpen(false);
    onChange(options[index].value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show();
      setActive((current) => Math.min(options.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="range-picker" ref={root}>
      <button
        type="button"
        className="range-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={list}
        aria-activedescendant={open ? `${list}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span>{options[selected]?.label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" data-open={open ? "true" : undefined}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul id={list} className="range-pop menu-pop" role="listbox">
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${list}-${index}`}
              role="option"
              aria-selected={index === selected}
              data-active={index === active ? "true" : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
