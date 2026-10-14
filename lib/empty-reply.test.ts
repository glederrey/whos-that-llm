import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isEmptyModelReply } from "./empty-reply";

const root = path.resolve(import.meta.dirname, "..");

test("a model reply is empty when it has no visible text", () => {
  assert.equal(isEmptyModelReply(""), true);
  assert.equal(isEmptyModelReply(" "), true);
  assert.equal(isEmptyModelReply("\n\t"), true);
  assert.equal(isEmptyModelReply(" \n \t "), true);
  assert.equal(isEmptyModelReply("\u00a0"), true);
  assert.equal(isEmptyModelReply("Hello"), false);
  assert.equal(isEmptyModelReply(" Hello "), false);
  assert.equal(isEmptyModelReply("0"), false);
  assert.equal(isEmptyModelReply("."), false);
});

test("play shows Empty message for a blank model reply only", () => {
  const reply = fs.readFileSync(path.join(root, "components/markdown-message.tsx"), "utf8");
  const board = fs.readFileSync(path.join(root, "components/round-board.tsx"), "utf8");
  const result = fs.readFileSync(path.join(root, "app/play/[gameId]/result/page.tsx"), "utf8");
  assert.match(reply, /if \(isEmptyModelReply\(text\)\) return <span className="empty-message">Empty message<\/span>/);
  assert.match(board, /message\.role === "assistant" \? <ModelReply text=\{message\.content\} \/> : message\.content/);
  assert.match(result, /message\.role === "assistant" \? <ModelReply text=\{message\.content\} \/> : message\.content/);
  assert.match(board, /liveAssistant === ""/);
  assert.match(board, /<ModelReply text=\{liveAssistant\} \/>/);
  assert.equal(board.includes("<ModelReply text={liveUser}"), false);
  assert.equal(result.includes("Empty message"), false);
});

function channel(hex: string, shift: number) {
  const value = (Number.parseInt(hex.slice(1), 16) >> shift) & 255;
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0);
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function block(css: string, selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf("}", start));
}

function color(blockText: string, name: string) {
  const found = blockText.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(found, name);
  return found[1].toLowerCase();
}

test("empty message gray is light in the dark theme and readable on the bubble", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.empty-message \{ color: var\(--mute\); \}/);
  const light = block(css, ":root {");
  const dark = block(css, 'html[data-theme="dark"] {');
  const lightText = color(light, "--mute");
  const lightBubble = color(light, "--card");
  const darkText = color(dark, "--mute");
  const darkBubble = color(dark, "--card");
  assert.ok(contrast(lightText, lightBubble) >= 4.5);
  assert.ok(luminance(lightText) < luminance(lightBubble));
  assert.ok(contrast(darkText, darkBubble) >= 4.5);
  assert.ok(luminance(darkText) > luminance(darkBubble));
  const darkRgb = Number.parseInt(darkText.slice(1), 16);
  const red = (darkRgb >> 16) & 255;
  const green = (darkRgb >> 8) & 255;
  const blue = darkRgb & 255;
  assert.ok(Math.max(red, green, blue) - Math.min(red, green, blue) <= 16);
  assert.ok(red >= 150 && green >= 150 && blue >= 150);
});
