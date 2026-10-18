import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { authedForUser } from "./testHarness";

type WorkColumn = FunctionReturnType<typeof api.workBoard.get>[number];
type ColumnKey = WorkColumn["key"];

/** One column of the viewer's Work board, or undefined when it is left out. */
export async function workColumn<Key extends ColumnKey>(
  client: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
  key: Key,
  limits?: Partial<Record<ColumnKey, number>>,
) {
  const columns = await client.query(api.workBoard.get, {
    organizationId,
    now: Date.now(),
    limits,
  });
  return columns.find(
    (column): column is Extract<WorkColumn, { key: Key }> => column.key === key,
  );
}

/** The open Tasks the viewer owns, soonest due first, as their Work board lists them. */
export async function myTasks(
  client: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
) {
  const tasks = await workColumn(client, organizationId, "tasks");
  if (!tasks) throw new Error("Every member's Work board has a tasks column");
  return tasks.cards;
}
