import { expect, test } from "vitest";
import polarSchema from "../../../node_modules/@convex-dev/polar/src/component/schema";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

const polarModules = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      "../../../node_modules/@convex-dev/polar/src/component/**/*.{ts,js}",
    ),
  ).filter(([path]) => !path.endsWith(".d.ts")),
);

test("closing a staff account revokes access while historical actor identity stays readable", async () => {
  const t = createConvexTest();
  t.registerComponent("polar", polarSchema, polarModules);
  const { organizationId, collectionId, userId, roleId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.delete", "organization.view_analytics"],
      { userName: "Historic Registrar" },
    );
  const readerId = await t.run(async (ctx) => {
    const readerId = await ctx.db.insert("users", {
      name: "Remaining registrar",
    });
    await ctx.db.insert("userOrganizations", {
      userId: readerId,
      organizationId,
      roleId,
      joinedAt: 100,
    });
    return readerId;
  });
  const staff = authedForUser(t, userId);
  await staff.mutation(api.collections.archiveCollection, {
    collectionId,
    reason: "Retained historical record",
  });
  await staff.action(api.users.deleteCurrentUserAccount, {});
  const reader = authedForUser(t, readerId);
  const history = await reader.query(api.auditLog.list, { organizationId });
  expect(
    history.entries.find((entry) => entry.action === "archived_collection"),
  ).toMatchObject({ userId, userName: "Historic Registrar" });
  expect(await staff.query(api.users.getUser, {})).toBeNull();
  await expect(
    staff.query(api.collections.get, { collectionId }),
  ).rejects.toThrow();
});
