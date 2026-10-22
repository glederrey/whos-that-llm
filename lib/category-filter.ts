/** Categories whose name or description holds every word typed. An empty query keeps them all. */
export function filterCategories<T extends { name: string; description: string }>(items: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const text = `${item.name} ${item.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
