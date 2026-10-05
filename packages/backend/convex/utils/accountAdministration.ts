import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requirePermission } from "./permissions";

export async function requireAccountAdministration(
  ctx: MutationCtx | QueryCtx,
  account: Pick<Doc<"accounts">, "organizationId" | "accountType">,
) {
  if (account.accountType !== "patron") {
    await requirePermission(
      ctx,
      account.organizationId,
      "organization.manage_settings",
    );
  }
}
