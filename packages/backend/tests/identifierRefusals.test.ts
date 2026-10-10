import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { identifierErrorFromError } from "../convex/utils/identifierErrors";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function catalogDesk() {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
    { subscriptionTier: "pro" },
  );
  return { t, organizationId, userId, client: authedForUser(t, userId) };
}

/** The coded refusal a rejected call carries, so the app can translate it. */
async function identifierRefusal(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return identifierErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

test("a number already used in the catalog is refused with the number and register", async () => {
  const { organizationId, client } = await catalogDesk();
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "2026.14.1",
    title: "Silver beaker",
  });

  const refusal = await identifierRefusal(
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "2026.14.1",
      title: "Pewter plate",
    }),
  );
  expect(refusal).toMatchObject({
    code: "IDENTIFIER_IN_USE",
    register: "catalog",
    identifier: "2026.14.1",
  });
});

test("a number longer than 256 characters is refused as invalid", async () => {
  const { organizationId, client } = await catalogDesk();

  const refusal = await identifierRefusal(
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "9".repeat(257),
      title: "Untitled sherd",
    }),
  );
  expect(refusal?.code).toBe("IDENTIFIER_INVALID");
});

test("generating a number without a configured format is refused as not configured", async () => {
  const { organizationId, client } = await catalogDesk();

  const refusal = await identifierRefusal(
    client.mutation(api.collections.create, {
      organizationId,
      title: "Object awaiting a number",
    }),
  );
  expect(refusal).toMatchObject({
    code: "NUMBERING_NOT_CONFIGURED",
    register: "catalog",
  });
});
