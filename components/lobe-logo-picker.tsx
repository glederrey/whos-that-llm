"use client";

import { useState } from "react";
import { lobeUrl } from "@/lib/lobe-logo";

/** Picks a logo shipped with the app by icon id. Left empty, the other logo choices apply. */
export function LobeLogoPicker({ ids }: { ids: string[] }) {
  const [value, setValue] = useState("");
  const id = value.trim().toLowerCase();
  const known = ids.includes(id);
  return (
    <label>
      Or pick a LobeHub logo by name, for example openai or qwen-color. It wins over the choices above and is not stored in the bucket.
      <span className="lobe-pick">
        <input
          name="lobeLogo"
          list="lobe-logo-ids"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {known ? <img src={lobeUrl(id)} alt="" width={32} height={32} /> : null}
      </span>
      {id && !known ? <small>No logo with that name.</small> : null}
      <datalist id="lobe-logo-ids">
        {ids.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </label>
  );
}
