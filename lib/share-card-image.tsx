import { createElement, type CSSProperties, type ReactElement } from "react";
import { hiddenModelNote, hiddenModelTitle, shareCardDisplay, type ShareCard, type ShareCardTheme, type ShareMeta } from "./share-card";

export const shareCardWidth = 1080;
export const shareCardHeight = 1350;

const playLink = "https://whos-that-llm.com";

type Tone = {
  paper: string;
  ink: string;
  mute: string;
  line: string;
  score: string;
  frame: string;
  solvedWash: string;
  missWash: string;
  missInk: string;
  quietWash: string;
  chip: string;
};

const light: Tone = {
  paper: "#EBEBEB",
  ink: "#141414",
  mute: "#52525B",
  line: "#D4D4D8",
  score: "#007F88",
  frame: "#00BBC9",
  solvedWash: "#E6F8F8",
  missWash: "#FDECEC",
  missInk: "#C41B15",
  quietWash: "#F3F3F4",
  chip: "#FFFFFF",
};

const dark: Tone = {
  paper: "#1E1E1E",
  ink: "#EBEBEB",
  mute: "#A1A1AA",
  line: "#2E2E2E",
  score: "#00BBC9",
  frame: "#00BBC9",
  solvedWash: "#062E2E",
  missWash: "#3A1212",
  missInk: "#C41B15",
  quietWash: "#262626",
  chip: "#FFFFFF",
};

/**
 * The 4:5 score card. Satori draws this to a PNG. Download saves it, and the
 * link preview uses it. The public page itself is the score table. Nothing
 * here is the chat.
 * The teal frame and the rounded corners are part of the image.
 */
export function shareCardImage(
  card: ShareCard,
  logoSrc: string,
  modelLogoSrc: string | null = null,
  theme: ShareCardTheme = "light",
): ReactElement {
  const tone = theme === "dark" ? dark : light;
  const display = shareCardDisplay(card);
  const statusColor = display.outcome === "Not solved" ? tone.missInk : display.outcome === "Solved" ? tone.score : tone.ink;
  const statusWash = display.outcome === "Not solved" ? tone.missWash : display.outcome === "Solved" ? tone.solvedWash : tone.quietWash;
  return box(
    {
      width: "100%",
      height: "100%",
      background: tone.frame,
      borderRadius: 56,
      padding: 18,
      color: tone.ink,
      fontFamily: "Roboto",
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
        text(display.title, { fontSize: 108, fontWeight: 700, lineHeight: 0.92, letterSpacing: -2.5 }),
      ),
      box(
        { flexDirection: "column", flexGrow: 1, justifyContent: "center" },
        card.modelHidden
        ? box(
            { alignItems: "center" },
            createElement("img", { src: logoSrc, width: 96, height: 96, style: { marginRight: 18 } }),
            box(
              { flexDirection: "column" },
              text(hiddenModelTitle, { fontSize: 44, fontWeight: 700, lineHeight: 1.1 }),
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
                      background: tone.chip,
                      borderRadius: 22,
                      marginRight: 18,
                    },
                    createElement("img", { src: modelLogoSrc, width: 72, height: 72 }),
                  )
                : null,
              box(
                { flexDirection: "column" },
                text(display.modelName, { fontSize: 44, fontWeight: 700, lineHeight: 1.1 }),
                display.modelFacts.length > 0 ? factLine(display.modelFacts, tone) : null,
              ),
            )
          : null,
      box(
        { alignItems: "center", justifyContent: "space-between", marginTop: display.modelName || card.modelHidden ? 76 : 0 },
        box(
          { flexDirection: "column" },
          text("Your score", {
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: tone.mute,
          }),
          text(display.score, {
            marginTop: 4,
            fontSize: display.score === "—" ? 84 : 112,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: display.score === "—" ? 0 : -3,
            color: tone.score,
          }),
        ),
        box(
          { flexDirection: "column", alignItems: "flex-end" },
          text(display.status, {
            fontSize: 36,
            fontWeight: 700,
            color: statusColor,
            background: statusWash,
            borderRadius: 999,
            padding: "12px 22px",
          }),
          ...display.meta.map((row) => metaRow(row, tone)),
        ),
      ),
      display.steps.length > 0 || display.score !== "—"
        ? box(
            { flexDirection: "column", marginTop: 28 },
            tableHead(tone),
            ...display.steps.map((step) =>
              tableRow(step.label, step.change, step.after, step.kind === "subtotal" || step.kind === "floor", tone),
            ),
            display.score !== "—" ? tableRow("Total", "", display.score, true, tone) : null,
          )
        : null,
      ),
      box(
        { flexDirection: "column" },
        text(display.invite, { fontSize: 36, fontWeight: 700 }),
        text(playLink, { marginTop: 8, fontSize: 32, fontWeight: 700, color: tone.score }),
      ),
    ),
  );
}

function factLine(facts: string[], tone: Tone): ReactElement {
  const children: ReactElement[] = [];
  facts.forEach((fact, index) => {
    if (index > 0) children.push(text("·", { color: tone.mute, paddingLeft: 10, paddingRight: 10, fontSize: 26 }));
    children.push(text(fact, { fontSize: 26, color: tone.mute }));
  });
  return box({ alignItems: "center", marginTop: 4 }, ...children);
}

function metaRow(row: ShareMeta, tone: Tone): ReactElement {
  return box(
    { alignItems: "center", marginTop: 8 },
    text(row.label, { fontSize: 26, color: tone.mute, marginRight: 16 }),
    text(row.value, { fontSize: 28, fontWeight: 700, color: row.color ?? tone.ink }),
  );
}

function tableHead(tone: Tone): ReactElement {
  return box(
    { justifyContent: "flex-end", paddingBottom: 8 },
    text("After", {
      fontSize: 20,
      fontWeight: 500,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: tone.mute,
    }),
  );
}

function tableRow(label: string, change: string, after: string, strong: boolean, tone: Tone): ReactElement {
  return box(
    {
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: `2px solid ${tone.line}`,
      paddingTop: 12,
      paddingBottom: 12,
    },
    text(label, { fontSize: 28, fontWeight: strong ? 700 : 500, color: tone.ink }),
    box(
      { alignItems: "center" },
      change
        ? text(change, { width: 160, justifyContent: "flex-end", fontSize: 28, fontWeight: 500, color: tone.mute })
        : null,
      after
        ? text(after, { width: 170, justifyContent: "flex-end", fontSize: 28, fontWeight: 700, color: tone.ink })
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
