export const deleteWord = "delete";

// The delete window asks for this word before it enables the red button. Case and outer spaces do not matter.
export function deleteConfirmed(text: string): boolean {
  return text.trim().toLowerCase() === deleteWord;
}
