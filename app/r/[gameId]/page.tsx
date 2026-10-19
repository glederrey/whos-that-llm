import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedResult } from "@/components/shared-result";
import { shareCardHeight, shareCardWidth } from "@/lib/share-card-image";
import { readShareCard } from "@/lib/share-card-load";
import { shareCardPath, sharePagePath, shareText } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  const card = await readShareCard(gameId);
  if (!card) return {};
  const text = shareText(card);
  const image = shareCardPath(card.id);
  return {
    description: text,
    openGraph: {
      description: text,
      url: sharePagePath(card.id),
      type: "website",
      images: [{ url: image, width: shareCardWidth, height: shareCardHeight, alt: text }],
    },
    twitter: {
      card: "summary_large_image",
      description: text,
      images: [image],
    },
  };
}

/** A finished round anyone can open. The chat and the share buttons stay on the player's own result. */
export default async function SharedResultPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const card = await readShareCard(gameId);
  if (!card) notFound();
  return <SharedResult card={card} />;
}
