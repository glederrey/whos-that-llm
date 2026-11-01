import assert from "node:assert/strict";
import test from "node:test";
import { isLobePath, lobeIdOf, lobeIdOfAny, lobePath, lobeSvgForTheme, lobeThemeUrl, lobeUrl } from "./lobe-logo";
import { chooseLogoPath, logoPathForPlay, logoPublicUrl } from "./logos";

test("lobe paths round trip and reject bad ids", () => {
  assert.equal(lobeIdOf(lobePath("qwen-color")), "qwen-color");
  assert.equal(isLobePath("lobe:openai"), true);
  assert.equal(lobeIdOf("lobe:../x"), null);
  assert.equal(lobeIdOf("lobe:"), null);
  assert.equal(lobeIdOf("logos/companies/a.png"), null);
  assert.equal(lobeUrl("openai"), "/lobe/openai.svg");
});

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;

test("currentColor takes the theme text colour", () => {
  const mono = svg('<path fill="currentColor" d="M0 0h1v1z"/>');
  assert.match(lobeSvgForTheme(mono, "light"), /fill="#111111"/);
  assert.match(lobeSvgForTheme(mono, "dark"), /fill="#f5f5f5"/);
});

test("a black logo flips on dark and a white logo flips on light", () => {
  const black = svg('<path fill="#000" d="M0 0h1v1z"/>');
  const white = svg('<path fill="#fff" d="M0 0h1v1z"/>');
  assert.match(lobeSvgForTheme(black, "dark"), /fill="#ffffff"/);
  assert.match(lobeSvgForTheme(black, "light"), /fill="#000"/);
  assert.match(lobeSvgForTheme(white, "light"), /fill="#000000"/);
  assert.match(lobeSvgForTheme(white, "dark"), /fill="#fff"/);
});

test("a logo with real colours keeps its black and white parts", () => {
  const colored = svg('<path fill="#4285F4" d="M0 0h1v1z"/><path fill="#fff" d="M0 0h1v1z"/>');
  assert.equal(lobeSvgForTheme(colored, "light"), colored);
  assert.equal(lobeSvgForTheme(colored, "dark"), colored);
  const black = svg('<path fill="#000" d="M0 0h1v1z"/><path fill="red" d="M0 0h1v1z"/>');
  assert.equal(lobeSvgForTheme(black, "dark"), black);
});

test("a theme url carries the theme", () => {
  assert.equal(lobeThemeUrl("openai", "dark"), "/lobe/openai.svg?theme=dark");
});

test("lobe logos skip the bucket", () => {
  assert.equal(logoPathForPlay("lobe:openai", "c1"), "lobe:openai");
  assert.equal(logoPublicUrl("https://x.supabase.co", "lobe:openai"), "/lobe/openai.svg");
});

test("a logo that is already a /lobe/ url stays as it is", () => {
  assert.equal(logoPathForPlay("/lobe/openai.svg", "c1"), "/lobe/openai.svg");
  assert.equal(logoPublicUrl("https://x.supabase.co", "/lobe/openai.svg"), "/lobe/openai.svg");
});

test("the share card finds the icon in a stored path or a page address", () => {
  assert.equal(lobeIdOfAny("lobe:openai"), "openai");
  assert.equal(lobeIdOfAny("/lobe/qwen-color.svg"), "qwen-color");
  assert.equal(lobeIdOfAny("/lobe/qwen-color.svg?theme=dark"), "qwen-color");
  assert.equal(lobeIdOfAny("/lobe/../x.svg"), null);
  assert.equal(lobeIdOfAny("https://x.co/a.png"), null);
});

test("a LobeHub logo wins over a model override and an old upload", () => {
  assert.equal(chooseLogoPath("logos/anthropic.png", "lobe:claude-color"), "lobe:claude-color");
  assert.equal(chooseLogoPath("logos/a.png", "/lobe/x.svg"), "/lobe/x.svg");
  assert.equal(chooseLogoPath(null, "", "logos/b.png", "logos/c.png"), "logos/b.png");
  assert.equal(chooseLogoPath(null, undefined), "");
});
