import { createElement, type ReactElement } from "react";
import { shareCardDisplay, type ShareCard, type ShareDetail } from "./share-card";

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
 * The teal frame and the rounded corners are part of the image.
 */
export function shareCardImage(card: ShareCard, logoSrc: string): ReactElement {
  const display = shareCardDisplay(card);
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        background: bar,
        borderRadius: 56,
        padding: 18,
        color: ink,
        fontFamily: "Roboto",
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          background: paper,
          borderRadius: 40,
          padding: "36px 68px 52px",
        },
      },
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center" } },
        createElement("img", {
          src: logoSrc,
          width: 220,
          height: 220,
          style: { margin: "-32px -10px -32px -32px" },
        }),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: ink,
            },
          },
          display.title,
        ),
      ),
      modeLine(display.mode, display.variant, display.variantColor),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 36,
            fontSize: display.score === "—" ? 88 : 132,
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: display.score === "—" ? 0 : -4,
            color: scoreTeal,
          },
        },
        display.score,
      ),
      createElement(
        "div",
        { style: { display: "flex", marginTop: 14, fontSize: 56, fontWeight: 700, color: ink } },
        display.outcome,
      ),
      display.modelName
        ? createElement(
            "div",
            { style: { display: "flex", marginTop: 10, fontSize: 36, color: mute } },
            display.modelName,
          )
        : null,
      display.details.length > 0 || display.hints
        ? createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", marginTop: 28 } },
            ...display.details.map((line) => detailRow(line)),
            ...(display.hints ? [detailRow({ label: display.hints, value: "" })] : []),
          )
        : null,
      createElement("div", { style: { display: "flex", flexGrow: 1 } }),
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", marginBottom: 28 } },
        createElement(
          "div",
          { style: { display: "flex", fontSize: 36, fontWeight: 700, color: ink } },
          display.invite,
        ),
        createElement(
          "div",
          { style: { display: "flex", marginTop: 6, fontSize: 28, color: mute } },
          display.site,
        ),
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            paddingTop: 22,
            borderTop: `4px solid ${ink}`,
          },
        },
        stat(display.messagesLabel, display.messages),
        stat(display.tokensLabel, display.tokens),
      ),
    ),
  );
}

function modeLine(mode: string, variant: string | null, variantColor: string | null): ReactElement {
  return createElement(
    "div",
    { style: { display: "flex", alignItems: "center", marginTop: 8, fontSize: 46, fontWeight: 700 } },
    createElement("span", null, mode),
    variant
      ? createElement(
          "span",
          { style: { color: ink, paddingLeft: 22, paddingRight: 22 } },
          "·",
        )
      : null,
    variant ? createElement("span", { style: { color: variantColor ?? ink } }, variant) : null,
  );
}

function detailRow(line: ShareDetail): ReactElement {
  return createElement(
    "div",
    { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 30 } },
    createElement("div", { style: { display: "flex", color: mute } }, line.label),
    line.value
      ? createElement("div", { style: { display: "flex", fontWeight: 700, color: ink } }, line.value)
      : null,
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
          fontSize: 24,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: mute,
        },
      },
      label,
    ),
    createElement(
      "div",
      { style: { display: "flex", marginTop: 6, fontSize: 56, fontWeight: 700, color: ink } },
      value,
    ),
  );
}
