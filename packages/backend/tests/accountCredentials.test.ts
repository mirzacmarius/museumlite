import { generateKeyPairSync } from "node:crypto";
import { Scrypt } from "lucia";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { api, internal } from "../convex/_generated/api";
import { sendEmail } from "../convex/email";
import { authedForUser, createConvexTest } from "./testHarness";

const sent = vi.hoisted(() => ({
  messages: [] as { to: string | string[]; text?: string }[],
  code: "12345678",
}));

vi.mock("../convex/env", () => ({
  env: { RESEND_API_KEY: "test-email-api-key" },
}));

vi.mock("../convex/email", () => ({
  sendEmail: vi.fn(
    async (message: { to: string | string[]; text?: string }) => {
      sent.messages.push(message);
      return { status: "success" };
    },
  ),
}));

vi.mock("../convex/utils/verificationCode", () => ({
  generateVerificationCode: () => sent.code,
}));

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

beforeAll(() => {
  vi.stubEnv("JWT_PRIVATE_KEY", privateKey);
  vi.stubEnv("CONVEX_SITE_URL", "https://museum.convex.site");
  vi.stubEnv("SITE_URL", "https://museum.example.test");
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
});

afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  sent.messages = [];
  sent.code = "12345678";
});

async function setupPasswordUser() {
  const t = createConvexTest();
  const secret = await new Scrypt().hash("original-password");
  const { userId, sessionId, organizationId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "owner@example.test",
      emailVerificationTime: Date.now(),
      name: "Owner",
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86_400_000,
    });
    for (const provider of [
      "password",
      "password-code",
      "password-with-reset",
      "password-link",
    ] as const) {
      await ctx.db.insert("authAccounts", {
        userId,
        provider,
        providerAccountId: "owner@example.test",
        secret,
      });
    }
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "museum-test",
      type: "museum",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Member",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return { userId, sessionId, organizationId };
  });
  return {
    t,
    userId,
    sessionId,
    organizationId,
    authed: authedForUser(t, userId, sessionId),
  };
}

describe("personal account credentials", () => {
  test("changes all linked password providers after current-password proof", async () => {
    const { t, userId, sessionId, authed } = await setupPasswordUser();
    const secondSession = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      }),
    );
    await t.run(async (ctx) => {
      const codeAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password-code"),
        )
        .unique();
      if (!codeAccount) throw new Error("Missing code account");
      await ctx.db.patch(codeAccount._id, {
        secret: await new Scrypt().hash("other-current-password"),
      });
    });
    expect(
      await authed.query(api.users.getAccountCapabilities, {}),
    ).toMatchObject({
      hasPassword: true,
    });
    expect(
      await authed.action(api.accountActions.changePassword, {
        currentPassword: "wrong-password",
        newPassword: "replacement-password",
      }),
    ).toEqual({ status: "invalid_current_password" });
    expect(
      await authed.action(api.accountActions.changePassword, {
        currentPassword: "original-password",
        newPassword: "replacement-password",
      }),
    ).toEqual({ status: "changed" });
    const state = await t.run(async (ctx) => ({
      accounts: await ctx.db.query("authAccounts").collect(),
      currentSession: await ctx.db.get(sessionId),
      secondSession: await ctx.db.get(secondSession),
    }));
    expect(state.currentSession).not.toBeNull();
    expect(state.secondSession).toBeNull();
    for (const account of state.accounts) {
      expect(
        await new Scrypt().verify(account.secret ?? "", "replacement-password"),
      ).toBe(true);
      expect(
        await new Scrypt().verify(account.secret ?? "", "original-password"),
      ).toBe(false);
    }
    const signIn = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        email: "owner@example.test",
        password: "replacement-password",
        flow: "signIn",
      },
    });
    expect(signIn.tokens?.token).toEqual(expect.any(String));
  }, 20_000);

  test("stale password snapshots cannot overwrite a newer secret", async () => {
    const { t, userId, authed } = await setupPasswordUser();
    const original = await t.run(async (ctx) => {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect();
      return accounts.map((account) => ({
        accountId: account._id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        secret: account.secret ?? "",
      }));
    });
    await t.run(async (ctx) => {
      const account = original[0];
      if (!account) throw new Error("Missing account");
      await ctx.db.patch(account.accountId, {
        secret: await new Scrypt().hash("concurrent-password"),
      });
    });
    await expect(
      authed.mutation(internal.accountMutations.commitPasswordChange, {
        accounts: original,
        newHash: await new Scrypt().hash("replacement-password"),
      }),
    ).rejects.toThrow();
    const current = await t.run((ctx) =>
      ctx.db.query("authAccounts").collect(),
    );
    expect(
      current.some((account) => account.secret === original[0]?.secret),
    ).toBe(true);
  });

  test("OAuth-only account cannot change a password and phone remains personal", async () => {
    const t = createConvexTest();
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "google@example.test",
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-123",
      });
      return userId;
    });
    const authed = authedForUser(t, userId);
    expect(
      await authed.query(api.users.getAccountCapabilities, {}),
    ).toMatchObject({
      hasPassword: false,
    });
    expect(
      await authed.action(api.accountActions.changePassword, {
        currentPassword: "irrelevant",
        newPassword: "replacement-password",
      }),
    ).toEqual({ status: "password_unavailable" });
    expect(
      await authed.mutation(api.users.updatePhone, {
        phone: " +1 (555) 123-4567 ",
      }),
    ).toEqual({ status: "saved" });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.phone).toBe(
      "+1 (555) 123-4567",
    );
    expect(await authed.mutation(api.users.updatePhone, { phone: "" })).toEqual(
      { status: "saved" },
    );
    expect((await t.run((ctx) => ctx.db.get(userId)))?.phone).toBeUndefined();
    expect(
      await authed.mutation(api.users.updatePhone, { phone: "--- --- -" }),
    ).toEqual({ status: "error", code: "INVALID_PHONE" });
  });

  test("expected account input errors are returned as typed codes", async () => {
    const { authed } = await setupPasswordUser();
    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: "not-an-email",
      }),
    ).toEqual({ status: "error", code: "INVALID_EMAIL" });
    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: "owner@example.test",
      }),
    ).toEqual({ status: "error", code: "EMAIL_UNCHANGED" });
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "123",
      }),
    ).toEqual({ status: "error", code: "INVALID_CODE" });
    expect(
      await authed.action(api.accountActions.changePassword, {
        currentPassword: "original-password",
        newPassword: "short",
      }),
    ).toEqual({ status: "error", code: "INVALID_NEW_PASSWORD" });
    expect(
      await authed.action(api.accountActions.changePassword, {
        currentPassword: "original-password",
        newPassword: "original-password",
      }),
    ).toEqual({ status: "error", code: "PASSWORD_UNCHANGED" });
  });

  test("verified new email moves only its owner's email sign-ins and keeps memberships", async () => {
    sent.messages = [];
    const { t, userId, organizationId, authed } = await setupPasswordUser();
    await t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-123",
        emailVerified: "owner@example.test",
      }),
    );
    await t.run(async (ctx) => {
      const codeAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password-code"),
        )
        .unique();
      if (!codeAccount) throw new Error("Missing code account");
      await ctx.db.patch(codeAccount._id, {
        providerAccountId: "alternate@example.test",
      });
    });
    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: " NEW@Example.Test ",
      }),
    ).toEqual({ status: "sent" });
    expect(sent.messages.at(-1)?.to).toBe("new@example.test");
    expect((await t.run((ctx) => ctx.db.get(userId)))?.email).toBe(
      "owner@example.test",
    );
    const pending = await t.run((ctx) =>
      ctx.db.query("accountEmailChanges").unique(),
    );
    expect(pending?.codeHash).not.toContain("12345678");
    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: "new@example.test",
      }),
    ).toEqual({ status: "error", code: "EMAIL_SEND_THROTTLED" });
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "87654321",
      }),
    ).toEqual({ status: "error", code: "INVALID_CODE" });
    expect(
      (await t.run((ctx) => ctx.db.query("accountEmailChanges").unique()))
        ?.attemptsLeft,
    ).toBe(4);
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "changed" });
    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      accounts: await ctx.db.query("authAccounts").collect(),
      membership: await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", organizationId),
        )
        .unique(),
    }));
    expect(state.user?.email).toBe("new@example.test");
    expect(state.user?.emailVerificationTime).toEqual(expect.any(Number));
    expect(state.membership).not.toBeNull();
    expect(
      state.accounts
        .filter((account) => account.provider.startsWith("password"))
        .every((account) => account.providerAccountId === "new@example.test"),
    ).toBe(true);
    expect(
      state.accounts.find((account) => account.provider === "google")
        ?.providerAccountId,
    ).toBe("google-123");
    const signIn = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        email: "new@example.test",
        password: "original-password",
        flow: "signIn",
      },
    });
    expect(signIn.tokens?.token).toEqual(expect.any(String));
    const signature = "oauth-verifier-test";
    await t.run((ctx) => ctx.db.insert("authVerifiers", { signature }));
    await t.mutation(internal.auth.store, {
      args: {
        type: "userOAuth",
        provider: "google",
        providerAccountId: "google-123",
        profile: { email: "owner@example.test", name: "Google Name" },
        signature,
      },
    });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.email).toBe(
      "new@example.test",
    );
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "NO_PENDING_EMAIL_CHANGE" });
  });

  test("collisions at commit and cancellation never change the user's email", async () => {
    const { t, userId, authed } = await setupPasswordUser();
    await authed.action(api.accountActions.requestEmailChange, {
      newEmail: "reserved@example.test",
    });
    await t.run((ctx) =>
      ctx.db.insert("users", { email: "reserved@example.test" }),
    );
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "EMAIL_IN_USE" });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.email).toBe(
      "owner@example.test",
    );
    expect(await authed.mutation(api.users.cancelEmailChange, {})).toEqual({
      status: "cancelled",
    });
    expect(
      (await t.run((ctx) => ctx.db.query("accountEmailChanges").unique()))
        ?.cancelled,
    ).toBe(true);
    expect(
      (await authed.query(api.users.getAccountCapabilities, {}))
        .pendingEmailChange,
    ).toBeNull();
    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: "another@example.test",
      }),
    ).toEqual({ status: "error", code: "EMAIL_SEND_THROTTLED" });
  });

  test("failed attempts lock a code and a resend invalidates the old code", async () => {
    const { t, authed } = await setupPasswordUser();
    await authed.action(api.accountActions.requestEmailChange, {
      newEmail: "next@example.test",
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        await authed.action(api.accountActions.confirmEmailChange, {
          code: "00000000",
        }),
      ).toEqual({ status: "error", code: "INVALID_CODE" });
    }
    expect(
      (await t.run((ctx) => ctx.db.query("accountEmailChanges").unique()))
        ?.attemptsLeft,
    ).toBe(0);
    expect(
      (await authed.query(api.users.getAccountCapabilities, {}))
        .pendingEmailChange,
    ).toBeNull();
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "NO_PENDING_EMAIL_CHANGE" });

    expect(
      await authed.action(api.accountActions.requestEmailChange, {
        newEmail: "next@example.test",
      }),
    ).toEqual({ status: "error", code: "EMAIL_SEND_THROTTLED" });
    await t.run(async (ctx) => {
      const pending = await ctx.db.query("accountEmailChanges").unique();
      if (!pending) throw new Error("Missing pending change");
      await ctx.db.patch(pending._id, { lastSentAt: Date.now() - 61_000 });
    });
    sent.code = "87654321";
    await authed.action(api.accountActions.requestEmailChange, {
      newEmail: "next@example.test",
    });
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "INVALID_CODE" });
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "87654321",
      }),
    ).toEqual({ status: "changed" });
  });

  test("codes expire and cannot be used by a different signed-in user", async () => {
    const { t, authed } = await setupPasswordUser();
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "other@example.test" }),
    );
    const other = authedForUser(t, otherUserId);
    await authed.action(api.accountActions.requestEmailChange, {
      newEmail: "first-new@example.test",
    });
    sent.code = "87654321";
    await other.action(api.accountActions.requestEmailChange, {
      newEmail: "second-new@example.test",
    });
    expect(
      await other.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "INVALID_CODE" });
    expect(
      await other.action(api.accountActions.confirmEmailChange, {
        code: "87654321",
      }),
    ).toEqual({ status: "changed" });
    await t.run(async (ctx) => {
      const pending = await ctx.db
        .query("accountEmailChanges")
        .withIndex("by_userId")
        .first();
      if (!pending) throw new Error("Missing pending change");
      await ctx.db.patch(pending._id, { expiresAt: Date.now() - 1 });
    });
    expect(
      await authed.action(api.accountActions.confirmEmailChange, {
        code: "12345678",
      }),
    ).toEqual({ status: "error", code: "EMAIL_CODE_EXPIRED" });
  });

  test("unauthenticated calls and failed email delivery leave the account untouched", async () => {
    const { t, userId, authed } = await setupPasswordUser();
    expect(
      await t.mutation(api.users.updatePhone, { phone: "+15551234567" }),
    ).toEqual({ status: "error", code: "UNAUTHENTICATED" });
    expect(
      await t.action(api.accountActions.requestEmailChange, {
        newEmail: "new@example.test",
      }),
    ).toEqual({ status: "error", code: "UNAUTHENTICATED" });
    expect(
      await t.action(api.accountActions.changePassword, {
        currentPassword: "original-password",
        newPassword: "replacement-password",
      }),
    ).toEqual({ status: "error", code: "UNAUTHENTICATED" });
    vi.mocked(sendEmail).mockRejectedValueOnce(
      new Error("Email delivery failed"),
    );
    await expect(
      authed.action(api.accountActions.requestEmailChange, {
        newEmail: "new@example.test",
      }),
    ).rejects.toThrow("Email delivery failed");
    expect(
      await t.run((ctx) => ctx.db.query("accountEmailChanges").unique()),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(userId)))?.email).toBe(
      "owner@example.test",
    );
  });
});
