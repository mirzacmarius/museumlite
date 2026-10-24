import { createHash, generateKeyPairSync } from "node:crypto";
import { anyApi, type FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Scrypt } from "lucia";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTestWithRateLimiter,
} from "./testHarness";

vi.mock("../convex/env", () => ({
  env: {
    RESEND_API_KEY: "test-resend-key",
    RESEND_SENDER_EMAIL_AUTH: "auth@example.test",
    SITE_URL: "https://museum.example.test",
    CONVEX_SITE_URL: "https://museum.convex.site",
  },
}));

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const provider = "password-with-reset";
const ownerEmail = "owner@example.test";
const strangerEmail = "nobody@example.test";
const ownerNewEmail = "owner-new@example.test";
const ownerPassword = "original-password-123";

interface SentEmail {
  to: string[];
  html: string;
  subject: string;
}

let sentEmails: SentEmail[] = [];

beforeEach(() => {
  sentEmails = [];
  vi.stubEnv("JWT_PRIVATE_KEY", privateKey);
  vi.stubEnv("CONVEX_SITE_URL", "https://museum.convex.site");
  vi.stubEnv("SITE_URL", "https://museum.example.test");
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) !== "https://api.resend.com/emails") {
        throw new Error(`Unexpected external request: ${String(url)}`);
      }
      if (typeof init?.body !== "string") throw new Error("Missing body");
      const body: unknown = JSON.parse(init.body);
      if (
        typeof body !== "object" ||
        body === null ||
        !("to" in body) ||
        !("html" in body) ||
        typeof body.html !== "string" ||
        !("subject" in body) ||
        typeof body.subject !== "string"
      ) {
        throw new Error("Invalid email body");
      }
      const to = Array.isArray(body.to)
        ? body.to.filter((value): value is string => typeof value === "string")
        : typeof body.to === "string"
          ? [body.to]
          : [];
      sentEmails.push({ to, html: body.html, subject: body.subject });
      return Response.json({ id: "test-email-id" });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function emailsTo(email: string) {
  return sentEmails.filter((entry) => entry.to.includes(email));
}

function latestCode(email: string): string {
  const code = emailsTo(email)
    .at(-1)
    ?.html.match(/<strong>(\d{8})<\/strong>/)?.[1];
  if (!code) throw new Error(`No code sent to ${email}`);
  return code;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to be rejected");
}

async function publicErrorCode(promise: Promise<unknown>) {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConvexError);
  if (!(error instanceof ConvexError)) return undefined;
  // convex-test hands ConvexError data back serialized; clients receive JSON.
  return typeof error.data === "string" ? JSON.parse(error.data) : error.data;
}

async function authRequest(
  t: ConvexTest,
  args: FunctionArgs<typeof api.auth.signIn>,
) {
  const response = await t.action(api.auth.signIn, args);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await t.finishInProgressScheduledFunctions();
  return response;
}

async function createVerifiedPasswordOwner(t: ConvexTest) {
  await authRequest(t, {
    provider,
    params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
  });
  await authRequest(t, {
    provider,
    params: {
      email: ownerEmail,
      code: latestCode(ownerEmail),
      flow: "email-verification",
    },
  });
  sentEmails = [];
}

async function createVerifiedOtpUser(t: ConvexTest): Promise<Id<"users">> {
  await authRequest(t, {
    provider: "resend-otp",
    params: { email: ownerEmail },
  });
  await authRequest(t, {
    provider: "resend-otp",
    params: { email: ownerEmail, code: latestCode(ownerEmail) },
  });
  sentEmails = [];
  return await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!user?.emailVerificationTime) throw new Error("No verified OTP user");
    return user._id;
  });
}

/** Stores an unverified account as earlier sign-up rules could leave one. */
async function seedUnverifiedPasswordAccount(
  t: ConvexTest,
  accountProvider: string,
  password: string,
  userId?: Id<"users">,
) {
  const secret = await new Scrypt().hash(password);
  await t.run(async (ctx) => {
    await ctx.db.insert("authAccounts", {
      userId: userId ?? (await ctx.db.insert("users", { email: ownerEmail })),
      provider: accountProvider,
      providerAccountId: ownerEmail,
      secret,
    });
  });
}

async function passwordAccount(
  t: ConvexTest,
  accountProvider: string,
  email: string,
) {
  return await t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", accountProvider).eq("providerAccountId", email),
      )
      .unique(),
  );
}

/** The owner moves their account to `ownerNewEmail` from the Account page. */
async function ownerChangesEmail(t: ConvexTest, userId: Id<"users">) {
  const owner = authedForUser(t, userId);
  await owner.mutation(internal.accountMutations.prepareEmailChange, {
    email: ownerNewEmail,
    codeHash: "owner-code-hash",
  });
  return await owner.mutation(internal.accountMutations.confirmEmailChange, {
    codeHash: "owner-code-hash",
  });
}

function emailedLinkCode(email: string): string {
  const code = emailsTo(email)
    .at(-1)
    ?.html.match(/code=([^"&\s]+)/)?.[1];
  if (!code) throw new Error(`No link sent to ${email}`);
  return code;
}

describe("account recovery without existence disclosure", () => {
  test("the public password-account lookup is no longer exposed", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    await expect(
      t.query(anyApi.authLookup?.hasPasswordAccountForEmail, {
        email: ownerEmail,
      }),
    ).rejects.toThrow();
  });

  test("a wrong password and an unknown email fail identically", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const wrongPassword = await publicErrorCode(
      authRequest(t, {
        provider,
        params: { email: ownerEmail, password: "not-it-123", flow: "signIn" },
      }),
    );
    const unknownEmail = await publicErrorCode(
      authRequest(t, {
        provider,
        params: {
          email: strangerEmail,
          password: "not-it-123",
          flow: "signIn",
        },
      }),
    );
    expect(wrongPassword).toEqual({ code: "InvalidCredentials" });
    expect(unknownEmail).toEqual(wrongPassword);

    const signedIn = await authRequest(t, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signIn" },
    });
    expect(signedIn.tokens?.token).toEqual(expect.any(String));
  });

  test("a locked-out account fails like an unknown email", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    for (let attempt = 0; attempt < 11; attempt += 1) {
      await rejection(
        authRequest(t, {
          provider,
          params: { email: ownerEmail, password: "guess-1234", flow: "signIn" },
        }),
      );
    }
    expect(
      await publicErrorCode(
        authRequest(t, {
          provider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        }),
      ),
    ).toEqual({ code: "InvalidCredentials" });
  }, 20_000);

  test("locked-out and unknown emails both perform password verification work", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    for (let attempt = 0; attempt < 11; attempt += 1) {
      await rejection(
        authRequest(t, {
          provider,
          params: { email: ownerEmail, password: "guess-1234", flow: "signIn" },
        }),
      );
    }
    const work = vi.spyOn(Scrypt.prototype, "verify");
    await rejection(
      authRequest(t, {
        provider,
        params: { email: ownerEmail, password: "guess-1234", flow: "signIn" },
      }),
    );
    const lockedOutWork = work.mock.calls.length;
    work.mockClear();
    await rejection(
      authRequest(t, {
        provider,
        params: {
          email: strangerEmail,
          password: "guess-1234",
          flow: "signIn",
        },
      }),
    );
    expect(work.mock.calls.length).toBe(1);
    expect(lockedOutWork).toBe(1);
  }, 20_000);

  test.each([
    "reset",
    "email-verification",
  ])("%s acknowledges existing and unknown requests without waiting for email", async (flow) => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    let releaseEmail: (() => void) | undefined;
    const mailResponse = new Promise<Response>((resolve) => {
      releaseEmail = () => resolve(Response.json({ id: "deferred-mail" }));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => mailResponse),
    );
    try {
      for (const email of [ownerEmail, strangerEmail]) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const response = await Promise.race([
          t.action(api.auth.signIn, { provider, params: { email, flow } }),
          new Promise<string>((resolve) => {
            timeout = setTimeout(() => resolve("waited for email"), 100);
          }),
        ]);
        clearTimeout(timeout);
        expect(response).toEqual({ tokens: null });
      }
    } finally {
      releaseEmail?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await t.finishInProgressScheduledFunctions();
    }
  });

  test("reset requests answer the same for existing, unknown and other-provider emails", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const otpOnlyEmail = "otp-only@example.test";
    await authRequest(t, {
      provider: "resend-otp",
      params: { email: otpOnlyEmail },
    });
    sentEmails = [];

    const responses = [];
    for (const email of [ownerEmail, strangerEmail, otpOnlyEmail]) {
      responses.push(
        await authRequest(t, {
          provider,
          params: { email, flow: "reset" },
        }),
      );
    }
    expect(responses).toEqual([
      { tokens: null },
      { tokens: null },
      { tokens: null },
    ]);
    expect(emailsTo(ownerEmail)).toHaveLength(1);
    expect(emailsTo(strangerEmail)).toHaveLength(0);
    expect(emailsTo(otpOnlyEmail)).toHaveLength(0);

    const badCodeForOwner = await publicErrorCode(
      authRequest(t, {
        provider,
        params: {
          email: ownerEmail,
          code: "00000000",
          newPassword: "replacement-password-123",
          flow: "reset-verification",
        },
      }),
    );
    const badCodeForStranger = await publicErrorCode(
      authRequest(t, {
        provider,
        params: {
          email: strangerEmail,
          code: "00000000",
          newPassword: "replacement-password-123",
          flow: "reset-verification",
        },
      }),
    );
    expect(badCodeForOwner).toEqual({ code: "InvalidCode" });
    expect(badCodeForStranger).toEqual(badCodeForOwner);

    const reset = await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        newPassword: "replacement-password-123",
        flow: "reset-verification",
      },
    });
    expect(reset.tokens?.token).toEqual(expect.any(String));
  });

  test("a /fr reset request delivers French password-reset copy", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, flow: "reset", redirectTo: "/fr" },
    });
    expect(emailsTo(ownerEmail).at(-1)?.html).toContain('lang="fr"');
    expect(emailsTo(ownerEmail).at(-1)?.subject).toBe(
      "Réinitialisez votre mot de passe MuseumLite",
    );
  });

  test("password-with-reset preserves /fr on existing-account sign-up and verification resend", async () => {
    const t = createConvexTestWithRateLimiter();
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
    });
    for (const flow of ["signUp", "email-verification"]) {
      await authRequest(t, {
        provider,
        params: {
          email: ownerEmail,
          password: ownerPassword,
          flow,
          redirectTo: "/fr",
        },
      });
      expect(emailsTo(ownerEmail).at(-1)?.html).toContain('lang="fr"');
    }
  });

  test("password-link preserves /fr on an existing account's verification resend", async () => {
    const t = createConvexTestWithRateLimiter();
    await seedUnverifiedPasswordAccount(t, "password-link", ownerPassword);
    await authRequest(t, {
      provider: "password-link",
      params: {
        email: ownerEmail,
        flow: "email-verification",
        redirectTo: "/fr",
      },
    });
    expect(emailsTo(ownerEmail).at(-1)?.html).toContain('lang="fr"');
    expect(emailsTo(ownerEmail).at(-1)?.html).toContain(
      "https://museum.example.test/fr?code=",
    );
  });

  test("sign-up for a registered email looks like a new sign-up and cannot replace the password before verification", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const existing = await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    const fresh = await authRequest(t, {
      provider,
      params: {
        email: "fresh@example.test",
        password: "fresh-password-123",
        flow: "signUp",
      },
    });
    expect(existing).toEqual({ tokens: null });
    expect(fresh).toEqual(existing);
    expect(emailsTo(ownerEmail)).toHaveLength(1);

    await rejection(
      authRequest(t, {
        provider,
        params: {
          email: ownerEmail,
          password: "attacker-password-123",
          flow: "signIn",
        },
      }),
    );
    const ownerSignIn = await authRequest(t, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signIn" },
    });
    expect(ownerSignIn.tokens?.token).toEqual(expect.any(String));
  });

  async function signInResult(
    t: ConvexTest,
    password: string,
    signInProvider = provider,
    email = ownerEmail,
  ) {
    try {
      const result = await authRequest(t, {
        provider: signInProvider,
        params: { email, password, flow: "signIn" },
      });
      return result.tokens ? "signed-in" : "verification-required";
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      return "rejected";
    }
  }

  async function signUp(t: ConvexTest, password: string) {
    return await authRequest(t, {
      provider,
      params: { email: ownerEmail, password, flow: "signUp" },
    });
  }

  async function verifyLatestCode(t: ConvexTest) {
    return await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        flow: "email-verification",
      },
    });
  }

  const attackerPassword = "attacker-password-123";

  test.each([
    false,
    true,
  ])("a pre-registered attacker loses their password when the owner signs up (linked user: %s)", async (hasVerifiedUser) => {
    const t = createConvexTestWithRateLimiter();
    if (hasVerifiedUser) {
      await authRequest(t, {
        provider: "resend-otp",
        params: { email: ownerEmail },
      });
      await authRequest(t, {
        provider: "resend-otp",
        params: { email: ownerEmail, code: latestCode(ownerEmail) },
      });
    }
    await signUp(t, attackerPassword);
    await signUp(t, ownerPassword);
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
    // Neither claim was proven, so the mailbox owner sets a password by reset.
    expect(await signInResult(t, ownerPassword)).toBe("rejected");
  });

  test("an attacker sign-up on an owner's unverified account cannot install the attacker's password", async () => {
    const t = createConvexTestWithRateLimiter();
    await signUp(t, ownerPassword);
    await signUp(t, attackerPassword);
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
  });

  test("an expired attacker sign-up cannot ride along on the owner's later verification", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t = createConvexTestWithRateLimiter();
    await signUp(t, ownerPassword);
    await signUp(t, attackerPassword);
    vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
    expect(await signInResult(t, ownerPassword)).toBe("rejected");
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, flow: "email-verification" },
    });
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
  });

  test("resending verification after a competing sign-up cannot install the attacker's password", async () => {
    const t = createConvexTestWithRateLimiter();
    await signUp(t, ownerPassword);
    await signUp(t, attackerPassword);
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, flow: "email-verification" },
    });
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
  });

  test("repeating a sign-up with the same password keeps that password", async () => {
    const t = createConvexTestWithRateLimiter();
    await signUp(t, ownerPassword);
    await signUp(t, ownerPassword);
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, ownerPassword)).toBe("signed-in");
  });

  test("sign-up for a verified account keeps the owner's password after verification", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const replacement = "owner-replacement-password-123";
    await signUp(t, replacement);
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, ownerPassword)).toBe("signed-in");
    expect(await signInResult(t, replacement)).toBe("rejected");
  });

  test("a sign-up on an email with a verified user cannot set a password through the owner's code", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await createVerifiedOtpUser(t);
    expect(await signUp(t, attackerPassword)).toEqual({ tokens: null });
    const linked = await passwordAccount(t, provider, ownerEmail);
    expect(linked?.userId).toBe(userId);
    expect(linked?.secret).toBeUndefined();
    expect((await verifyLatestCode(t)).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword)).toBe("rejected");

    // The mailbox owner sets a password through reset.
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, flow: "reset" },
    });
    const reset = await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        newPassword: ownerPassword,
        flow: "reset-verification",
      },
    });
    expect(reset.tokens?.token).toEqual(expect.any(String));
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
    expect(await signInResult(t, ownerPassword)).toBe("signed-in");
  });

  test("an owner's password-link click cannot activate a password stored on their verified user", async () => {
    const t = createConvexTestWithRateLimiter();
    const linkProvider = "password-link";
    const userId = await createVerifiedOtpUser(t);
    await seedUnverifiedPasswordAccount(
      t,
      linkProvider,
      attackerPassword,
      userId,
    );
    expect(await signInResult(t, attackerPassword, linkProvider)).toBe(
      "verification-required",
    );
    const opened = await authRequest(t, {
      params: { code: emailedLinkCode(ownerEmail) },
    });
    expect(opened.tokens?.token).toEqual(expect.any(String));
    expect(await signInResult(t, attackerPassword, linkProvider)).toBe(
      "rejected",
    );
  });

  test("a sign-up with a redirect to another site is refused before any account exists", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedOtpUser(t);
    await rejection(
      authRequest(t, {
        provider,
        params: {
          email: ownerEmail,
          password: attackerPassword,
          flow: "signUp",
          redirectTo: "https://evil.example.test/",
        },
      }),
    );
    expect(await passwordAccount(t, provider, ownerEmail)).toBeNull();
    expect(sentEmails).toHaveLength(0);
  });

  test("a sign-up refused by the code quota stores no password, and an email change cannot activate one", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await createVerifiedOtpUser(t);
    for (let request = 0; request < 10; request += 1) {
      await authRequest(t, {
        provider,
        params: { email: ownerEmail, flow: "email-verification" },
      });
    }
    expect(await publicErrorCode(signUp(t, attackerPassword))).toEqual({
      code: "TooManyCodeRequests",
    });
    const linked = await passwordAccount(t, provider, ownerEmail);
    expect(linked?.userId).toBe(userId);
    expect(linked?.secret).toBeUndefined();

    expect(await ownerChangesEmail(t, userId)).toBe("changed");
    expect(
      await signInResult(t, attackerPassword, provider, ownerNewEmail),
    ).toBe("rejected");
  });

  test("an email change drops a password planted on a verified user instead of activating it", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await createVerifiedOtpUser(t);
    await seedUnverifiedPasswordAccount(t, provider, attackerPassword, userId);

    expect(await ownerChangesEmail(t, userId)).toBe("changed");
    expect(
      await signInResult(t, attackerPassword, provider, ownerNewEmail),
    ).toBe("rejected");

    // The owner sets a password through reset on the new address.
    await authRequest(t, {
      provider,
      params: { email: ownerNewEmail, flow: "reset" },
    });
    const reset = await authRequest(t, {
      provider,
      params: {
        email: ownerNewEmail,
        code: latestCode(ownerNewEmail),
        newPassword: ownerPassword,
        flow: "reset-verification",
      },
    });
    expect(reset.tokens?.token).toEqual(expect.any(String));
    expect(await signInResult(t, ownerPassword, provider, ownerNewEmail)).toBe(
      "signed-in",
    );
  });

  test("a code issued before the planted password was dropped cannot activate it", async () => {
    const t = createConvexTestWithRateLimiter();
    const userId = await createVerifiedOtpUser(t);
    await seedUnverifiedPasswordAccount(t, provider, attackerPassword, userId);
    const code = "13572468";
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", provider).eq("providerAccountId", ownerEmail),
        )
        .unique();
      if (!account) throw new Error("No planted account");
      await ctx.db.insert("authVerificationCodes", {
        accountId: account._id,
        provider: "resend-otp",
        code: createHash("sha256").update(code).digest("hex"),
        expirationTime: Date.now() + 60 * 60 * 1000,
        emailVerified: ownerEmail,
      });
    });

    const redeemed = await authRequest(t, {
      provider,
      params: { email: ownerEmail, code, flow: "email-verification" },
    });
    expect(redeemed.tokens?.token).toEqual(expect.any(String));
    expect(await signInResult(t, attackerPassword)).toBe("rejected");
  });

  test("an unverified password-link account loses its unproven password once a link is sent", async () => {
    const t = createConvexTestWithRateLimiter();
    const linkProvider = "password-link";
    await seedUnverifiedPasswordAccount(t, linkProvider, ownerPassword);
    expect(await signInResult(t, ownerPassword, linkProvider)).toBe(
      "verification-required",
    );
    expect(
      (await passwordAccount(t, linkProvider, ownerEmail))?.secret,
    ).toBeUndefined();
    const opened = await authRequest(t, {
      params: { code: emailedLinkCode(ownerEmail) },
    });
    expect(opened.tokens?.token).toEqual(expect.any(String));
    expect(await signInResult(t, ownerPassword, linkProvider)).toBe("rejected");
  });

  test("a code-only reset cannot activate a pre-registered password", async () => {
    const t = createConvexTestWithRateLimiter();
    await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    await authRequest(t, {
      provider,
      params: { email: ownerEmail, flow: "reset" },
    });
    expect(
      await authRequest(t, {
        params: { email: ownerEmail, code: latestCode(ownerEmail) },
      }),
    ).toEqual({ tokens: null });
    expect(
      (
        await authRequest(t, {
          provider,
          params: {
            email: ownerEmail,
            password: "attacker-password-123",
            flow: "signIn",
          },
        })
      ).tokens,
    ).toBeNull();
  });

  test("verification resends and bad codes answer the same for unknown emails", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    for (const email of [ownerEmail, strangerEmail]) {
      expect(
        await authRequest(t, {
          provider,
          params: { email, flow: "email-verification" },
        }),
      ).toEqual({ tokens: null });
      expect(
        await publicErrorCode(
          authRequest(t, {
            provider,
            params: { email, code: "00000000", flow: "email-verification" },
          }),
        ),
      ).toEqual({ code: "InvalidCode" });
    }
    expect(emailsTo(strangerEmail)).toHaveLength(0);
  });

  test("the owner's last emailed reset code survives throttled requests", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    let wasThrottled = false;
    for (let request = 0; request < 20; request += 1) {
      try {
        await authRequest(t, {
          provider,
          params: { email: ownerEmail, flow: "reset" },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        wasThrottled = true;
        break;
      }
    }
    expect(wasThrottled).toBe(true);
    const reset = await authRequest(t, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        newPassword: "replacement-password-123",
        flow: "reset-verification",
      },
    });
    expect(reset.tokens?.token).toEqual(expect.any(String));
  });

  test("code requests are throttled per email regardless of account existence", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    for (const email of [ownerEmail, strangerEmail]) {
      for (let request = 0; request < 10; request += 1) {
        await authRequest(t, {
          provider,
          params: { email, flow: "reset" },
        });
      }
      expect(
        await publicErrorCode(
          authRequest(t, {
            provider,
            params: { email, flow: "reset" },
          }),
        ),
      ).toEqual({ code: "TooManyCodeRequests" });
    }
    expect(
      await authRequest(t, {
        provider: "resend-otp",
        params: { email: ownerEmail },
      }),
    ).toEqual({ started: true });
    expect(
      await authRequest(t, {
        provider,
        params: { email: ownerEmail, flow: "email-verification" },
      }),
    ).toEqual({ tokens: null });
    expect(
      await authRequest(t, {
        provider: "resend-otp",
        params: { email: "someone-else@example.test" },
      }),
    ).toEqual({ started: true });

    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(
      await authRequest(t, {
        provider,
        params: { email: ownerEmail, flow: "reset" },
      }),
    ).toEqual({ tokens: null });
  });

  test.each([
    "resend-otp",
    "magic-link",
    "password-link",
  ])("%s counts every request and preserves the final code on throttle", async (codeProvider) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = createConvexTestWithRateLimiter();
    const request = {
      provider: codeProvider,
      params:
        codeProvider === "password-link"
          ? { email: ownerEmail, flow: "email-verification" }
          : { email: ownerEmail },
    };
    if (codeProvider === "password-link")
      await seedUnverifiedPasswordAccount(t, codeProvider, ownerPassword);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await authRequest(t, request);
    }
    expect(emailsTo(ownerEmail)).toHaveLength(10);
    const code =
      codeProvider === "resend-otp"
        ? latestCode(ownerEmail)
        : emailedLinkCode(ownerEmail);
    expect(await publicErrorCode(authRequest(t, request))).toEqual({
      code: "TooManyCodeRequests",
    });
    expect(emailsTo(ownerEmail)).toHaveLength(10);
    expect(
      (await authRequest(t, { params: { email: ownerEmail, code } })).tokens
        ?.token,
    ).toEqual(expect.any(String));
    vi.setSystemTime(Date.now() + 3 * 60 * 1000);
    await authRequest(t, request);
    expect(emailsTo(ownerEmail)).toHaveLength(11);
  });

  test("expiry of an older request does not reset an active email's quota", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithRateLimiter();
    await t.action(api.auth.signIn, {
      provider,
      params: { email: strangerEmail, flow: "reset" },
    });
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    await t.finishInProgressScheduledFunctions();
    for (let request = 0; request < 10; request += 1) {
      await t.action(api.auth.signIn, {
        provider,
        params: { email: strangerEmail, flow: "reset" },
      });
    }
    await vi.advanceTimersByTimeAsync(60 * 1000);
    await t.finishInProgressScheduledFunctions();
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider,
          params: { email: strangerEmail, flow: "reset" },
        }),
      ),
    ).toEqual({ code: "TooManyCodeRequests" });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.action(api.auth.signIn, {
        provider,
        params: { email: strangerEmail, flow: "reset" },
      }),
    ).toEqual({ tokens: null });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });

  test("legacy unverified password accounts retain password sign-in after verification", async () => {
    const t = createConvexTestWithRateLimiter();
    await seedUnverifiedPasswordAccount(t, provider, ownerPassword);
    expect(
      await authRequest(t, {
        provider,
        params: { email: ownerEmail, password: ownerPassword, flow: "signIn" },
      }),
    ).toEqual({ tokens: null });
    expect(
      (
        await authRequest(t, {
          provider,
          params: {
            email: ownerEmail,
            code: latestCode(ownerEmail),
            flow: "email-verification",
          },
        })
      ).tokens?.token,
    ).toEqual(expect.any(String));
    expect(
      (
        await authRequest(t, {
          provider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        })
      ).tokens?.token,
    ).toEqual(expect.any(String));
  });

  test.each([
    "password",
    "password-link",
  ])("%s refuses sign-up for existing and unknown emails alike", async (passwordProvider) => {
    const t = createConvexTestWithRateLimiter();
    await seedUnverifiedPasswordAccount(t, passwordProvider, ownerPassword);
    for (const email of [ownerEmail, strangerEmail]) {
      expect(
        await publicErrorCode(
          authRequest(t, {
            provider: passwordProvider,
            params: { email, password: ownerPassword, flow: "signUp" },
          }),
        ),
      ).toEqual({ code: "SignUpUnavailable" });
    }
    expect(sentEmails).toHaveLength(0);
    const strangerAccount = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q
            .eq("provider", passwordProvider)
            .eq("providerAccountId", strangerEmail),
        )
        .unique(),
    );
    expect(strangerAccount).toBeNull();
  });
});
