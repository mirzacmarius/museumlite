import { generateKeyPairSync } from "node:crypto";
import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
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
        typeof body.html !== "string"
      ) {
        throw new Error("Invalid email body");
      }
      const to = Array.isArray(body.to)
        ? body.to.filter((value): value is string => typeof value === "string")
        : typeof body.to === "string"
          ? [body.to]
          : [];
      sentEmails.push({ to, html: body.html });
      return Response.json({ id: "test-email-id" });
    }),
  );
});

afterEach(() => {
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

async function createVerifiedPasswordOwner(t: ConvexTest) {
  await t.action(api.auth.signIn, {
    provider,
    params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
  });
  await t.action(api.auth.signIn, {
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
      t.action(api.auth.signIn, {
        provider,
        params: { email: ownerEmail, password: "not-it-123", flow: "signIn" },
      }),
    );
    const unknownEmail = await publicErrorCode(
      t.action(api.auth.signIn, {
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

    const signedIn = await t.action(api.auth.signIn, {
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
        t.action(api.auth.signIn, {
          provider,
          params: { email: ownerEmail, password: "guess-1234", flow: "signIn" },
        }),
      );
    }
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        }),
      ),
    ).toEqual({ code: "InvalidCredentials" });
  });

  test("reset requests answer the same for existing, unknown and other-provider emails", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const otpOnlyEmail = "otp-only@example.test";
    await t.action(api.auth.signIn, {
      provider: "resend-otp",
      params: { email: otpOnlyEmail },
    });
    sentEmails = [];

    const responses = [];
    for (const email of [ownerEmail, strangerEmail, otpOnlyEmail]) {
      responses.push(
        await t.action(api.auth.signIn, {
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
      t.action(api.auth.signIn, {
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
      t.action(api.auth.signIn, {
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

    const reset = await t.action(api.auth.signIn, {
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

  test("sign-up for a registered email looks like a new sign-up and cannot replace the password before verification", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const existing = await t.action(api.auth.signIn, {
      provider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    const fresh = await t.action(api.auth.signIn, {
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
      t.action(api.auth.signIn, {
        provider,
        params: {
          email: ownerEmail,
          password: "attacker-password-123",
          flow: "signIn",
        },
      }),
    );
    const ownerSignIn = await t.action(api.auth.signIn, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signIn" },
    });
    expect(ownerSignIn.tokens?.token).toEqual(expect.any(String));
  });

  test.each([
    false,
    true,
  ])("victim verification replaces a pre-registered attacker's password (linked user: %s)", async (hasVerifiedUser) => {
    const t = createConvexTestWithRateLimiter();
    if (hasVerifiedUser) {
      await t.action(api.auth.signIn, {
        provider: "resend-otp",
        params: { email: ownerEmail },
      });
      await t.action(api.auth.signIn, {
        provider: "resend-otp",
        params: { email: ownerEmail, code: latestCode(ownerEmail) },
      });
    }
    await t.action(api.auth.signIn, {
      provider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    await t.action(api.auth.signIn, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
    });
    const verified = await t.action(api.auth.signIn, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        flow: "email-verification",
      },
    });
    expect(verified.tokens?.token).toEqual(expect.any(String));
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider,
          params: {
            email: ownerEmail,
            password: "attacker-password-123",
            flow: "signIn",
          },
        }),
      ),
    ).toEqual({ code: "InvalidCredentials" });
    const signedIn = await t.action(api.auth.signIn, {
      provider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signIn" },
    });
    expect(signedIn.tokens?.token).toEqual(expect.any(String));
  });

  test("a verified owner can adopt their new sign-up password only by verifying", async () => {
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    const replacement = "owner-replacement-password-123";
    await t.action(api.auth.signIn, {
      provider,
      params: { email: ownerEmail, password: replacement, flow: "signUp" },
    });
    expect(
      (
        await t.action(api.auth.signIn, {
          provider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        })
      ).tokens?.token,
    ).toEqual(expect.any(String));
    await t.action(api.auth.signIn, {
      provider,
      params: {
        email: ownerEmail,
        code: latestCode(ownerEmail),
        flow: "email-verification",
      },
    });
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        }),
      ),
    ).toEqual({ code: "InvalidCredentials" });
    expect(
      (
        await t.action(api.auth.signIn, {
          provider,
          params: { email: ownerEmail, password: replacement, flow: "signIn" },
        })
      ).tokens?.token,
    ).toEqual(expect.any(String));
  });

  test("a code-only password-link callback activates the password bound to that link", async () => {
    const t = createConvexTestWithRateLimiter();
    const linkProvider = "password-link";
    await t.action(api.auth.signIn, {
      provider: linkProvider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    await t.action(api.auth.signIn, {
      provider: linkProvider,
      params: { email: ownerEmail, password: ownerPassword, flow: "signUp" },
    });
    const code = emailsTo(ownerEmail)
      .at(-1)
      ?.html.match(/code=([^"&\s]+)/)?.[1];
    if (!code) throw new Error("No password link sent");
    expect(
      (await t.action(api.auth.signIn, { params: { code } })).tokens?.token,
    ).toEqual(expect.any(String));
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider: linkProvider,
          params: {
            email: ownerEmail,
            password: "attacker-password-123",
            flow: "signIn",
          },
        }),
      ),
    ).toEqual({ code: "InvalidCredentials" });
    expect(
      (
        await t.action(api.auth.signIn, {
          provider: linkProvider,
          params: {
            email: ownerEmail,
            password: ownerPassword,
            flow: "signIn",
          },
        })
      ).tokens?.token,
    ).toEqual(expect.any(String));
  });

  test("a code-only reset cannot activate a pre-registered password", async () => {
    const t = createConvexTestWithRateLimiter();
    await t.action(api.auth.signIn, {
      provider,
      params: {
        email: ownerEmail,
        password: "attacker-password-123",
        flow: "signUp",
      },
    });
    await t.action(api.auth.signIn, {
      provider,
      params: { email: ownerEmail, flow: "reset" },
    });
    expect(
      await t.action(api.auth.signIn, {
        params: { email: ownerEmail, code: latestCode(ownerEmail) },
      }),
    ).toEqual({ tokens: null });
    expect(
      (
        await t.action(api.auth.signIn, {
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
        await t.action(api.auth.signIn, {
          provider,
          params: { email, flow: "email-verification" },
        }),
      ).toEqual({ tokens: null });
      expect(
        await publicErrorCode(
          t.action(api.auth.signIn, {
            provider,
            params: { email, code: "00000000", flow: "email-verification" },
          }),
        ),
      ).toEqual({ code: "InvalidCode" });
    }
    expect(emailsTo(strangerEmail)).toHaveLength(0);
  });

  test("code requests are throttled per email regardless of account existence", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = createConvexTestWithRateLimiter();
    await createVerifiedPasswordOwner(t);
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    for (const email of [ownerEmail, strangerEmail]) {
      for (let request = 0; request < 5; request += 1) {
        await t.action(api.auth.signIn, {
          provider,
          params: { email, flow: "reset" },
        });
      }
      expect(
        await publicErrorCode(
          t.action(api.auth.signIn, {
            provider,
            params: { email, flow: "reset" },
          }),
        ),
      ).toEqual({ code: "TooManyCodeRequests" });
    }
    expect(
      await publicErrorCode(
        t.action(api.auth.signIn, {
          provider: "resend-otp",
          params: { email: ownerEmail },
        }),
      ),
    ).toEqual({ code: "TooManyCodeRequests" });
    expect(
      await t.action(api.auth.signIn, {
        provider: "resend-otp",
        params: { email: "someone-else@example.test" },
      }),
    ).toEqual({ started: true });

    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(
      await t.action(api.auth.signIn, {
        provider,
        params: { email: ownerEmail, flow: "reset" },
      }),
    ).toEqual({ tokens: null });
  });

  test("password providers without email verification refuse sign-up uniformly", async () => {
    const t = createConvexTestWithRateLimiter();
    for (const email of [ownerEmail, strangerEmail]) {
      expect(
        await publicErrorCode(
          t.action(api.auth.signIn, {
            provider: "password",
            params: { email, password: ownerPassword, flow: "signUp" },
          }),
        ),
      ).toEqual({ code: "SignUpUnavailable" });
    }
  });
});
