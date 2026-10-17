"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import {
  facebookShareUrl,
  linkedInShareUrl,
  shareCardImagePath,
  shareFileName,
  sharePageUrl,
  shareTextForImage,
  type ShareCardTheme,
  xShareUrl,
} from "@/lib/share-card";

/** Share first. A computer opens the post menu. A phone opens that menu too, with By message first. Copy link and Download card sit beside Share. */
function browserTheme(): ShareCardTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function isPhone(): boolean {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function pulse(setOn: (value: boolean) => void, timers: { current: number[] }) {
  for (const id of timers.current) window.clearTimeout(id);
  timers.current = [];
  const frames = [
    [0, true],
    [120, false],
    [200, true],
    [320, false],
  ] as const;
  for (const [delay, on] of frames) {
    timers.current.push(window.setTimeout(() => setOn(on), delay));
  }
}

export function ShareActions({ gameId, text }: { gameId: string; text: string }) {
  const pageUrl = sharePageUrl(gameId);
  const fileName = shareFileName(gameId);
  const [theme, setTheme] = useState<ShareCardTheme>("light");
  const downloadUrl = shareCardImagePath(gameId, theme, true);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadFlash, setDownloadFlash] = useState(false);
  const [shortDownload, setShortDownload] = useState(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const copiedTimers = useRef<number[]>([]);
  const downloadTimers = useRef<number[]>([]);
  const savingTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => setTheme(browserTheme());
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const link = downloadRef.current;
    if (!link) return;
    const narrow = window.matchMedia("(max-width: 560px)");
    const apply = () => setShortDownload(narrow.matches && !downloadCardFits(link));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(link);
    narrow.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      narrow.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const id of copiedTimers.current) window.clearTimeout(id);
      for (const id of downloadTimers.current) window.clearTimeout(id);
      if (savingTimer.current) window.clearTimeout(savingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onPhoneShare() {
    setOpen(false);
    setNote(null);
    try {
      const response = await fetch(shareCardImagePath(gameId, browserTheme()));
      if (!response.ok) {
        setNote("Try again.");
        return;
      }
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (!navigator.share) {
        setNote("Try again.");
        return;
      }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareTextForImage(text, pageUrl) });
        return;
      }
      await navigator.share({ text });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote("Try again.");
    }
  }

  const message = text;
  const postTip = "This opens the post. Paste the message.";

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setNote("The message could not be copied.");
    }
  }

  function onNetworkClick(event: MouseEvent<HTMLAnchorElement>, copy: boolean) {
    setOpen(false);
    if (!copy) return;
    void copyMessage();
    if (!isPhone()) return;
    event.preventDefault();
    window.open(event.currentTarget.href, "_blank", "noopener,noreferrer");
  }

  function flashCopy() {
    setNote(null);
    pulse(setCopied, copiedTimers);
  }

  function savingFits(link: HTMLElement): boolean {
    const word = link.querySelector(".share-download-word");
    if (!(word instanceof HTMLElement)) return false;
    const probe = word.cloneNode(false) as HTMLElement;
    probe.textContent = "Saving…";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "nowrap";
    link.appendChild(probe);
    const fits = probe.offsetWidth <= word.offsetWidth;
    probe.remove();
    return fits;
  }

  function onDownloadClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPhone()) return;
    if (savingFits(event.currentTarget)) {
      setSaving(true);
      if (savingTimer.current) window.clearTimeout(savingTimer.current);
      savingTimer.current = window.setTimeout(() => setSaving(false), 800);
      return;
    }
    pulse(setDownloadFlash, downloadTimers);
  }

  async function copyLink() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(pageUrl);
      if (isPhone()) return;
      flashCopy();
    } catch {
      setCopied(false);
      setNote("The link could not be copied.");
    }
  }

  const networks = [
    { name: "X", href: xShareUrl(pageUrl, text), mark: <XMark />, tip: null, copy: false },
    { name: "LinkedIn", href: linkedInShareUrl(pageUrl), mark: <LinkedInMark />, tip: postTip, copy: true },
    { name: "Facebook", href: facebookShareUrl(pageUrl, text), mark: <FacebookMark />, tip: postTip, copy: true },
  ];

  return (
    <div className="share-actions" ref={rootRef}>
      <div className="share-row">
      <span className="share-desktop">
        <button
          className="button"
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => {
            setNote(null);
            setOpen((value) => !value);
          }}
        >
          Share
          <svg className="share-caret" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="currentColor" d="M3.2 6.2 8 11l4.8-4.8 1.2 1.2L8 13.4 2 7.4z" />
          </svg>
        </button>
        <div className="menu share-network-menu" id={menuId} role="menu" hidden={!open}>
          <button className="menu-item share-message" type="button" role="menuitem" onClick={() => void onPhoneShare()}>
            <MessageMark />
            By message
          </button>
          {networks.map((network) => (
            <a
              key={network.name}
              role="menuitem"
              href={network.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => onNetworkClick(event, network.copy)}
            >
              {network.mark}
              {network.name}
              {network.tip ? <span className="share-tip">{network.tip}</span> : null}
            </a>
          ))}
        </div>
      </span>
      <button className={`button-quiet share-copy${copied ? " is-copied" : ""}`} type="button" onClick={() => void copyLink()}>
        Copy link
      </button>
      <a
        ref={downloadRef}
        className={`button-quiet share-download${downloadFlash ? " is-flash" : ""}${shortDownload ? " is-short" : ""}`}
        href={downloadUrl}
        download={fileName}
        aria-label={saving ? "Saving…" : "Download card"}
        aria-busy={saving || undefined}
        onClick={onDownloadClick}
      >
        <span className="share-download-word">
          {saving ? "Saving…" : <>Download<span className="share-download-extra"> card</span></>}
        </span>
      </a>
      </div>
      <span className="share-live" role="status">{copied ? "The link is copied." : ""}</span>
      {note ? <p className={`share-note${note === "Try again." ? " is-error" : ""}`}>{note}</p> : null}
    </div>
  );
}

function downloadCardFits(link: HTMLElement): boolean {
  const word = link.querySelector(".share-download-word");
  if (!(word instanceof HTMLElement)) return true;
  const probe = document.createElement("span");
  probe.textContent = "Download card";
  const font = getComputedStyle(word).font;
  probe.style.font = font;
  probe.style.whiteSpace = "nowrap";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  link.appendChild(probe);
  const box = getComputedStyle(link);
  const pad = Number.parseFloat(box.paddingLeft) + Number.parseFloat(box.paddingRight);
  const fits = probe.offsetWidth <= link.clientWidth - pad;
  probe.remove();
  return fits;
}

function MessageMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
