import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc } from "../_generated/dataModel";
import { generateNextOrganizationAccountNumber } from "./numberGenerator";

type MutationCtx = GenericMutationCtx<DataModel>;

export async function patchOrganizationTransferFieldsIfMissing(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
): Promise<string | undefined> {
  const patches: {
    accountNumber?: string;
    allowsIncomingTransferRequests?: boolean;
  } = {};

  if (!organization.accountNumber) {
    patches.accountNumber = await generateNextOrganizationAccountNumber(ctx);
  }

  if (organization.allowsIncomingTransferRequests === undefined) {
    patches.allowsIncomingTransferRequests =
      organization.settings?.allowIncomingTransferRequests ?? false;
  }

  if (Object.keys(patches).length === 0) {
    return organization.accountNumber;
  }

  await ctx.db.patch(organization._id, patches);
  return patches.accountNumber ?? organization.accountNumber;
}
