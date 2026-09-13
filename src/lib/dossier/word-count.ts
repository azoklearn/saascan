/** Same whitespace-separated convention as the generated SQL column. */
export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
