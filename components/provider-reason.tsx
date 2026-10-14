"use client";

import { useRef } from "react";

export function ProviderReason({ reason }: { reason: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="button-quiet" onClick={() => dialogRef.current?.showModal()}>
        Why
      </button>
      <dialog ref={dialogRef} className="dialog provider-log">
        <h2>Why</h2>
        <pre className="provider-reason">{reason}</pre>
        <div className="row">
          <button type="button" className="button-quiet" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
