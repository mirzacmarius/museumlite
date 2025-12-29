/**
 * Pluralizes a word based on the count.
 * 
 * @param count - The number to check for pluralization
 * @param singular - The singular form of the word
 * @param plural - Optional plural form. If not provided, adds 's' to singular
 * @returns The appropriate form of the word
 * 
 * @example
 * pluralize(1, 'item') // 'item'
 * pluralize(2, 'item') // 'items'
 * pluralize(1, 'child', 'children') // 'child'
 * pluralize(2, 'child', 'children') // 'children'
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  if (count === 1) {
    return singular;
  }
  return plural ?? `${singular}s`;
}

/**
 * Formats a count with the appropriate plural form.
 * 
 * @param count - The number to format
 * @param singular - The singular form of the word
 * @param plural - Optional plural form. If not provided, adds 's' to singular
 * @returns A formatted string with count and word
 * 
 * @example
 * formatCount(1, 'item') // '1 item'
 * formatCount(2, 'item') // '2 items'
 * formatCount(1, 'child', 'children') // '1 child'
 * formatCount(2, 'child', 'children') // '2 children'
 */
export function formatCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}
