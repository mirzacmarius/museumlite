import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type SessionView = NonNullable<
  FunctionReturnType<typeof api.inventory.getSession>
>;
