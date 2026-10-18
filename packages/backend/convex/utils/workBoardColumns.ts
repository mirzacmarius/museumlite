/** A Work board column's first cards, and whether more are waiting. */
export interface ColumnPage<Card> {
  cards: Card[];
  hasMore: boolean;
}

/** Cards a Work board column shows until the viewer loads more. */
export const WORK_COLUMN_PAGE = 20;

/** The most cards one column shows, however many times more are loaded. */
export const MAX_COLUMN_CARDS = 100;

/**
 * The first `limit` rows `keep` accepts, in the order `rows` yields them, and
 * whether another accepted row follows. Rows it rejects, such as Tasks on a
 * case the viewer cannot open, never leave the column short.
 */
export async function firstKept<Row, Kept>(
  rows: AsyncIterable<Row>,
  limit: number,
  keep: (row: Row) => Promise<Kept | null>,
): Promise<{ kept: Kept[]; hasMore: boolean }> {
  const kept: Kept[] = [];
  for await (const row of rows) {
    const value = await keep(row);
    if (value === null) continue;
    if (kept.length === limit) return { kept, hasMore: true };
    kept.push(value);
  }
  return { kept, hasMore: false };
}
