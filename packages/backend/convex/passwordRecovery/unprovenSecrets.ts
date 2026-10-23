import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * A code or link proves the mailbox, not who typed the password at sign-up.
 * Sign-up links a new password account to an existing user whose email is
 * verified, so a password on an unverified account of a verified user may be
 * anyone's. Drop it wherever it could otherwise start working; the mailbox
 * owner sets a password through reset. Returns whether a secret was dropped.
 */
export async function releaseUnprovenSecret(
  ctx: MutationCtx,
  account: Doc<"authAccounts">,
): Promise<boolean> {
  if (account.emailVerified || account.secret === undefined) return false;
  const user = await ctx.db.get(account.userId);
  if (user?.emailVerificationTime === undefined) return false;
  await ctx.db.patch(account._id, { secret: undefined });
  return true;
}
