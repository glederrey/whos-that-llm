"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { filterCategories } from "@/lib/category-filter";
import type { CategoryIconData } from "@/lib/category-icon";
import { difficultyAside, unfinishedLine } from "@/lib/lobby-row";

export type LobbyCategory = {
  id: string;
  name: string;
  description: string;
  icon: CategoryIconData | null;
  models: number;
};

export function CategoryCombobox({
  categories,
  openIds,
  disabled,
  onPick,
}: {
  categories: LobbyCategory[];
  openIds: readonly string[];
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const base = useId();
  const listId = `${base}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shown = useMemo(() => filterCategories(categories, query), [categories, query]);
  const current = Math.min(active, Math.max(0, shown.length - 1));

  function choose(id: string) {
    setOpen(false);
    setQuery("");
    onPick(id);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((current + 1) % Math.max(1, shown.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((current - 1 + shown.length) % Math.max(1, shown.length));
    } else if (event.key === "Enter") {
      if (open && shown[current]) {
        event.preventDefault();
        choose(shown[current].id);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div className="category-combo">
      <input
        ref={input}
        className="category-combo-input"
        type="text"
        role="combobox"
        aria-label="Search categories"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[current] ? `${base}-${shown[current].id}` : undefined}
        autoComplete="off"
        placeholder="Search categories"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <ul id={listId} role="listbox" aria-label="Categories" className="category-combo-list">
          {shown.length === 0 ? (
            <li className="category-combo-empty muted" role="presentation">
              {categories.length === 0 ? "No category has enough models yet." : "No category matches."}
            </li>
          ) : (
            shown.map((item, index) => (
              <li
                key={item.id}
                id={`${base}-${item.id}`}
                role="option"
                aria-selected={index === current}
                className="category-combo-option"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item.id)}
              >
                <CategoryIcon icon={item.icon} />
                <span className="category-combo-text">
                  <strong>{item.name}</strong>
                  {item.description ? <span className="muted">{item.description}</span> : null}
                </span>
                <span className="category-combo-count muted">
                  {openIds.includes(item.id) ? unfinishedLine : difficultyAside(item.models, false)}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
