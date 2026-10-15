import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { nextProviderSort, sortProviderRows, type ProviderTableRow } from "./provider-table";

const root = path.resolve(import.meta.dirname, "..");

function row(partial: Partial<ProviderTableRow> & Pick<ProviderTableRow, "slug">): ProviderTableRow {
  return {
    model: null,
    updatedAt: "2026-10-14T20:00:00.000Z",
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cachedTokens: null,
    gptTokens: null,
    reason: null,
    ...partial,
  };
}

test("a provider column cycles through ascending, descending, and the original order", () => {
  assert.deepEqual(nextProviderSort(null, "gap"), { column: "gap", dir: "asc" });
  assert.deepEqual(nextProviderSort({ column: "gap", dir: "asc" }, "gap"), { column: "gap", dir: "desc" });
  assert.equal(nextProviderSort({ column: "gap", dir: "desc" }, "gap"), null);
  assert.deepEqual(nextProviderSort({ column: "gap", dir: "desc" }, "output"), { column: "output", dir: "asc" });
});

test("sorting uses visible output and restores the loaded order", () => {
  const rows = [
    row({ slug: "amazon-bedrock", model: "anthropic/claude-haiku-4.5", outputTokens: 450, reasoningTokens: 153, gptTokens: 254 }),
    row({ slug: "chutes", model: "qwen/qwen3-8b", outputTokens: 100, reasoningTokens: 0, gptTokens: 100, reason: "over" }),
    row({ slug: "azure", outputTokens: 80, reasoningTokens: 0, gptTokens: null }),
  ];
  assert.deepEqual(sortProviderRows(rows, null).map((item) => item.slug), ["amazon-bedrock", "chutes", "azure"]);
  assert.deepEqual(sortProviderRows(rows, { column: "output", dir: "asc" }).map((item) => item.slug), ["azure", "chutes", "amazon-bedrock"]);
  assert.deepEqual(sortProviderRows(rows, { column: "gap", dir: "asc" }).map((item) => item.slug), ["chutes", "amazon-bedrock", "azure"]);
  assert.deepEqual(sortProviderRows(rows, { column: "gap", dir: "desc" }).map((item) => item.slug), ["azure", "amazon-bedrock", "chutes"]);
  assert.deepEqual(sortProviderRows(rows, { column: "provider", dir: "asc" }).map((item) => item.slug), ["amazon-bedrock", "azure", "chutes"]);
});

test("the provider table sorts and pages in place", () => {
  const source = fs.readFileSync(path.join(root, "components/provider-table.tsx"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/admin/providers/page.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(source, /output: "Output",\s*gpt: "gpt-tokenizer",\s*gap: "Gap"/);
  assert.match(source, /formatOutputGap/);
  assert.match(source, /visibleOutput/);
  assert.match(source, /ProviderReason/);
  assert.match(source, /action=\{clearProvider\}/);
  assert.match(source, /Deblacklist/);
  assert.match(source, /className="roster-sort"/);
  assert.match(source, /setPage\(list\.page - 1\)/);
  assert.match(source, /setPage\(list\.page \+ 1\)/);
  assert.match(source, /setPage\(1\)/);
  assert.doesNotMatch(source, /router\.|location\.href|window\.location/);
  assert.match(page, /<ProviderTable/);
  assert.match(css, /\.roster\.providers \{ width: 100%; min-width: 0; \}/);
  assert.match(css, /\.providers-page \.roster-card \{ overflow-x: visible; \}/);
});
