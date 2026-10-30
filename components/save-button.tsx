"use client";

import { useFormStatus } from "react-dom";

/** Submit button that shows a spinner and stays disabled while its form action runs. */
export function SaveButton({ children = "Save" }: { children?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending ? "Saving…" : children}
    </button>
  );
}
