"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./avatar";

export function ProfileForm({
  username,
  avatarUrl,
  userId,
}: {
  username: string;
  avatarUrl: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(username);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    if (response.status === 401) {
      router.push("/login?next=/profile");
      return;
    }
    if (!response.ok) {
      setBusy(false);
      setError("3 to 20 characters.");
      return;
    }
    if (file) {
      const body = new FormData();
      body.set("avatar", file);
      const uploaded = await fetch("/api/me/avatar", { method: "POST", body });
      if (!uploaded.ok) {
        setBusy(false);
        setError("Use a JPEG, PNG, WebP, or GIF under 2 MB.");
        router.refresh();
        return;
      }
    }
    setBusy(false);
    setFile(null);
    setFileKey((value) => value + 1);
    setNote("Saved.");
    router.refresh();
  }

  return (
    <form className="card profile-form" onSubmit={submit}>
      <div className="profile-picture">
        <Avatar seed={userId} src={avatarUrl} size={72} />
      </div>
      <div className="stack">
        <label>
          Username
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" />
        </label>
        <p className="muted">Capitals and punctuation are allowed. The name does not have to be unique. An empty name is rejected.</p>
        <label>
          Picture
          <input
            key={fileKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className="muted">Optional. Until you upload one, the generated mark stays.</p>
        <button type="submit" className="button" disabled={busy}>
          Save
        </button>
        {note ? <p className="muted">{note}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </form>
  );
}
