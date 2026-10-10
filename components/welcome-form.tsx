"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WelcomeForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("Human");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (file) {
      const body = new FormData();
      body.set("avatar", file);
      const uploaded = await fetch("/api/me/avatar", { method: "POST", body });
      if (!uploaded.ok) {
        setBusy(false);
        setError("Use a JPEG, PNG, WebP, or GIF under 2 MB.");
        return;
      }
    }
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setBusy(false);
    if (response.status === 401) {
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!response.ok) {
      setError("3 to 20 characters.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Pick a username.</h1>
      <label>
        Username
        <input
          value={username}
          placeholder="Human"
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="nickname"
        />
      </label>
      <label>
        Picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="muted">Optional. Skip it and add one later from your profile.</p>
      <button type="submit" className="button" disabled={busy}>
        Save
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
