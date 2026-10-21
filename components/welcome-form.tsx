"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avatarError, avatarFileError, cleanUsername } from "@/lib/profile";

export function WelcomeForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = cleanUsername(username);
    if (!name) {
      setError("3 to 20 characters.");
      return;
    }
    setBusy(true);
    setError("");
    if (file) {
      const pictureError = avatarFileError(file);
      if (pictureError) {
        setBusy(false);
        setError(pictureError);
        return;
      }
      const body = new FormData();
      body.set("avatar", file);
      const uploaded = await fetch("/api/me/avatar", { method: "POST", body }).catch(() => null);
      if (!uploaded?.ok) {
        setBusy(false);
        setError(avatarError);
        return;
      }
    }
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    }).catch(() => null);
    setBusy(false);
    if (!response) {
      setError("Try again.");
      return;
    }
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
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next);
            setError(next ? (avatarFileError(next) ?? "") : "");
          }}
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
