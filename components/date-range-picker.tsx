"use client";

import { useEffect, useRef, useState } from "react";

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function dayKey(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthOf(day: string | undefined) {
  const date = day ? new Date(`${day}T00:00:00Z`) : new Date();
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function shortDay(day: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** One button that opens a month calendar. Two clicks pick the first and the last day, and the range applies on the second. */
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(from));
  const [start, setStart] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      } else if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index) => dayKey(view.year, view.month, index + 1)),
  ];
  const title = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  function step(by: number) {
    const next = new Date(Date.UTC(view.year, view.month + by, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function pick(day: string) {
    if (start === null) {
      setStart(day);
      return;
    }
    const [low, high] = day < start ? [day, start] : [start, day];
    setStart(null);
    setOpen(false);
    onChange(low, high);
  }

  const label = from && to ? (from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`) : "All dates";

  return (
    <div className="range-picker" ref={root}>
      <button
        type="button"
        className="range-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setStart(null);
          setView(monthOf(from));
          setOpen(!open);
        }}
      >
        <span>{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v3 M17 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
      {open ? (
        <div className="range-pop" role="dialog" aria-label="Choose dates">
          <div className="range-head">
            <button type="button" className="range-step" aria-label="Previous month" onClick={() => step(-1)}>
              ‹
            </button>
            <strong>{title}</strong>
            <button type="button" className="range-step" aria-label="Next month" onClick={() => step(1)}>
              ›
            </button>
          </div>
          <div className="range-grid">
            {weekdays.map((name) => (
              <span key={name} className="range-weekday">
                {name}
              </span>
            ))}
            {cells.map((day, index) => {
              if (!day) return <span key={`gap-${index}`} />;
              const edge = start ? day === start : day === from || day === to;
              const inside = !start && from && to && day > from && day < to;
              return (
                <button
                  key={day}
                  type="button"
                  className="range-day"
                  data-edge={edge ? "true" : undefined}
                  data-inside={inside ? "true" : undefined}
                  aria-label={shortDay(day)}
                  aria-pressed={edge}
                  onClick={() => pick(day)}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="range-foot">
            <span className="muted">{start ? "Pick the last day" : "Pick the first day"}</span>
            {from || to ? (
              <button
                type="button"
                className="range-clear"
                onClick={() => {
                  setStart(null);
                  setOpen(false);
                  onChange(undefined, undefined);
                }}
              >
                Clear dates
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
