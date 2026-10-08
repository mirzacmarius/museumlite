import { expect, test } from "vitest";
import schema from "../convex/schema";

type ExportedTable = {
  tableName: string;
  indexes: { indexDescriptor: string }[];
  searchIndexes: { indexDescriptor: string }[];
  vectorIndexes?: { indexDescriptor: string }[];
};

// The Convex deployment rejects a schema push when a table declares an index
// name twice (IndexNamesNotUnique). convex-test and tsc accept it, so the
// rehearsal deploy was the first place it surfaced.
test("every table declares each index name at most once, so the schema can be pushed", () => {
  const { tables } = JSON.parse(schema.export()) as { tables: ExportedTable[] };
  const duplicates = tables.flatMap((table) => {
    const names = [
      ...table.indexes,
      ...table.searchIndexes,
      ...(table.vectorIndexes ?? []),
    ].map((index) => index.indexDescriptor);
    return names
      .filter((name, position) => names.indexOf(name) !== position)
      .map((name) => `${table.tableName}.${name}`);
  });
  expect(duplicates).toEqual([]);
});
