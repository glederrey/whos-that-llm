import { createElement, type CSSProperties, type ReactElement } from "react";
import { shareCardDisplay, type ShareCard, type ShareMeta } from "./share-card";

export const shareCardWidth = 1080;
export const shareCardHeight = 1350;

const paper = "#EBEBEB";
const ink = "#141414";
const mute = "#52525B";
const line = "#D4D4D8";
const scoreTeal = "#007F88";
const bar = "#00BBC9";
const solvedWash = "#E6F8F8";
const missWash = "#FDECEC";
const missInk = "#C41B15";

/**
 * The 4:5 score card. Satori draws this to a PNG. The public page shows that
 * same PNG, and Download saves it. Nothing here is the chat.
 * The teal frame and the rounded corners are part of the image.
 */
export function shareCardImage(card: ShareCard, logoSrc: string, modelLogoSrc: string | null = null): ReactElement {
  const display = shareCardDisplay(card);
  const statusColor = display.outcome === "Not solved" ? missInk : display.outcome === "Solved" ? scoreTeal : ink;
  const statusWash = display.outcome === "Not solved" ? missWash : display.outcome === "Solved" ? solvedWash : "#F3F3F4";
  return box(
    {
      width: "100%",
      height: "100%",
      background: bar,
      borderRadius: 56,
      padding: 18,
      color: ink,
      fontFamily: "Roboto",
    },
    box(
      {
        flexDirection: "column",
        flexGrow: 1,
        background: paper,
        borderRadius: 40,
        padding: "28px 56px 40px",
      },
      box(
        { alignItems: "center" },
        createElement("img", {
          src: logoSrc,
          width: 148,
          height: 148,
          style: { margin: "-20px -8px -20px -20px" },
        }),
        text(display.title, { fontSize: 58, fontWeight: 700, lineHeight: 1.02, letterSpacing: -1.5 }),
      ),
      display.modelName
        ? box(
            { alignItems: "center", marginTop: 8 },
            modelLogoSrc
              ? box(
                  {
                    width: 96,
                    height: 96,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#FFFFFF",
                    borderRadius: 22,
                    marginRight: 18,
                  },
                  createElement("img", { src: modelLogoSrc, width: 72, height: 72 }),
                )
              : null,
            box(
              { flexDirection: "column" },
              text(display.modelName, { fontSize: 44, fontWeight: 700, lineHeight: 1.1 }),
              display.modelFacts.length > 0 ? factLine(display.modelFacts) : null,
            ),
          )
        : null,
      box(
        { alignItems: "center", justifyContent: "space-between", marginTop: 28 },
        box(
          { flexDirection: "column" },
          text("Your score", {
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: mute,
          }),
          text(display.score, {
            marginTop: 4,
            fontSize: display.score === "—" ? 84 : 112,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: display.score === "—" ? 0 : -3,
            color: scoreTeal,
          }),
        ),
        box(
          { flexDirection: "column", alignItems: "flex-end" },
          text(display.status, {
            fontSize: 26,
            fontWeight: 500,
            color: statusColor,
            background: statusWash,
            borderRadius: 999,
            padding: "8px 18px",
          }),
          ...display.meta.map((row) => metaRow(row)),
        ),
      ),
      display.steps.length > 0 || display.score !== "—"
        ? box(
            { flexDirection: "column", marginTop: 28 },
            tableHead(),
            ...display.steps.map((step) => tableRow(step.label, step.change, step.after, step.kind === "subtotal" || step.kind === "floor")),
            display.score !== "—" ? tableRow("Total", "", display.score, true) : null,
          )
        : null,
      box({ flexGrow: 1 }),
      box(
        { flexDirection: "column", marginTop: 24 },
        text(display.invite, { fontSize: 36, fontWeight: 700 }),
        text(display.site, { marginTop: 6, fontSize: 28, color: mute }),
      ),
    ),
  );
}

function factLine(facts: string[]): ReactElement {
  const children: ReactElement[] = [];
  facts.forEach((fact, index) => {
    if (index > 0) children.push(text("·", { color: mute, paddingLeft: 10, paddingRight: 10, fontSize: 26 }));
    children.push(text(fact, { fontSize: 26, color: mute }));
  });
  return box({ alignItems: "center", marginTop: 4 }, ...children);
}

function metaRow(row: ShareMeta): ReactElement {
  return box(
    { alignItems: "center", marginTop: 8 },
    text(row.label, { fontSize: 26, color: mute, marginRight: 16 }),
    text(row.value, { fontSize: 28, fontWeight: 700, color: row.color ?? ink }),
  );
}

function tableHead(): ReactElement {
  return box(
    { justifyContent: "flex-end", paddingBottom: 8 },
    text("After", {
      fontSize: 20,
      fontWeight: 500,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: mute,
    }),
  );
}

function tableRow(label: string, change: string, after: string, strong: boolean): ReactElement {
  return box(
    {
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: `2px solid ${line}`,
      paddingTop: 12,
      paddingBottom: 12,
    },
    text(label, { fontSize: 28, fontWeight: strong ? 700 : 500, color: ink }),
    box(
      { alignItems: "center" },
      change
        ? text(change, { width: 160, justifyContent: "flex-end", fontSize: 28, fontWeight: 500, color: mute })
        : null,
      after
        ? text(after, { width: 170, justifyContent: "flex-end", fontSize: 28, fontWeight: 700, color: ink })
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
