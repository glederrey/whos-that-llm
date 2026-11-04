import { createElement, type CSSProperties, type ReactElement } from "react";
import { clipText, difficultyColor, difficultyColorLight, hiddenModelNote, hiddenModelTitle, noGuess, noScore, shareCardDisplay, type ShareCard, type ShareCardTheme, type ShareMeta } from "./share-card";
import type { Difficulty } from "./difficulty";

/** Data URIs of the flag pictures an Origin card draws. Null falls back to the name alone. */
export type ShareCardFlags = { guessed: string | null; actual: string | null };

export const shareCardWidth = 1080;
export const shareCardHeight = 1350;

/** A long category name is cut with an ellipsis so the right column stays inside the card. */
const metaValueMax = 26;

const playLink = "https://whos-that-llm.com";

/** The site's three faces, as the route registers them. */
const fontDisplay = "Roboto";
const fontSans = "Instrument Sans";
const fontMono = "JetBrains Mono";

type Tone = {
  paper: string;
  ink: string;
  mute: string;
  line: string;
  link: string;
  frame: string;
  hidden: string;
  onHidden: string;
  onHiddenMute: string;
  linkOnHidden: string;
  quietWash: string;
  quietLine: string;
};

const light: Tone = {
  paper: "#EBEBEB",
  ink: "#141414",
  mute: "#55555C",
  line: "#D4D4D8",
  link: "#006C74",
  frame: "#00BBC9",
  hidden: "#FFFFFF",
  onHidden: "#141414",
  onHiddenMute: "#55555C",
  linkOnHidden: "#00838C",
  quietWash: "#F4F4F5",
  quietLine: "#D4D4D8",
};

const dark: Tone = {
  paper: "#1A1A1A",
  ink: "#EBEBEB",
  mute: "#A1A1AA",
  line: "#2E2E2E",
  link: "#33CCD8",
  frame: "#00BBC9",
  hidden: "#262626",
  onHidden: "#EBEBEB",
  onHiddenMute: "#A1A1AA",
  linkOnHidden: "#33CCD8",
  quietWash: "#383838",
  quietLine: "#5A5A5A",
};

/** The light card's slab is white, so its difficulty words take the light-theme text colors. */
const lightDifficulty: Record<string, string> = Object.fromEntries(
  (Object.keys(difficultyColor) as Difficulty[]).map((difficulty) => [difficultyColor[difficulty], difficultyColorLight[difficulty]]),
);

/** Small uppercase label, the machine layer. */
function label(value: string, color: string, style: CSSProperties = {}): ReactElement {
  return text(value, { fontFamily: fontMono, fontSize: 24, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color, ...style });
}

/**
 * The 4:5 score card. Satori draws this to a PNG. Download saves it, and the
 * link preview uses it. The public page itself is the score table. Nothing
 * here is the chat.
 * The teal frame and the rounded corners are part of the image. The score sits
 * on the slab, as on the result page: white in light, ink in dark.
 */
export function shareCardImage(
  card: ShareCard,
  logoSrc: string,
  modelLogoSrc: string | null = null,
  theme: ShareCardTheme = "light",
  flags: ShareCardFlags = { guessed: null, actual: null },
): ReactElement {
  const tone = theme === "dark" ? dark : light;
  const display = shareCardDisplay(card);
  const status = statusChip(display.outcome, tone);
  return box(
    {
      width: "100%",
      height: "100%",
      background: tone.frame,
      borderRadius: 56,
      padding: 18,
      color: tone.ink,
      fontFamily: fontSans,
    },
    box(
      {
        flexDirection: "column",
        flexGrow: 1,
        background: tone.paper,
        borderRadius: 40,
        padding: "36px 56px 40px",
      },
      box(
        { alignItems: "center" },
        createElement("img", {
          src: logoSrc,
          width: 188,
          height: 188,
          style: { margin: "-28px 4px -28px -28px" },
        }),
        text(display.title, { fontFamily: fontDisplay, fontSize: 108, fontWeight: 700, lineHeight: 0.92, letterSpacing: -2.5 }),
      ),
      box(
        { flexDirection: "column", flexGrow: 1, justifyContent: "center" },
        card.modelHidden
        ? box(
            { alignItems: "center" },
            createElement("img", { src: logoSrc, width: 96, height: 96, style: { marginRight: 18 } }),
            box(
              { flexDirection: "column" },
              text(hiddenModelTitle, { fontFamily: fontDisplay, fontSize: 44, fontWeight: 700, lineHeight: 1.1 }),
              text(hiddenModelNote, { marginTop: 8, fontSize: 26, color: tone.mute }),
            ),
          )
        : display.modelName
          ? box(
              { alignItems: "center" },
              modelLogoSrc
                ? box(
                    {
                      width: 96,
                      height: 96,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 18,
                    },
                    createElement("img", { src: modelLogoSrc, width: 88, height: 88 }),
                  )
                : null,
              box(
                { flexDirection: "column" },
                text(display.modelName, { fontFamily: fontDisplay, fontSize: 44, fontWeight: 700, lineHeight: 1.1 }),
                display.modelFacts.length > 0 ? factLine(display.modelFacts, tone) : null,
              ),
            )
          : null,
      box(
        {
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: display.modelName || card.modelHidden ? 48 : 0,
          background: tone.hidden,
          color: tone.onHidden,
          borderRadius: 44,
          padding: "36px 44px",
        },
        display.origin
          ? originBlock(display.origin, flags, tone)
          : box(
          { flexDirection: "column" },
          label(display.scoreLabel, tone.onHiddenMute),
          text(display.score, {
            marginTop: 8,
            fontFamily: fontDisplay,
            fontSize: display.score === noScore ? 72 : 136,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: display.score === noScore ? -1 : -3,
            color: display.score === noScore ? tone.onHiddenMute : tone.linkOnHidden,
          }),
        ),
        box(
          { flexDirection: "column", alignItems: "stretch" },
          box(
            { flexDirection: "column", alignItems: "stretch", width: "100%" },
            text(display.status, {
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: status.color,
              background: status.background,
              borderRadius: 999,
              padding: "10px 22px",
              ...(status.border ? { border: status.border } : {}),
            }),
            display.noHint
              ? text("No hints", {
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: 700,
                  color: tone.onHidden,
                  background: tone.quietWash,
                  border: `2px solid ${tone.quietLine}`,
                  borderRadius: 999,
                  padding: "8px 22px",
                  marginTop: 10,
                  alignSelf: "flex-end",
                })
              : null,
          ),
          metaTable(display.meta, tone),
        ),
      ),
      !display.origin && (display.steps.length > 0 || display.score !== noScore)
        ? box(
            { flexDirection: "column", marginTop: 28 },
            tableHead(tone),
            ...display.steps.map((step) =>
              tableRow(step.label, step.change, step.after, step.kind === "subtotal" || step.kind === "floor", tone),
            ),
            display.score !== noScore ? tableRow("Total", "", display.score, true, tone) : null,
          )
        : null,
      ),
      box(
        { flexDirection: "column" },
        text(display.invite, { fontSize: 36, fontWeight: 700 }),
        text(playLink, { marginTop: 8, fontSize: 32, fontWeight: 700, color: tone.link }),
      ),
    ),
  );
}

/** What the player guessed, and where the model really comes from when the guess missed or they gave up. */
function originBlock(origin: NonNullable<ReturnType<typeof shareCardDisplay>["origin"]>, flags: ShareCardFlags, tone: Tone): ReactElement {
  const place = (name: string, flag: string | null, size: number, color: string) =>
    box(
      { alignItems: "center" },
      flag ? createElement("img", { src: flag, width: size, height: size, style: { marginRight: 18 } }) : null,
      text(clipText(name, 14), { fontFamily: fontDisplay, fontSize: size, fontWeight: 700, lineHeight: 1, color }),
    );
  return box(
    { flexDirection: "column" },
    label(origin.guessLabel, tone.onHiddenMute),
    box({ marginTop: 12 }, origin.guessed ? place(origin.guessed.name, flags.guessed, 84, tone.linkOnHidden) : text(noGuess, { fontFamily: fontDisplay, fontSize: 72, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: tone.onHiddenMute })),
    origin.correct
      ? null
      : box(
          { flexDirection: "column", marginTop: 36 },
          label("Comes from", tone.onHiddenMute),
          box({ marginTop: 12 }, place(origin.actual.name, flags.actual, 64, tone.onHidden)),
        ),
  );
}

/** Same chips as the score card. Solved is the Easy green, Failed is the Hard red, Given up stays gray on the slab. */
function statusChip(outcome: ShareCard["outcome"], tone: Tone): { color: string; background: string; border?: string } {
  if (outcome === "Solved") return { color: "#fff", background: "#1c7c43" };
  if (outcome === "Failed") return { color: "#fff", background: "#c41b15" };
  return { color: tone.onHidden, background: tone.quietWash, border: `1px solid ${tone.quietLine}` };
}

function factLine(facts: string[], tone: Tone): ReactElement {
  const children: ReactElement[] = [];
  facts.forEach((fact, index) => {
    if (index > 0) children.push(text("·", { color: tone.mute, paddingLeft: 10, paddingRight: 10, fontSize: 26 }));
    children.push(text(fact, { fontSize: 26, color: tone.mute }));
  });
  return box({ alignItems: "center", marginTop: 4 }, ...children);
}

/** Labels right-aligned in one column, values left-aligned in the next, like the score card on the page. */
function metaTable(rows: ShareMeta[], tone: Tone): ReactElement {
  const cell = { height: 36, alignItems: "center", marginTop: 8 } as const;
  return box(
    { marginTop: 8, justifyContent: "flex-end" },
    box(
      { flexDirection: "column", alignItems: "flex-end", marginRight: 16 },
      ...rows.map((row) => text(row.label, { ...cell, fontSize: 26, fontWeight: 500, color: tone.onHiddenMute })),
    ),
    box(
      { flexDirection: "column", alignItems: "flex-start" },
      ...rows.map((row) => text(clipText(row.value, metaValueMax), { ...cell, fontSize: 28, fontWeight: 700, color: (row.color && tone === light ? lightDifficulty[row.color] : row.color) ?? tone.onHidden })),
    ),
  );
}

function tableHead(tone: Tone): ReactElement {
  return box(
    { justifyContent: "flex-end", paddingBottom: 8 },
    label("After", tone.mute, { fontSize: 20, letterSpacing: 1.5 }),
  );
}

function tableRow(name: string, change: string, after: string, strong: boolean, tone: Tone): ReactElement {
  return box(
    {
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: `2px solid ${tone.line}`,
      paddingTop: 12,
      paddingBottom: 12,
    },
    text(name, { fontSize: 28, fontWeight: strong ? 700 : 500, color: tone.ink }),
    box(
      { alignItems: "center" },
      change
        ? text(change, { width: 170, justifyContent: "flex-end", fontFamily: fontMono, fontSize: 26, fontWeight: 500, wordSpacing: -10, color: tone.mute })
        : null,
      after
        ? text(after, { width: 190, justifyContent: "flex-end", fontFamily: fontMono, fontSize: 26, fontWeight: 500, wordSpacing: -10, color: tone.ink })
        : null,
    ),
  );
}

function box(style: CSSProperties, ...children: Array<ReactElement | null>): ReactElement {
  return createElement("div", { style: { display: "flex", ...style } }, ...children);
}

function text(value: string, style: CSSProperties): ReactElement {
  return createElement("div", { style: { display: "flex", ...style } }, value);
}
