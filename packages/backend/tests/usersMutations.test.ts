import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

describe("usersMutations", () => {
  test("relinkUserAuthRecords moves orphaned auth and membership rows", async () => {
    const t = convexTest(schema, modules);

    const {
      accountId,
      organizationId,
      sourceUserId,
      targetUserId,
      userOrganizationId,
    } = await t.run(async (ctx) => {
      const sourceUserId = await ctx.db.insert("users", {
        email: "orphan-source@test.com",
      });
      const targetUserId = await ctx.db.insert("users", {
        email: "orphan-target@test.com",
      });
      const organizationId = await ctx.db.insert("organizations", {
        name: "Relink Test Org",
        slug: "relink-test-org",
        type: "museum",
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "member",
        isSystemRole: true,
      });
      const userOrganizationId = await ctx.db.insert("userOrganizations", {
        userId: sourceUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      const accountId = await ctx.db.insert("authAccounts", {
        userId: sourceUserId,
        provider: "resend-otp",
        providerAccountId: "orphan-target@test.com",
      });

      return {
        accountId,
        organizationId,
        sourceUserId,
        targetUserId,
        userOrganizationId,
      };
    });

    const result = await t.mutation(
      internal.usersMutations.relinkUserAuthRecords,
      {
        sourceUserId,
        targetUserId,
      },
    );

    expect(result).toEqual({
      authAccountsUpdated: 1,
      userOrganizationsUpdated: 1,
    });

    const updated = await t.run(async (ctx) => {
      return {
        account: await ctx.db.get(accountId),
        membership: await ctx.db.get(userOrganizationId),
      };
    });

    expect(updated.account).toEqual(
      expect.objectContaining({ userId: targetUserId }),
    );
    expect(updated.membership).toEqual(
      expect.objectContaining({
        organizationId,
        userId: targetUserId,
      }),
    );
  });

  test("deleteUserAccount removes auth and organization records", async () => {
    const t = convexTest(schema, modules);

    const {
      accountId,
      organizationId,
      refreshTokenId,
      sessionId,
      userId,
      userOrganizationId,
      verificationCodeId,
    } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "deleted-user@test.com",
      });
      const organizationId = await ctx.db.insert("organizations", {
        name: "Delete Test Org",
        slug: "delete-test-org",
        type: "museum",
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "member",
        isSystemRole: true,
      });
      const userOrganizationId = await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 60_000,
      });
      const refreshTokenId = await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 60_000,
      });
      const accountId = await ctx.db.insert("authAccounts", {
        userId,
        provider: "resend-otp",
        providerAccountId: "deleted-user@test.com",
      });
      const verificationCodeId = await ctx.db.insert("authVerificationCodes", {
        accountId,
        provider: "resend-otp",
        code: "hashed-code",
        expirationTime: Date.now() + 60_000,
        emailVerified: "deleted-user@test.com",
      });

      return {
        accountId,
        organizationId,
        refreshTokenId,
        sessionId,
        userId,
        userOrganizationId,
        verificationCodeId,
      };
    });

    await t.mutation(internal.usersMutations.deleteUserAccount, { userId });

    const remaining = await t.run(async (ctx) => {
      return {
        account: await ctx.db.get(accountId),
        organization: await ctx.db.get(organizationId),
        refreshToken: await ctx.db.get(refreshTokenId),
        session: await ctx.db.get(sessionId),
        user: await ctx.db.get(userId),
        userOrganization: await ctx.db.get(userOrganizationId),
        verificationCode: await ctx.db.get(verificationCodeId),
      };
    });

    expect(remaining).toEqual({
      account: null,
      organization: expect.objectContaining({ _id: organizationId }),
      refreshToken: null,
      session: null,
      user: null,
      userOrganization: null,
      verificationCode: null,
    });
  });
});
