import sharp from "sharp";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { reproductionErrorCodeFromError } from "../convex/utils/reproductionRequestErrors";
import { addMember } from "./notificationFixtures";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const RIGHTS_MANAGER = [
  "media.read",
  "media.upload",
  "accounts.read",
  "organization.manage_settings",
];

async function reproductionErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return reproductionErrorCodeFromError(error) ?? error;
  }
  throw new Error("Expected the call to be rejected");
}

/** A museum with one Object, one verified image of it and one requester Party. */
async function createMuseum(t: ConvexTest) {
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    RIGHTS_MANAGER,
    { enabledModules: ["accounts"] },
  );
  const original = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: "#204060" },
  })
    .png()
    .toBuffer();
  const ids = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(original)], { type: "image/png" }),
    );
    const mediaId = await ctx.db.insert("mediaFiles", {
      organizationId: setup.organizationId,
      collectionId: setup.collectionId,
      storageId,
      fileName: "original.png",
      fileType: "image",
      fileSize: original.length,
      mimeType: "image/png",
      rightsStatus: "restricted",
      isPrimary: true,
      uploadedBy: setup.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
    await ctx.db.insert("storageOwnership", {
      storageId,
      organizationId: setup.organizationId,
      uploadedBy: setup.userId,
      uploadedAt: Date.now(),
      ownerType: "media",
      ownerId: mediaId,
    });
    const requesterId = await ctx.db.insert("accounts", {
      organizationId: setup.organizationId,
      accountNumber: "ACC-0001",
      accountType: "institution",
      holderType: "privatePerson",
      businessName: "Ada Researcher",
      email: "ada@university.example",
      createdBy: setup.userId,
      createdAt: Date.now(),
    });
    return { mediaId, storageId, requesterId };
  });
  return { ...setup, ...ids, staff: authedForUser(t, setup.userId) };
}

test("staff record who asks for which image and why, and outsiders learn nothing", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);

  const { requestId, requestNumber } = await museum.staff.mutation(
    api.reproductionRequests.create,
    {
      organizationId: museum.organizationId,
      objectId: museum.collectionId,
      mediaId: museum.mediaId,
      requesterAccountId: museum.requesterId,
      purpose: "academic_publication",
      purposeDetails: "Figure 3 in a journal article on harbour trade",
      requesterLocale: "en",
    },
  );

  expect(requestNumber).toBe(`RR-${new Date().getUTCFullYear()}-0001`);
  expect(
    await museum.staff.query(api.reproductionRequests.get, { requestId }),
  ).toMatchObject({
    request: {
      requestNumber,
      status: "open",
      purpose: "academic_publication",
      purposeDetails: "Figure 3 in a journal article on harbour trade",
      requester: {
        accountId: museum.requesterId,
        name: "Ada Researcher",
        email: "ada@university.example",
      },
      object: { _id: museum.collectionId },
      media: { _id: museum.mediaId, fileName: "original.png" },
    },
  });

  const outsider = await createOrgUserCollectionWithPermissions(
    t,
    RIGHTS_MANAGER,
    { enabledModules: ["accounts"] },
  );
  const outsiderClient = authedForUser(t, outsider.userId);
  expect(
    await outsiderClient.query(api.reproductionRequests.get, { requestId }),
  ).toBeNull();
  await expect(
    outsiderClient.mutation(api.reproductionRequests.create, {
      organizationId: outsider.organizationId,
      objectId: outsider.collectionId,
      mediaId: museum.mediaId,
      requesterAccountId: museum.requesterId,
      purpose: "private_study",
      purposeDetails: "Foreign image",
      requesterLocale: "en",
    }),
  ).rejects.toThrow();

  const viewerId = await addMember(t, museum.organizationId, "viewer", [
    "media.read",
  ]);
  expect(
    await capabilityFailureOf(
      authedForUser(t, viewerId).query(api.reproductionRequests.get, {
        requestId,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });
});

async function openRequest(
  t: ConvexTest,
  museum: Awaited<ReturnType<typeof createMuseum>>,
) {
  return await museum.staff.mutation(api.reproductionRequests.create, {
    organizationId: museum.organizationId,
    objectId: museum.collectionId,
    mediaId: museum.mediaId,
    requesterAccountId: museum.requesterId,
    purpose: "commercial_publication",
    purposeDetails: "Book cover, print run of 2,000",
    requesterLocale: "en",
  });
}

test("rights evidence is kept when retracted and may cite only a document of the same Object", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const { requestId } = await openRequest(t, museum);
  const { documentId, foreignDocumentId } = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["signed permission"], { type: "application/pdf" }),
    );
    const document = {
      organizationId: museum.organizationId,
      collectionId: museum.collectionId,
      storageId,
      fileName: "permission.pdf",
      fileType: "document",
      mediaCategory: "document" as const,
      fileSize: 17,
      mimeType: "application/pdf",
      isPrimary: false,
      uploadedBy: museum.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed" as const,
    };
    const documentId = await ctx.db.insert("mediaFiles", document);
    const otherObjectId = await ctx.db.insert("collections", {
      organizationId: museum.organizationId,
      accessionNumber: "OBJ-OTHER",
      title: "Other Object",
      status: "active",
      catalogedBy: museum.userId,
      catalogedAt: Date.now(),
    });
    const foreignDocumentId = await ctx.db.insert("mediaFiles", {
      ...document,
      collectionId: otherObjectId,
    });
    return { documentId, foreignDocumentId };
  });

  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.addEvidence, {
        requestId,
        kind: "rights_holder_permission",
        summary: "Permission letter",
        documentMediaId: foreignDocumentId,
      }),
    ),
  ).toBe("EVIDENCE_DOCUMENT_INVALID");
  const evidenceId = await museum.staff.mutation(
    api.reproductionRequests.addEvidence,
    {
      requestId,
      kind: "rights_holder_permission",
      summary: "Estate of the photographer granted print use on 2026-09-30",
      documentMediaId: documentId,
    },
  );
  await museum.staff.mutation(api.reproductionRequests.retractEvidence, {
    evidenceId,
    reason: "Letter covers the wrong photograph",
  });

  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  expect(view?.evidence).toEqual([
    expect.objectContaining({
      _id: evidenceId,
      kind: "rights_holder_permission",
      summary: "Estate of the photographer granted print use on 2026-09-30",
      document: { _id: documentId, fileName: "permission.pdf" },
      retracted: expect.objectContaining({
        reason: "Letter covers the wrong photograph",
      }),
    }),
  ]);

  const readerId = await addMember(t, museum.organizationId, "reader", [
    "media.read",
    "accounts.read",
  ]);
  expect(
    await capabilityFailureOf(
      authedForUser(t, readerId).mutation(
        api.reproductionRequests.addEvidence,
        { requestId, kind: "other", summary: "Not allowed" },
      ),
    ),
  ).toMatchObject({ reason: "permission_missing" });
});

async function blobBytes(t: ConvexTest, storageId: Id<"_storage">) {
  const bytes = await t.run(async (ctx) => {
    const blob = await ctx.storage.get(storageId);
    return blob ? await blob.arrayBuffer() : null;
  });
  return bytes ? Buffer.from(bytes) : null;
}

test("a Licensed derivative is a bounded JPEG made from the verified image, never the original", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const { requestId } = await openRequest(t, museum);

  await museum.staff.mutation(api.reproductionRequests.prepareDerivative, {
    requestId,
    maxDimension: 1200,
  });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.prepareDerivative, {
        requestId,
        maxDimension: 2400,
      }),
    ),
  ).toBe("DERIVATIVE_IN_PROGRESS");
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  const [derivative] = view?.derivatives ?? [];
  expect(derivative).toMatchObject({
    status: "ready",
    maxDimension: 1200,
    width: 1200,
    height: 600,
  });
  const storageId = await t.run(
    async (ctx) =>
      derivative && (await ctx.db.get(derivative._id))?.storageId,
  );
  if (!storageId) throw new Error("Derivative was not stored");
  expect(storageId).not.toBe(museum.storageId);
  const bytes = await blobBytes(t, storageId);
  expect((await sharp(bytes ?? Buffer.alloc(0)).metadata()).format).toBe(
    "jpeg",
  );

  await t.run(async (ctx) => {
    const ownership = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", museum.storageId))
      .unique();
    if (ownership) await ctx.db.delete(ownership._id);
  });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.prepareDerivative, {
        requestId,
        maxDimension: 2400,
      }),
    ),
  ).toBe("IMAGE_SOURCE_UNVERIFIED");
});

test("a derivative that cannot be made is reported failed and can be prepared again", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const { requestId } = await openRequest(t, museum);
  const original = await blobBytes(t, museum.storageId);
  const corruptId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["not an image"], { type: "image/png" })),
  );
  await t.run(async (ctx) => {
    await ctx.db.patch(museum.mediaId, { storageId: corruptId });
    const ownership = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", museum.storageId))
      .unique();
    if (ownership) await ctx.db.patch(ownership._id, { storageId: corruptId });
  });

  await museum.staff.mutation(api.reproductionRequests.prepareDerivative, {
    requestId,
    maxDimension: 1200,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.derivatives,
  ).toEqual([expect.objectContaining({ status: "failed" })]);

  await t.run(async (ctx) => {
    const fixedId = await ctx.storage.store(
      new Blob([new Uint8Array(original ?? Buffer.alloc(0))], {
        type: "image/png",
      }),
    );
    await ctx.db.patch(museum.mediaId, { storageId: fixedId });
    const ownership = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", corruptId))
      .unique();
    if (ownership) await ctx.db.patch(ownership._id, { storageId: fixedId });
  });
  await museum.staff.mutation(api.reproductionRequests.prepareDerivative, {
    requestId,
    maxDimension: 1200,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const statuses = (
    await museum.staff.query(api.reproductionRequests.get, { requestId })
  )?.derivatives.map((derivative) => derivative.status);
  expect(statuses).toEqual(["ready", "failed"]);
});

const DAY = 24 * 60 * 60 * 1000;

/** An open request with one evidence entry and a ready derivative. */
async function preparedRequest(
  t: ConvexTest,
  museum: Awaited<ReturnType<typeof createMuseum>>,
) {
  const { requestId, requestNumber } = await openRequest(t, museum);
  const evidenceId = await museum.staff.mutation(
    api.reproductionRequests.addEvidence,
    {
      requestId,
      kind: "institutional_ownership",
      summary: "Museum photograph; copyright assigned by staff contract",
    },
  );
  const derivativeId = await museum.staff.mutation(
    api.reproductionRequests.prepareDerivative,
    { requestId, maxDimension: 1200 },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { requestId, requestNumber, evidenceId, derivativeId };
}

async function publishTerms(
  museum: Awaited<ReturnType<typeof createMuseum>>,
  body: string,
) {
  return await museum.staff.mutation(api.reproductionRequests.publishTerms, {
    organizationId: museum.organizationId,
    title: "Image licence",
    body,
  });
}

test("approval records the rights evidence, the terms version and the expiry it was decided on", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const prepared = await preparedRequest(t, museum);
  const { requestId, derivativeId } = prepared;
  const approval = {
    requestId,
    derivativeId,
    expiresAt: Date.now() + 30 * DAY,
  };

  const otherMuseum = await createMuseum(t);
  const foreignTerms = await publishTerms(otherMuseum, "Another museum's text.");
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.approve, {
        ...approval,
        termsId: foreignTerms.termsId,
      }),
    ),
  ).toBe("TERMS_NOT_PUBLISHED");
  const first = await publishTerms(museum, "One print edition only.");
  const second = await publishTerms(museum, "One print edition; credit the museum.");
  expect([first.version, second.version]).toEqual([1, 2]);
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.approve, {
        ...approval,
        termsId: first.termsId,
      }),
    ),
  ).toBe("TERMS_OUTDATED");
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.approve, {
        ...approval,
        termsId: second.termsId,
        expiresAt: Date.now() - 1,
      }),
    ),
  ).toBe("EXPIRY_INVALID");

  const preparerId = await addMember(t, museum.organizationId, "preparer", [
    "media.read",
    "media.upload",
    "accounts.read",
  ]);
  expect(
    await capabilityFailureOf(
      authedForUser(t, preparerId).mutation(api.reproductionRequests.approve, {
        ...approval,
        termsId: second.termsId,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });

  await museum.staff.mutation(api.reproductionRequests.approve, {
    ...approval,
    termsId: second.termsId,
  });
  await publishTerms(museum, "A later text that this approval never saw.");

  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  expect(view?.request.status).toBe("approved");
  expect(view?.decision).toMatchObject({
    outcome: "approved",
    rights: { rightsStatus: "restricted" },
    evidenceIds: [prepared.evidenceId],
    approval: {
      derivativeId,
      termsVersion: 2,
      termsBody: "One print edition; credit the museum.",
      expiresAt: approval.expiresAt,
    },
    grant: "active",
  });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.addEvidence, {
        requestId,
        kind: "other",
        summary: "Too late",
      }),
    ),
  ).toBe("REQUEST_NOT_OPEN");

  const history = await museum.staff.query(api.partyLinks.listForAccount, {
    accountId: museum.requesterId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page).toEqual([
    expect.objectContaining({
      role: "requester",
      targetType: "reproductionRequest",
      targetLabel: prepared.requestNumber,
    }),
  ]);
});

test("approval needs active evidence and a ready derivative; refusal needs only a reason", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const { termsId } = await publishTerms(museum, "Study use only.");
  const { requestId, evidenceId, derivativeId } = await preparedRequest(
    t,
    museum,
  );
  await museum.staff.mutation(api.reproductionRequests.retractEvidence, {
    evidenceId,
    reason: "Contract does not cover this photograph",
  });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.approve, {
        requestId,
        derivativeId,
        termsId,
        expiresAt: Date.now() + DAY,
      }),
    ),
  ).toBe("EVIDENCE_REQUIRED");

  const other = await openRequest(t, museum);
  await museum.staff.mutation(api.reproductionRequests.addEvidence, {
    requestId: other.requestId,
    kind: "license",
    summary: "Licence on file",
  });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.approve, {
        requestId: other.requestId,
        derivativeId,
        termsId,
        expiresAt: Date.now() + DAY,
      }),
    ),
  ).toBe("DERIVATIVE_NOT_READY");

  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.refuse, {
        requestId,
        reason: "  ",
      }),
    ),
  ).toBe("REASON_REQUIRED");
  await museum.staff.mutation(api.reproductionRequests.refuse, {
    requestId,
    reason: "The photographer's estate has not granted reproduction rights",
  });
  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  expect(view?.request.status).toBe("refused");
  expect(view?.decision).toMatchObject({
    outcome: "refused",
    reason: "The photographer's estate has not granted reproduction rights",
    evidenceIds: [],
  });
  expect(view?.deliveries).toEqual([]);
});

/**
 * Runs scheduled work due within `horizonMs` (default 15 minutes, enough for
 * a few delivery retries) without reaching an approval's expiry.
 */
async function settle(t: ConvexTest, horizonMs = 15 * 60 * 1000) {
  const end = Date.now() + horizonMs;
  while (Date.now() < end) {
    await t.finishInProgressScheduledFunctions();
    vi.advanceTimersByTime(5_000);
  }
  await t.finishInProgressScheduledFunctions();
}

type FetchCall = [string, RequestInit | undefined];

function providerRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return (fetchMock.mock.calls as FetchCall[]).map(([, init]) => ({
    idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
    body: JSON.parse(String(init?.body)) as {
      to: string[];
      subject: string;
      text: string;
    },
  }));
}

function providerReplies(...statuses: number[]) {
  const fetchMock = vi.fn();
  for (const status of statuses) {
    fetchMock.mockImplementationOnce(async () =>
      Response.json(
        status === 200 ? { id: "email-1" } : { name: "error" },
        { status },
      ),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function downloadPath(text: string) {
  const match = text.match(
    /https:\/\/example\.convex\.site(\/v1\/licensed-derivatives\/[A-Za-z0-9_-]+)/,
  );
  if (!match?.[1]) throw new Error(`No download link in: ${text}`);
  return match[1];
}

async function approvedRequest(
  t: ConvexTest,
  museum: Awaited<ReturnType<typeof createMuseum>>,
  // Below the 24.8-day timer limit, so the fake clock keeps the expiry.
  expiresInMs = 20 * DAY,
) {
  const { termsId } = await publishTerms(
    museum,
    "One print edition; credit the museum.",
  );
  const prepared = await preparedRequest(t, museum);
  const decisionId = await museum.staff.mutation(
    api.reproductionRequests.approve,
    {
      requestId: prepared.requestId,
      derivativeId: prepared.derivativeId,
      termsId,
      expiresAt: Date.now() + expiresInMs,
    },
  );
  return { ...prepared, decisionId };
}

function enableEmail() {
  vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
  vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "rights@museum.example.test");
}

test("approval emails the requester a link to the derivative only, and each download is a use record", async () => {
  enableEmail();
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const fetchMock = providerReplies(200);
  const { requestId, derivativeId, requestNumber } = await approvedRequest(
    t,
    museum,
  );
  await settle(t);

  const [email] = providerRequests(fetchMock);
  expect(email?.body.to).toEqual(["ada@university.example"]);
  expect(email?.body.text).toContain(requestNumber);
  expect(email?.body.text).toContain("One print edition; credit the museum.");
  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  const [delivery] = view?.deliveries ?? [];
  expect(delivery).toMatchObject({
    status: "succeeded",
    recipientEmail: "ada@university.example",
    attempts: [expect.objectContaining({ outcome: "succeeded" })],
  });
  expect(email?.idempotencyKey).toBe(`${delivery?._id}:0`);

  const path = downloadPath(email?.body.text ?? "");
  const response = await t.fetch(path, { method: "GET" });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const served = Buffer.from(await response.arrayBuffer());
  const derivativeStorageId = await t.run(
    async (ctx) => (await ctx.db.get(derivativeId))?.storageId,
  );
  if (!derivativeStorageId) throw new Error("Derivative missing");
  expect(served.equals((await blobBytes(t, derivativeStorageId)) ?? Buffer.alloc(0))).toBe(true);
  expect(served.equals((await blobBytes(t, museum.storageId)) ?? Buffer.alloc(0))).toBe(false);

  const unknown = await t.fetch(
    "/v1/licensed-derivatives/not-a-real-token-value",
    { method: "GET" },
  );
  expect(unknown.status).toBe(404);
  expect(
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.downloads,
  ).toEqual([expect.objectContaining({ outcome: "served" })]);
});

test("a delivery retries transient failures with the same email and staff can start a new series after a refusal", async () => {
  enableEmail();
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const fetchMock = providerReplies(503, 200, 422, 200);
  const { requestId } = await approvedRequest(t, museum);
  await settle(t);

  const [failed, resent] = providerRequests(fetchMock);
  expect(resent?.idempotencyKey).toBe(failed?.idempotencyKey);
  expect(resent?.body.text).toBe(failed?.body.text);
  let [delivery] =
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.deliveries ?? [];
  expect(delivery?.status).toBe("succeeded");
  expect(delivery?.attempts.map((attempt) => attempt.outcome)).toEqual([
    "succeeded",
    "failed_transient",
  ]);

  // A second delivery (resend) that the provider refuses.
  if (!delivery) throw new Error("Delivery missing");
  await museum.staff.mutation(api.reproductionRequests.resendDelivery, {
    requestId,
  });
  await settle(t);
  const deliveries =
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.deliveries ?? [];
  expect(deliveries.map((item) => item.status)).toEqual([
    "failed_permanent",
    "succeeded",
  ]);
  const refusedId = deliveries[0]?._id;
  if (!refusedId) throw new Error("Refused delivery missing");

  const preparerId = await addMember(t, museum.organizationId, "preparer", [
    "media.read",
    "media.upload",
    "accounts.read",
  ]);
  expect(
    await capabilityFailureOf(
      authedForUser(t, preparerId).mutation(
        api.reproductionRequests.retryDelivery,
        { deliveryId: refusedId },
      ),
    ),
  ).toMatchObject({ reason: "permission_missing" });
  await museum.staff.mutation(api.reproductionRequests.retryDelivery, {
    deliveryId: refusedId,
  });
  await settle(t);
  const requests = providerRequests(fetchMock);
  expect(requests.at(-1)?.idempotencyKey).toBe(`${refusedId}:1`);
  [delivery] =
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.deliveries ?? [];
  expect(delivery).toMatchObject({ status: "succeeded", retryCount: 1 });
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.retryDelivery, {
        deliveryId: refusedId,
      }),
    ),
  ).toBe("DELIVERY_NOT_RETRYABLE");
});

test("revocation stops downloads at once and cancels deliveries not yet sent", async () => {
  enableEmail();
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const fetchMock = providerReplies(200, 503);
  const { requestId } = await approvedRequest(t, museum);
  await settle(t);
  const path = downloadPath(providerRequests(fetchMock)[0]?.body.text ?? "");

  await museum.staff.mutation(api.reproductionRequests.resendDelivery, {
    requestId,
  });
  // The resend's first attempt fails and waits for its retry.
  await settle(t, 5_000);
  const preparerId = await addMember(t, museum.organizationId, "preparer", [
    "media.read",
    "media.upload",
    "accounts.read",
  ]);
  expect(
    await capabilityFailureOf(
      authedForUser(t, preparerId).mutation(api.reproductionRequests.revoke, {
        requestId,
        reason: "Not allowed",
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });
  await museum.staff.mutation(api.reproductionRequests.revoke, {
    requestId,
    reason: "Requester used the image beyond the licence",
  });
  await settle(t);

  const response = await t.fetch(path, { method: "GET" });
  expect(response.status).toBe(410);
  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  expect(view?.request.status).toBe("revoked");
  expect(view?.decision).toMatchObject({
    grant: "revoked",
    ended: { reason: "Requester used the image beyond the licence" },
  });
  expect(view?.deliveries[0]).toMatchObject({
    status: "cancelled",
    lastErrorCode: "grant_inactive",
  });
  expect(view?.downloads).toEqual([
    expect.objectContaining({ outcome: "refused_revoked" }),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.resendDelivery, {
        requestId,
      }),
    ),
  ).toBe("GRANT_NOT_ACTIVE");
});

test("an approval expires at the end of its term and its link stops working", async () => {
  enableEmail();
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const fetchMock = providerReplies(200);
  const { requestId } = await approvedRequest(t, museum, DAY);
  await settle(t, 5_000);
  const path = downloadPath(providerRequests(fetchMock)[0]?.body.text ?? "");
  expect((await t.fetch(path, { method: "GET" })).status).toBe(200);

  vi.advanceTimersByTime(DAY + 1);
  expect((await t.fetch(path, { method: "GET" })).status).toBe(410);
  await settle(t);
  const view = await museum.staff.query(api.reproductionRequests.get, {
    requestId,
  });
  expect(view?.request.status).toBe("expired");
  expect(view?.decision?.grant).toBe("expired");
  expect(view?.downloads.map((download) => download.outcome)).toEqual([
    "refused_expired",
    "served",
  ]);
});

test("without an email channel the delivery is cancelled and cannot be retried until one exists", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const { requestId } = await approvedRequest(t, museum);
  await settle(t);
  const [delivery] =
    (await museum.staff.query(api.reproductionRequests.get, { requestId }))
      ?.deliveries ?? [];
  expect(delivery).toMatchObject({
    status: "cancelled",
    lastErrorCode: "channel_unavailable",
  });
  if (!delivery) throw new Error("Delivery missing");
  expect(
    await reproductionErrorOf(
      museum.staff.mutation(api.reproductionRequests.retryDelivery, {
        deliveryId: delivery._id,
      }),
    ),
  ).toBe("EMAIL_CHANNEL_UNAVAILABLE");
});
