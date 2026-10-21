/**
 * convex-test 0.0.41 answers every query by listing the ids of every document
 * in the whole fake database and keeping the ones in the queried table, so an
 * indexed `.first()` costs as much as the database is large. A test with
 * thousands of rows then runs in time that grows with rows × queries: the
 * 5,000-object export test took about 55 seconds alone and 100 seconds on CI.
 *
 * This keeps a per-table list of committed ids beside the fake database, so a
 * query only visits its own table. Results and their order are unchanged: ids
 * are kept in commit order, as the database's own keys are.
 *
 * It relies on convex-test internals. If an upgrade renames them, the tests
 * still run, only slowly again, and a warning says so.
 */

type FakeDocument = Record<string, unknown> | null;

type DatabaseFakeInternals = {
  _documents: Record<string, FakeDocument>;
  _writes: Record<string, FakeDocument>[];
  get(tableName: string, id: string): FakeDocument;
  commit(): void;
  _iterateDocs(
    tableName: string,
    callback: (document: Record<string, unknown>) => void,
  ): void;
};

type IndexedDatabaseFake = DatabaseFakeInternals & {
  _committedIdsByTable?: Map<string, Set<string>>;
};

const INDEXED = Symbol.for("museumlite.convexTestTableIndex");

// Same rule as convex-test's tableNameFromId for its "<number>;<table>" ids.
function tableNameOf(id: string): string | null {
  const parts = id.split(";");
  return parts.length === 2 ? (parts[1] ?? null) : null;
}

function committedIds(db: IndexedDatabaseFake) {
  if (!db._committedIdsByTable) {
    const byTable = new Map<string, Set<string>>();
    for (const id of Object.keys(db._documents)) remember(byTable, id);
    db._committedIdsByTable = byTable;
  }
  return db._committedIdsByTable;
}

function remember(byTable: Map<string, Set<string>>, id: string) {
  const table = tableNameOf(id);
  if (table === null) return;
  let ids = byTable.get(table);
  if (!ids) {
    ids = new Set();
    byTable.set(table, ids);
  }
  ids.add(id);
}

function looksLikeDatabaseFake(db: unknown): db is IndexedDatabaseFake {
  if (db === null || typeof db !== "object") return false;
  const candidate = db as Partial<DatabaseFakeInternals>;
  return (
    typeof candidate._documents === "object" &&
    Array.isArray(candidate._writes) &&
    typeof candidate.get === "function" &&
    typeof candidate.commit === "function" &&
    typeof candidate._iterateDocs === "function"
  );
}

let warned = false;

/** Index the fake database class behind `db` by table, once per test file. */
export function indexConvexTestDatabaseByTable(db: unknown) {
  if (!looksLikeDatabaseFake(db)) {
    if (!warned) {
      warned = true;
      console.warn(
        "convex-test internals changed; tests/convexTestTableIndex.ts no longer applies and large tests will be slow",
      );
    }
    return;
  }
  const prototype = Object.getPrototypeOf(db) as IndexedDatabaseFake & {
    [INDEXED]?: true;
  };
  if (prototype[INDEXED]) return;
  const commit = prototype.commit;
  prototype.commit = function (this: IndexedDatabaseFake) {
    const writes = this._writes[this._writes.length - 1];
    const reachesDatabase = this._writes.length === 1;
    commit.call(this);
    if (!reachesDatabase || !writes || !this._committedIdsByTable) return;
    for (const [id, document] of Object.entries(writes)) {
      if (document === null)
        this._committedIdsByTable.get(tableNameOf(id) ?? "")?.delete(id);
      else remember(this._committedIdsByTable, id);
    }
  };
  prototype._iterateDocs = function (
    this: IndexedDatabaseFake,
    tableName: string,
    callback: (document: Record<string, unknown>) => void,
  ) {
    const ids = new Set(committedIds(this).get(tableName));
    for (const writes of this._writes) {
      for (const id of Object.keys(writes)) {
        if (tableNameOf(id) === tableName) ids.add(id);
      }
    }
    for (const id of ids) {
      const document = this.get(tableName, id);
      if (document !== null) callback(document);
    }
  };
  prototype[INDEXED] = true;
}
