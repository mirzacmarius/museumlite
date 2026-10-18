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
 * The most rows one column reads looking for its cards, so rows it cannot
 * show never push the whole board past Convex's read limits.
 */
export const MAX_SCANNED_ROWS = 500;

/**
 * The first `limit` rows `keep` accepts, in the order `rows` yields them, and
 * whether another accepted row follows. Rows it rejects, such as Tasks on a
 * case the viewer cannot open, never leave the column short. After
 * MAX_SCANNED_ROWS rows it stops and says more may be waiting.
 */
export async function firstKept<Row, Kept>(
  rows: AsyncIterable<Row>,
  limit: number,
  keep: (row: Row) => Promise<Kept | null>,
): Promise<{ kept: Kept[]; hasMore: boolean }> {
  const kept: Kept[] = [];
  let scanned = 0;
  for await (const row of rows) {
    if (scanned === MAX_SCANNED_ROWS) return { kept, hasMore: true };
    scanned += 1;
    const value = await keep(row);
    if (value === null) continue;
    if (kept.length === limit) return { kept, hasMore: true };
    kept.push(value);
  }
  return { kept, hasMore: false };
}

/** The rows of streams that are each newest first, interleaved newest first. */
export async function* newestFirst<Row extends { _creationTime: number }>(
  streams: AsyncIterable<Row>[],
): AsyncGenerator<Row> {
  const iterators = streams.map((stream) => stream[Symbol.asyncIterator]());
  const heads = await Promise.all(iterators.map((iterator) => iterator.next()));
  for (;;) {
    let newest = -1;
    for (const [index, head] of heads.entries()) {
      const best = heads[newest];
      if (
        !head.done &&
        (!best ||
          best.done ||
          head.value._creationTime > best.value._creationTime)
      ) {
        newest = index;
      }
    }
    const head = heads[newest];
    const iterator = iterators[newest];
    if (!head || head.done || !iterator) return;
    yield head.value;
    heads[newest] = await iterator.next();
  }
}
