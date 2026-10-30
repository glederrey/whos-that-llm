import type { Metadata } from "next";
import { ModelGallery } from "@/components/model-gallery";
import { publicModels } from "@/lib/model-list";
import { serviceOrThrow } from "@/lib/rounds";
import { loadCatalog } from "@/lib/rounds-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Every language model you can meet in Who's that LLM?, with its company, origin, release year, and size, and a link to OpenRouter.",
};

export default async function ModelsPage() {
  const models = publicModels(await loadCatalog(serviceOrThrow()));
  return (
    <div className="stack models-page">
      <h1>Models</h1>
      <p className="lede">Every model that can be hiding in a round. Each one links to OpenRouter, where you can read more about it.</p>
      <ModelGallery models={models} />
    </div>
  );
}
