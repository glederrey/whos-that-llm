import { createElement, type ReactElement } from "react";
import { shareCardDisplay, type ShareCard } from "./share-card";

export const shareCardWidth = 1080;
export const shareCardHeight = 1350;

const paper = "#EBEBEB";
const ink = "#141414";
const mute = "#52525B";
const scoreTeal = "#007F88";
const bar = "#00BBC9";

/**
 * The 4:5 score card. Satori draws this to a PNG when someone downloads it
 * or when a share preview requests it. Nothing here is the chat.
 */
export function shareCardImage(card: ShareCard, logoSrc: string): ReactElement {
  const display = shareCardDisplay(card);
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: paper,
        color: ink,
        fontFamily: "Roboto",
      },
    },
    createElement("div", { style: { display: "flex", height: 18, background: bar } }),
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          padding: "56px 76px 68px",
        },
      },
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center" } },
        createElement("img", { src: logoSrc, width: 210, height: 210, style: { marginRight: -18 } }),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: ink,
            },
          },
          display.title,
        ),
      ),
      createElement(
        "div",
        { style: { display: "flex", alignItems: "baseline", marginTop: 28, fontSize: 48, fontWeight: 700 } },
        createElement("span", null, display.mode),
        display.variant
          ? createElement(
              "span",
              { style: { color: display.variantColor ?? ink } },
              ` · ${display.variant}`,
            )
          : null,
      ),
      createElement("div", { style: { display: "flex", flexGrow: 1 } }),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: display.score === "—" ? 96 : 168,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: display.score === "—" ? 0 : -5,
            color: scoreTeal,
          },
        },
        display.score,
      ),
      createElement(
        "div",
        { style: { display: "flex", marginTop: 18, fontSize: 64, fontWeight: 700, color: ink } },
        display.outcome,
      ),
      display.modelName
        ? createElement(
            "div",
            { style: { display: "flex", marginTop: 16, fontSize: 42, color: mute } },
            display.modelName,
          )
        : null,
      createElement("div", { style: { display: "flex", flexGrow: 1 } }),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            paddingTop: 28,
            borderTop: `4px solid ${ink}`,
          },
        },
        stat(display.messagesLabel, display.messages),
        stat(display.tokensLabel, display.tokens),
      ),
    ),
  );
}

function stat(label: string, value: string): ReactElement {
  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", width: "50%" } },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontSize: 26,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: mute,
        },
      },
      label,
    ),
    createElement(
      "div",
      { style: { display: "flex", marginTop: 8, fontSize: 64, fontWeight: 700, color: ink } },
      value,
    ),
  );
}
