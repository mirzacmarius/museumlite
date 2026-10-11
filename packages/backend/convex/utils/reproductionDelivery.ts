import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  DELIVERY_MAX_ATTEMPTS,
  finishedWithoutSending,
  newDeliveryLedger,
} from "./deliveryLedger";
import type { ReproductionDeliveryErrorCode } from "./reproductionRequestValidators";

export const LICENSED_DERIVATIVE_PATH = "/v1/licensed-derivatives/";
const TOKEN_BYTES = 32;

/** A download link secret; only its hash is stored once the series ends. */
export function newAccessToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function hashAccessToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Whether an approval still lets the requester download its derivative. */
export function grantState(
  decision: Pick<
    Doc<"reproductionDecisions">,
    "approval" | "endedAt" | "endedBy"
  >,
  now: number,
): "active" | "expired" | "revoked" | undefined {
  if (!decision.approval) return undefined;
  if (decision.endedBy !== undefined) return "revoked";
  if (decision.endedAt !== undefined || decision.approval.expiresAt <= now)
    return "expired";
  return "active";
}

/** Records one email of the approval to the requester and schedules it. */
export async function queueDelivery(
  ctx: MutationCtx,
  request: Doc<"reproductionRequests">,
  decisionId: Id<"reproductionDecisions">,
  userId: Id<"users">,
) {
  const deliveryId = await ctx.db.insert("reproductionDeliveries", {
    organizationId: request.organizationId,
    requestId: request._id,
    decisionId,
    recipientEmail: request.requesterEmail,
    locale: request.requesterLocale,
    ...newDeliveryLedger(DELIVERY_MAX_ATTEMPTS, Date.now()),
    createdBy: userId,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.reproductionDeliveriesActions.attemptDelivery,
    { deliveryId, attempt: 1 },
  );
  return deliveryId;
}

/** Ends a delivery without sending, forgetting its unsent link. */
export async function finishDeliveryWithoutSending(
  ctx: MutationCtx,
  delivery: Doc<"reproductionDeliveries">,
  status: "cancelled" | "failed_transient",
  errorCode: ReproductionDeliveryErrorCode,
) {
  await ctx.db.patch(delivery._id, {
    ...finishedWithoutSending(status, Date.now()),
    lastErrorCode: errorCode,
    pendingToken: undefined,
  });
}
