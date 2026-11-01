"use client";

import { useState } from "react";
import { LogoImage } from "./logo-image";
import { lobeUrl } from "@/lib/lobe-logo";

const shown = 60;

/** Picks a logo shipped with the app: search by name, click a preview. Left empty, the other logo choices apply. */
export function LobeLogoPicker({ ids }: { ids: string[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = ids.filter((id) => !needle || id.includes(needle));
  return (
    <div className="lobe-picker">
      <span className="lobe-title">LobeHub logo</span>
      <p className="muted">
        The first choice. It wins over everything below, shows the right version on the light and the dark theme, and is not stored in the bucket.
      </p>
      <input type="hidden" name="lobeLogo" value={picked} />
      {picked ? (
        <div className="lobe-selected">
          <span className="lobe-preview">
            <LogoImage src={lobeUrl(picked)} width={40} height={40} />
          </span>
          <strong>{picked}</strong>
          <button type="button" className="button button-small" onClick={() => setPicked("")}>
            Remove
          </button>
        </div>
      ) : null}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search, for example openai, qwen or color"
        aria-label="Search LobeHub logos"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      <div className="lobe-grid" role="listbox" aria-label="LobeHub logos">
        {matches.slice(0, shown).map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={id === picked}
            className="lobe-option"
            title={id}
            onClick={() => setPicked(id)}
          >
            <span className="lobe-preview">
              <LogoImage src={lobeUrl(id)} width={32} height={32} lazy />
            </span>
            <span className="lobe-name">{id}</span>
          </button>
        ))}
      </div>
      {matches.length === 0 ? <p className="muted">No logo with that name.</p> : null}
      {matches.length > shown ? <p className="muted">{matches.length - shown} more. Type to narrow the list.</p> : null}
    </div>
  );
}
