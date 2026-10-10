import { type Infer, v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/**
 * The at-least-once delivery ledger of ADR 0004, shared by every outgoing
 * channel (webhooks, notification email). A channel adds its own table, the
 * reasons a delivery can be cancelled, and the send itself.
 *
 * `pending` waits for its next attempt. The other states are terminal until
 * someone retries: `failed_transient` used up its attempts on retryable
 * failures, `failed_permanent` was refused or is unsendable, and `cancelled`
 * was never sent because the destination was revoked.
 */
export const deliveryStatus = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed_transient"),
  v.literal("failed_permanent"),
  v.literal("cancelled"),
);
export type DeliveryStatus = Infer<typeof deliveryStatus>;

export const attemptOutcome = v.union(
  v.literal("succeeded"),
  v.literal("failed_transient"),
  v.literal("failed_permanent"),
);
export type AttemptOutcome = Infer<typeof attemptOutcome>;

/** Fields of a delivery row that the ledger maintains. */
export const deliveryLedgerFields = {
  status: deliveryStatus,
  /** Attempts sent across every attempt series; never decreases. */
  attemptCount: v.number(),
  /** `attemptCount` when the current series began (0, or at a manual retry). */
  seriesStartAttempt: v.number(),
  /** Attempts allowed in the current series. */
  maxAttempts: v.number(),
  /** Due time of the next attempt, or lease expiry while one is in flight. */
  nextAttemptAt: v.optional(v.number()),
  inFlightSince: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastResponseStatus: v.optional(v.number()),
  retryCount: v.number(),
  lastRetriedBy: v.optional(v.id("users")),
  completedAt: v.optional(v.number()),
};

/** Fields of an attempt row that the ledger maintains. */
export const deliveryAttemptLedgerFields = {
  attemptNumber: v.number(),
  startedAt: v.number(),
  durationMs: v.number(),
  outcome: attemptOutcome,
  responseStatus: v.optional(v.number()),
};

export interface DeliveryLedger {
  status: DeliveryStatus;
  attemptCount: number;
  seriesStartAttempt: number;
  maxAttempts: number;
  nextAttemptAt?: number;
  inFlightSince?: number;
  lastAttemptAt?: number;
  lastResponseStatus?: number;
  retryCount: number;
  lastRetriedBy?: Id<"users">;
  completedAt?: number;
}

export const DELIVERY_MAX_ATTEMPTS = 6;
export const DELIVERY_REQUEST_TIMEOUT_MS = 10_000;
/** How long a claimed attempt may stay unreported before the sweep retries it. */
export const DELIVERY_ATTEMPT_LEASE_MS = 2 * 60_000;
/** How late a pending attempt may run before the sweep schedules it again. */
export const DELIVERY_SWEEP_GRACE_MS = 5 * 60_000;
export const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60_000;

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_FACTOR = 4;
const BACKOFF_CAP_MS = 2 * 60 * 60_000;

/**
 * Delay before the next attempt after `failedInSeries` consecutive failures:
 * 30s, 2m, 8m, 32m, then 2h, each with +/-20% jitter.
 */
export function retryDelayMs(failedInSeries: number, random = Math.random()) {
  const exponent = Math.max(0, failedInSeries - 1);
  const base = Math.min(
    BACKOFF_BASE_MS * BACKOFF_FACTOR ** exponent,
    BACKOFF_CAP_MS,
  );
  return Math.round(base * (0.8 + 0.4 * random));
}

export function newDeliveryLedger(maxAttempts: number, now: number) {
  return {
    status: "pending" as const,
    attemptCount: 0,
    seriesStartAttempt: 0,
    maxAttempts,
    nextAttemptAt: now,
    retryCount: 0,
  };
}

/** Derived view of a delivery's progress for inspection screens. */
export function ledgerProgress(delivery: DeliveryLedger) {
  return {
    seriesAttempts: delivery.attemptCount - delivery.seriesStartAttempt,
    inFlight: delivery.inFlightSince !== undefined,
    nextAttemptAt:
      delivery.status === "pending" && delivery.inFlightSince === undefined
        ? delivery.nextAttemptAt
        : undefined,
  };
}

/** An attempt that was claimed but never reported back. */
export interface LostAttempt {
  attemptNumber: number;
  startedAt: number;
  durationMs: number;
  outcome: "failed_transient";
  errorCode: "attempt_lost";
}

export type ClaimStep =
  | { kind: "stale" }
  | { kind: "exhausted"; lostAttempt?: LostAttempt }
  | {
      kind: "claim";
      lostAttempt?: LostAttempt;
      patch: {
        attemptCount: number;
        inFlightSince: number;
        lastAttemptAt: number;
        nextAttemptAt: number;
      };
    };

/**
 * Whether attempt `attempt` may be sent now. Anything other than the next
 * attempt of a pending delivery (a finished delivery, a duplicate or stale
 * scheduled run) is stale. A previous attempt still marked in flight is
 * recorded as lost.
 */
export function claimStep(
  delivery: DeliveryLedger,
  attempt: number,
  now: number,
): ClaimStep {
  if (delivery.status !== "pending" || attempt !== delivery.attemptCount + 1) {
    return { kind: "stale" };
  }
  const lostAttempt: LostAttempt | undefined =
    delivery.inFlightSince === undefined
      ? undefined
      : {
          attemptNumber: delivery.attemptCount,
          startedAt: delivery.inFlightSince,
          durationMs: now - delivery.inFlightSince,
          outcome: "failed_transient",
          errorCode: "attempt_lost",
        };
  if (
    delivery.attemptCount - delivery.seriesStartAttempt >=
    delivery.maxAttempts
  ) {
    return { kind: "exhausted", lostAttempt };
  }
  return {
    kind: "claim",
    lostAttempt,
    patch: {
      attemptCount: attempt,
      inFlightSince: now,
      lastAttemptAt: now,
      nextAttemptAt: now + DELIVERY_ATTEMPT_LEASE_MS,
    },
  };
}

/** Ends a delivery that will not be sent; the caller adds its reason. */
export function finishedWithoutSending(
  status: "cancelled" | "failed_permanent" | "failed_transient",
  now: number,
) {
  return {
    status,
    lastResponseStatus: undefined,
    nextAttemptAt: undefined,
    inFlightSince: undefined,
    completedAt: now,
  };
}

export type ResultStep =
  | { kind: "stale" }
  | {
      kind: "retry";
      nextAttemptAt: number;
      patch: {
        inFlightSince: undefined;
        lastResponseStatus: number | undefined;
        nextAttemptAt: number;
      };
    }
  | {
      kind: "finish";
      patch: {
        status: AttemptOutcome;
        inFlightSince: undefined;
        lastResponseStatus: number | undefined;
        nextAttemptAt: undefined;
        completedAt: number;
      };
    };

/**
 * What the result of attempt `attempt` does to the delivery: retry with
 * backoff while retryable failures remain in the series, otherwise finish.
 * Results for any attempt other than the one in flight are stale.
 */
export function resultStep(
  delivery: DeliveryLedger,
  result: {
    attempt: number;
    outcome: AttemptOutcome;
    responseStatus?: number;
  },
  now: number,
): ResultStep {
  if (
    delivery.status !== "pending" ||
    delivery.inFlightSince === undefined ||
    result.attempt !== delivery.attemptCount
  ) {
    return { kind: "stale" };
  }
  const attemptsInSeries = delivery.attemptCount - delivery.seriesStartAttempt;
  if (
    result.outcome === "failed_transient" &&
    attemptsInSeries < delivery.maxAttempts
  ) {
    const nextAttemptAt = now + retryDelayMs(attemptsInSeries);
    return {
      kind: "retry",
      nextAttemptAt,
      patch: {
        inFlightSince: undefined,
        lastResponseStatus: result.responseStatus,
        nextAttemptAt,
      },
    };
  }
  return {
    kind: "finish",
    patch: {
      status: result.outcome,
      inFlightSince: undefined,
      lastResponseStatus: result.responseStatus,
      nextAttemptAt: undefined,
      completedAt: now,
    },
  };
}

export function isRetryableStatus(status: DeliveryStatus) {
  return status !== "pending" && status !== "succeeded";
}

/**
 * Starts a new attempt series on a finished delivery. Its id and captured
 * content are unchanged, so receivers can still deduplicate.
 */
export function retrySeriesPatch(
  delivery: DeliveryLedger,
  retriedBy: Id<"users">,
  maxAttempts: number,
  now: number,
) {
  return {
    status: "pending" as const,
    seriesStartAttempt: delivery.attemptCount,
    maxAttempts,
    nextAttemptAt: now,
    inFlightSince: undefined,
    completedAt: undefined,
    retryCount: delivery.retryCount + 1,
    lastRetriedBy: retriedBy,
  };
}

export type AttemptResult =
  | { kind: "response"; status: number; body?: unknown }
  | { kind: "timeout" }
  | { kind: "network_error" };

export interface ClassifiedAttempt {
  outcome: AttemptOutcome;
  responseStatus?: number;
  errorCode?: "http_error" | "timeout" | "network_error";
}

/**
 * 2xx succeeds; 408, 429, 5xx, timeouts and network errors are retried.
 * Redirects are not followed and, like other responses, fail permanently.
 */
export function classifyAttempt(result: AttemptResult): ClassifiedAttempt {
  if (result.kind === "timeout") {
    return { outcome: "failed_transient", errorCode: "timeout" };
  }
  if (result.kind === "network_error") {
    return { outcome: "failed_transient", errorCode: "network_error" };
  }
  const { status } = result;
  if (status >= 200 && status < 300) {
    return { outcome: "succeeded", responseStatus: status };
  }
  const retryable = status === 408 || status === 429 || status >= 500;
  return {
    outcome: retryable ? "failed_transient" : "failed_permanent",
    responseStatus: status,
    errorCode: "http_error",
  };
}

/**
 * POSTs one attempt without following redirects, giving up after
 * `DELIVERY_REQUEST_TIMEOUT_MS`. `readJson` also reads a JSON response body
 * within the same deadline.
 */
export async function postWithTimeout(
  url: string,
  request: { headers: Record<string, string>; body: string },
  options: { readJson?: boolean } = {},
): Promise<AttemptResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    DELIVERY_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      redirect: "manual",
      signal: controller.signal,
    });
    const body: unknown = options.readJson
      ? await response.json().catch(() => undefined)
      : undefined;
    return { kind: "response", status: response.status, body };
  } catch {
    return controller.signal.aborted
      ? { kind: "timeout" }
      : { kind: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
