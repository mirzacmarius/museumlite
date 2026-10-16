import { generateKeyPairSync } from "node:crypto";
import { anyApi, type FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Scrypt } from "lucia";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import {
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

  test.each([
    "password-with-reset",
    "password-link",
  ])("%s preserves /fr on existing-account sign-up and verification resend", async (passwordProvider) => {
    const t = createConvexTestWithRateLimiter();
    await authRequest(t, {
      provider: passwordProvider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
    });
    for (const flow of ["signUp", "email-verification"]) {
      await authRequest(t, {
        provider: passwordProvider,
        params: {
          email: ownerEmail,
          password: ownerPassword,
          flow,
          redirectTo: "/fr",
        },
      });
      expect(emailsTo(ownerEmail).at(-1)?.html).toContain('lang="fr"');
      if (passwordProvider === "password-link")
        expect(emailsTo(ownerEmail).at(-1)?.html).toContain(
          "https://museum.example.test/fr?code=",
        );
    }
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
  ) {
    try {
      const result = await authRequest(t, {
        provider: signInProvider,
        params: { email: ownerEmail, password, flow: "signIn" },
      });
      return result.tokens ? "signed-in" : "verification-required";
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      return "rejected";
    }
  }

  async function signUp(
    t: ConvexTest,
    password: string,
    signUpProvider = provider,
  ) {
    return await authRequest(t, {
      provider: signUpProvider,
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

  test("a code-only password-link callback signs in without activating either sign-up password", async () => {
    const t = createConvexTestWithRateLimiter();
    const linkProvider = "password-link";
    await signUp(t, attackerPassword, linkProvider);
    await signUp(t, ownerPassword, linkProvider);
    const code = emailsTo(ownerEmail)
      .at(-1)
      ?.html.match(/code=([^"&\s]+)/)?.[1];
    if (!code) throw new Error("No password link sent");
    expect((await authRequest(t, { params: { code } })).tokens?.token).toEqual(
      expect.any(String),
    );
    expect(await signInResult(t, attackerPassword, linkProvider)).toBe(
      "rejected",
    );
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

  // password-link hashes a password on each of its 12 requests, which takes
  // over 5s on slow CI runners.
  test.each([
    "resend-otp",
    "magic-link",
    "password-link",
  ])("%s counts every request and preserves the final code on throttle", async (codeProvider) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = createConvexTestWithRateLimiter();
    for (let request = 0; request < 10; request += 1) {
      await authRequest(t, {
        provider: codeProvider,
        params: {
          email: ownerEmail,
          ...(codeProvider === "password-link"
            ? { password: ownerPassword, flow: "signUp" }
            : {}),
        },
      });
    }
    expect(emailsTo(ownerEmail)).toHaveLength(10);
    const code =
      codeProvider === "resend-otp"
        ? latestCode(ownerEmail)
        : emailsTo(ownerEmail)
            .at(-1)
            ?.html.match(/code=([^"&\s]+)/)?.[1];
    if (!code) throw new Error("No sign-in code sent");
    expect(
      await publicErrorCode(
        authRequest(t, {
          provider: codeProvider,
          params: {
            email: ownerEmail,
            ...(codeProvider === "password-link"
              ? { password: ownerPassword, flow: "signUp" }
              : {}),
          },
        }),
      ),
    ).toEqual({ code: "TooManyCodeRequests" });
    expect(emailsTo(ownerEmail)).toHaveLength(10);
    expect(
      (await authRequest(t, { params: { email: ownerEmail, code } })).tokens
        ?.token,
    ).toEqual(expect.any(String));
    vi.setSystemTime(Date.now() + 3 * 60 * 1000);
    await authRequest(t, {
      provider: codeProvider,
      params: {
        email: ownerEmail,
        ...(codeProvider === "password-link"
          ? { password: ownerPassword, flow: "signUp" }
          : {}),
      },
    });
    expect(emailsTo(ownerEmail)).toHaveLength(11);
  }, 20_000);

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
    const secret = await new Scrypt().hash(ownerPassword);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: ownerEmail });
      await ctx.db.insert("authAccounts", {
        userId,
        provider,
        providerAccountId: ownerEmail,
        secret,
      });
    });
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

  test("password providers without email verification refuse sign-up uniformly", async () => {
    const t = createConvexTestWithRateLimiter();
    for (const email of [ownerEmail, strangerEmail]) {
      expect(
        await publicErrorCode(
          authRequest(t, {
            provider: "password",
            params: { email, password: ownerPassword, flow: "signUp" },
          }),
        ),
      ).toEqual({ code: "SignUpUnavailable" });
    }
  });
});
