"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { avatarError, avatarFileError } from "@/lib/profile";
import { Avatar } from "./avatar";
import { ChangePasswordForm } from "./change-password-form";

export function ProfileForm({
  username,
  avatarUrl,
  userId,
  canChangePassword = false,
}: {
  username: string;
  avatarUrl: string | null;
  userId: string;
  canChangePassword?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pictureButtonRef = useRef<HTMLButtonElement>(null);
  const pictureId = useId();
  const [name, setName] = useState(username);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (file && avatarFileError(file)) {
      setBusy(false);
      setError(avatarError);
      return;
    }
    let response: Response;
    try {
      response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
    } catch {
      setBusy(false);
      setError("Try again.");
      return;
    }
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
      const uploaded = await fetch("/api/me/avatar", { method: "POST", body }).catch(() => null);
      if (!uploaded?.ok) {
        setBusy(false);
        setError(avatarError);
        router.refresh();
        return;
      }
    }
    setBusy(false);
    setFile(null);
    setFileKey((value) => value + 1);
    router.refresh();
  }

  const pictureButton = file || avatarUrl ? "Change picture" : "Choose picture";

  return (
    <>
      <form className="card profile-form" onSubmit={submit}>
        <div className="profile-photo-row">
          <div className="profile-picture">
            <Avatar seed={userId} src={avatarUrl} size={72} />
          </div>
          <div className="profile-photo">
            <label htmlFor={pictureId} className="profile-photo-name">
              Picture
              <span className="muted">Optional</span>
            </label>
            <button
              ref={pictureButtonRef}
              type="button"
              className="button-quiet profile-file"
              onClick={() => fileRef.current?.click()}
            >
              {pictureButton}
            </button>
            <input
              id={pictureId}
              key={fileKey}
              ref={fileRef}
              className="profile-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              tabIndex={-1}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setError(next ? (avatarFileError(next) ?? "") : "");
                pictureButtonRef.current?.focus();
              }}
            />
          </div>
        </div>
        <label className="profile-name">
          Username
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" />
        </label>
        {canChangePassword ? (
          <button
            type="button"
            className="button-danger profile-password"
            aria-expanded={passwordOpen}
            aria-controls="change-password-card"
            onClick={() => setPasswordOpen((open) => !open)}
          >
            Change password
          </button>
        ) : null}
        <div className="profile-save">
          <button type="submit" className="button" disabled={busy}>
            Save
          </button>
        </div>
        {file || error ? (
          <div className="profile-status">
            {file ? <span className="profile-file-name muted">{file.name}</span> : null}
            {error ? <p className="error">{error}</p> : null}
          </div>
        ) : null}
      </form>
      {passwordOpen ? (
        <ChangePasswordForm
          onCancel={() => setPasswordOpen(false)}
          onChanged={() => {
            setPasswordOpen(false);
            setError("");
          }}
        />
      ) : null}
    </>
  );
}
