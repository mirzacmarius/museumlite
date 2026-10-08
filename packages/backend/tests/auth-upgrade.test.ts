import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { createConvexTestWithRateLimiter } from "./testHarness";

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
      if (typeof init?.body !== "string") throw new Error("Missing email body");
      const body: unknown = JSON.parse(init.body);
      if (
        typeof body !== "object" ||
        body === null ||
        !("to" in body) ||
        !("html" in body) ||
        !(
          typeof body.to === "string" ||
          (Array.isArray(body.to) &&
            body.to.every((value: unknown) => typeof value === "string"))
        ) ||
        typeof body.html !== "string"
      )
        throw new Error("Invalid email body");
      sentEmails.push({
        to: typeof body.to === "string" ? [body.to] : body.to,
        html: body.html,
      });
      return Response.json({ id: "test-email-id" });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function latestCode(email: string): string {
  const normalized = email.trim().toLowerCase();
  const message = sentEmails.findLast((entry) =>
    entry.to.some((value) => value.trim().toLowerCase() === normalized),
  );
  const code = message?.html.match(/<strong>(\d{8})<\/strong>/)?.[1];
  if (!code) throw new Error(`No OTP sent to ${email}`);
  return code;
}

describe("stable Convex Auth upgrade", () => {
  test("password sign-up normalizes email and preserves password sign-in", async () => {
    const t = createConvexTestWithRateLimiter();
    const provider = "password-with-reset";
    const params = {
      email: " Reader@Example.Test ",
      password: "correct-password-123",
    };
    const signup = await t.action(api.auth.signIn, {
      provider,
      params: { ...params, flow: "signUp" },
    });
    expect(signup).toEqual({ tokens: null });
    await t.action(api.auth.signIn, {
      provider,
      params: {
        email: "reader@example.test",
        code: latestCode("reader@example.test"),
        flow: "email-verification",
      },
    });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((user) => user.email)).toEqual(["reader@example.test"]);
    await expect(
      t.action(api.auth.signIn, {
        provider,
        params: {
          email: "reader@example.test",
          password: "wrong-password",
          flow: "signIn",
        },
      }),
    ).rejects.toThrow();
    const signin = await t.action(api.auth.signIn, {
      provider,
      params: {
        email: "reader@example.test",
        password: params.password,
        flow: "signIn",
      },
    });
    expect(signin.tokens?.token).toEqual(expect.any(String));
  });

  test("rejected OTP does not consume the rightful user's code", async () => {
    const t = createConvexTestWithRateLimiter();
    const email = "reader@example.test";
    await t.action(api.auth.signIn, {
      provider: "resend-otp",
      params: { email },
    });
    const code = latestCode(email);
    await expect(
      t.action(api.auth.signIn, {
        provider: "resend-otp",
        params: { email: "other@example.test", code },
      }),
    ).rejects.toThrow();
    const verified = await t.action(api.auth.signIn, {
      provider: "resend-otp",
      params: { email, code },
    });
    expect(verified.tokens?.token).toEqual(expect.any(String));
    await expect(
      t.action(api.auth.signIn, {
        provider: "resend-otp",
        params: { email, code },
      }),
    ).rejects.toThrow();
  });

  test("reset codes cannot change another user's password, and valid reset still works", async () => {
    const t = createConvexTestWithRateLimiter();
    const provider = "password-with-reset";
    const password = "original-password-123";
    for (const email of ["owner@example.test", "other@example.test"]) {
      await t.action(api.auth.signIn, {
        provider,
        params: { email, password, flow: "signUp" },
      });
      await t.action(api.auth.signIn, {
        provider,
        params: { email, code: latestCode(email), flow: "email-verification" },
      });
    }
    const owner = "owner@example.test";
    await t.action(api.auth.signIn, {
      provider,
      params: { email: owner, flow: "reset" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await t.finishInProgressScheduledFunctions();
    const code = latestCode(owner);
    const before = await t.run((ctx) => ctx.db.query("authAccounts").collect());
    await expect(
      t.action(api.auth.signIn, {
        provider,
        params: {
          email: "other@example.test",
          code,
          newPassword: "replacement-password-123",
          flow: "reset-verification",
        },
      }),
    ).rejects.toThrow();
    const after = await t.run((ctx) => ctx.db.query("authAccounts").collect());
    expect(after.map((account) => account.secret)).toEqual(
      before.map((account) => account.secret),
    );
    const verified = await t.action(api.auth.signIn, {
      provider,
      params: {
        email: owner,
        code,
        newPassword: "replacement-password-123",
        flow: "reset-verification",
      },
    });
    expect(verified.tokens?.token).toEqual(expect.any(String));
    await expect(
      t.action(api.auth.signIn, {
        provider,
        params: { email: owner, password, flow: "signIn" },
      }),
    ).rejects.toThrow();
    const signin = await t.action(api.auth.signIn, {
      provider,
      params: {
        email: owner,
        password: "replacement-password-123",
        flow: "signIn",
      },
    });
    expect(signin.tokens?.token).toEqual(expect.any(String));
  });

  test("magic-link code signs in once and invalid code-only sign-in returns null tokens", async () => {
    const t = createConvexTestWithRateLimiter();
    await t.action(api.auth.signIn, {
      provider: "magic-link",
      params: { email: "reader@example.test" },
    });
    const code = sentEmails[0]?.html.match(/code=([^"&\s]+)/)?.[1];
    if (!code) throw new Error("No magic-link code sent");
    expect(
      await t.action(api.auth.signIn, { params: { code: "invalid-code" } }),
    ).toEqual({ tokens: null });
    const signin = await t.action(api.auth.signIn, { params: { code } });
    expect(signin.tokens?.token).toEqual(expect.any(String));
    expect(await t.action(api.auth.signIn, { params: { code } })).toEqual({
      tokens: null,
    });
  });
});
