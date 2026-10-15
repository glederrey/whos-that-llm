import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareCardView } from "@/components/share-card";
import { shareCardHeight, shareCardWidth } from "@/lib/share-card-image";
import { readShareCard } from "@/lib/share-card-load";
import { shareBrand, shareCardPath, sharePagePath, shareText } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  const card = await readShareCard(gameId);
  if (!card) return { title: shareBrand };
  const text = shareText(card);
  const image = shareCardPath(card.id);
  return {
    title: shareBrand,
    description: text,
    openGraph: {
      title: shareBrand,
      description: text,
      url: sharePagePath(card.id),
      type: "website",
      images: [{ url: image, width: shareCardWidth, height: shareCardHeight, alt: text }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareBrand,
      description: text,
      images: [image],
    },
  };
}

export default async function SharedResultPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const card = await readShareCard(gameId);
  if (!card) notFound();
  return (
    <main className="share-page">
      <ShareCardView card={card} />
    </main>
  );
}
