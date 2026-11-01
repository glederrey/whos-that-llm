import type { HomeDemoHintKey, HomeDemoRound, HomeDemoTurn } from "@/components/home-demo";
import { filterPublicModels, type PublicModel } from "./model-list";

type Step = { company: string; right: boolean; q: string; a: string; hint?: HomeDemoHintKey };

/**
 * Example rounds, in the order they play: one to three guesses each, hints optional and shown before the guess of their step.
 * The last step of a round is the right one and its model is the answer. The mix: right first try, right after one or two misses,
 * with no hint, one hint or two, and a hint that comes after a miss.
 */
const script: Step[][] = [
  [{ company: "Anthropic", right: true, q: "What should I name a cat that loves lasagna?", a: "Lasagnor. It sounds dignified, and it tells the whole house what he is being fed." }],
  [
    { company: "Google", right: false, q: "Give me a fun fact about octopuses.", a: "An octopus has three hearts, and two of them stop beating while it swims. That is why it prefers to crawl." },
    { company: "OpenAI", right: true, q: "Why is the sky blue, but at sunset red?", a: "Air scatters blue light the most. At sunset the light crosses more air, so the blue is gone before it reaches you.", hint: "company" },
  ],
  [
    { company: "OpenAI", right: false, q: "Explain recursion in one sentence.", a: "Recursion is a function solving a problem by calling itself on a smaller piece of it." },
    { company: "Alibaba", right: true, q: "Now a haiku about Mondays.", a: "Alarm cuts the dark / the inbox grew overnight / coffee, then courage.", hint: "origin" },
  ],
  [
    { company: "Z.ai", right: false, q: "How do I politely decline a meeting?", a: "Thank them, say your week is full, and offer a short written update instead of the call.", hint: "size" },
    { company: "xAI", right: true, q: "Roast my houseplant, it is a cactus.", a: "It is a plant that chose violence and then forgot to bloom. Respect, honestly." },
  ],
  [{ company: "Google", right: true, q: "Tell me a joke about databases.", a: "Why did the developer leave the database? Too many relationships, and no foreign key.", hint: "year" }],
  [
    { company: "Alibaba", right: false, q: "Summarize the plot of Hamlet in two lines.", a: "A prince is told by a ghost that his uncle killed his father. He hesitates, schemes, and almost everyone dies.", hint: "origin" },
    { company: "Moonshot", right: true, q: "What rhymes with orange?", a: "Nothing perfect. Door hinge and four-inch come close if you say them fast.", hint: "year" },
  ],
  [
    { company: "Meta", right: false, q: "What is the capital of Australia?", a: "Canberra. Plenty of people guess Sydney, but the capital was built on purpose, halfway between it and Melbourne." },
    { company: "DeepSeek", right: false, q: "Write a short apology for being late.", a: "Sorry I am late. The traffic won, but I brought coffee to make up for it.", hint: "year" },
    { company: "Mistral", right: true, q: "Suggest a name for a bakery.", a: "Levain & Co. It sounds warm, a little French, and it says bread before anyone reads the menu.", hint: "origin" },
  ],
  [{ company: "Z.ai", right: true, q: "Write a two-line poem about rain.", a: "Rain taps the window / asking to be let in, gently.", hint: "origin" }],
  [
    { company: "Anthropic", right: false, q: "Is a hot dog a sandwich?", a: "By the bread-and-filling definition, yes. By how people talk, almost nobody agrees." },
    { company: "Google", right: false, q: "Name three uses for a paperclip.", a: "Reset a phone, hold a bookmark, and pick a tiny lock on a toy diary.", hint: "size" },
    { company: "Perplexity", right: true, q: "What is a good way to learn chess openings?", a: "Learn the ideas first: control the center, develop pieces, castle. Then pick two openings and play them a lot.", hint: "company" },
  ],
  [
    { company: "Meta", right: false, q: "Give me a tongue twister about robots.", a: "Rapid robots rarely rest, rolling round rough roads." },
    { company: "DeepSeek", right: true, q: "Why do cats knead blankets?", a: "It is a leftover from kittenhood, when kneading helped milk flow. It also means they feel safe." },
  ],
];

function hintFor(key: HomeDemoHintKey | undefined, target: PublicModel): HomeDemoTurn["hint"] {
  if (key === "company") return { key, value: target.companyName };
  if (key === "origin") return { key, value: target.originName, flag: target.originFlag };
  if (key === "year") return { key, value: String(target.year) };
  if (key === "size") return { key, value: target.sizeName };
  return undefined;
}

/**
 * Builds the demo rounds from the live roster. A guess agrees with every hint shown so far, as a real player's would.
 * A round whose company has no model in the roster is left out.
 */
export function buildHomeDemoRounds(models: readonly PublicModel[]): HomeDemoRound[] {
  const rounds: HomeDemoRound[] = [];
  for (const steps of script) {
    const target = models.find((model) => model.companyName === steps[steps.length - 1].company);
    if (!target) continue;
    const turns: HomeDemoTurn[] = [];
    const shown: HomeDemoHintKey[] = [];
    for (const step of steps) {
      if (step.hint) shown.push(step.hint);
      const fits = (model: PublicModel) =>
        (!shown.includes("company") || model.companyName === target.companyName) &&
        (!shown.includes("origin") || model.originName === target.originName) &&
        (!shown.includes("year") || model.year === target.year) &&
        (!shown.includes("size") || model.sizeName === target.sizeName);
      const sameCompany = models.filter((model) => model.companyName === step.company);
      const answer = step.right ? target : (sameCompany.find(fits) ?? sameCompany[0]);
      if (!answer) break;
      const query = (answer.name.match(/^[A-Za-z]+/)?.[0] ?? answer.name).slice(0, 6).toLowerCase();
      const found = filterPublicModels(models, query).filter((model) => model.id !== answer.id);
      const others = [...found.filter(fits), ...found.filter((model) => !fits(model))];
      const candidates = [others[0], answer, others[1]]
        .filter(Boolean)
        .map((model) => ({ id: model.id, name: model.name, companyName: model.companyName, logoUrl: model.logoUrl }));
      turns.push({ q: step.q, a: step.a, query, candidates, pickId: answer.id, right: step.right, hint: hintFor(step.hint, target) });
    }
    if (turns.length !== steps.length) continue;
    rounds.push({
      turns,
      facts: {
        company: { value: target.companyName },
        origin: { value: target.originName, flag: target.originFlag },
        year: { value: String(target.year) },
        size: { value: target.sizeName },
      },
    });
  }
  return rounds;
}
