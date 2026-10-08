import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "../_generated/dataModel";
import {
  type MutationCtx,
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "../_generated/server";
import { handleSourceChange } from "./projectionMaintenance";
import {
  PROJECTION_PHASES,
  type ProjectionSourceDoc,
} from "./projectionSources";

/**
 * Every production mutation is registered through these builders so writes to
 * projection source tables update maintained projections in the same
 * transaction. `tests/mutationBuilders.test.ts` rejects raw builder imports.
 */
export const projectionTriggers = new Triggers<DataModel, MutationCtx>();

for (const table of PROJECTION_PHASES) {
  projectionTriggers.register(table, async (ctx, change) => {
    await handleSourceChange(
      ctx,
      table,
      change.id,
      change.oldDoc as ProjectionSourceDoc | null,
      change.newDoc as ProjectionSourceDoc | null,
    );
  });
}

export const withProjectionTriggers = <C extends MutationCtx>(ctx: C): C =>
  projectionTriggers.wrapDB(ctx);

export const mutation = customMutation(
  rawMutation,
  customCtx(withProjectionTriggers),
);

export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(withProjectionTriggers),
);
