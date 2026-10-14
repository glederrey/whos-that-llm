"use client";

export function ChatComposer({
  draft,
  onDraft,
  onSend,
  disabled,
  limit,
  notice,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  limit?: number;
  notice?: string;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="composer">
      <textarea
        value={draft}
        placeholder="Ask something"
        maxLength={limit}
        disabled={disabled}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="meta">
        <span>{limit !== undefined ? `${draft.length} / ${limit}` : ""}</span>
        <button type="button" className="button" disabled={disabled || !draft.trim()} onClick={onSend}>
          Send
        </button>
      </div>
      {notice ? <p className="error">{notice}</p> : null}
    </div>
  );
}
