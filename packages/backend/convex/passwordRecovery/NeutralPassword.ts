import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  type EmailConfig,
  type GenericActionCtxWithAuthConfig,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type { Value } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import { env } from "../env";
import { authRecoveryError } from "./authRecoveryErrors";
import { codeRequestFlow, enforceCodeRequestLimit } from "./codeRequestLimit";

type Params = Partial<Record<string, Value | undefined>>;
type Ctx = GenericActionCtxWithAuthConfig<DataModel>;

interface NeutralPasswordConfig {
  id: string;
  profile: (params: Params) => { email: string };
  reset?: EmailConfig;
  verify?: EmailConfig;
}

const failedCredentialReasons = new Set([
  "InvalidAccountId",
  "InvalidSecret",
  "TooManyFailedAttempts",
]);

/**
 * Precomputed Scrypt work so an unknown email takes about as long as a
 * wrong password. The hash is not a real account secret.
 */
const unknownPasswordPad = new Scrypt().hash(
  "museumlite-neutral-password-timing-pad",
);

async function padUnknownPassword(password: string) {
  try {
    await new Scrypt().verify(await unknownPasswordPad, password);
  } catch {
    // The public result stays InvalidCredentials even if the pad fails.
  }
}

function isLibraryFailure(error: unknown, reasons: Set<string>) {
  return error instanceof Error && reasons.has(error.message);
}

function requirePasswordParam(params: Params, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.length < 8 || value.length > 1024) {
    throw new Error("Invalid password");
  }
  return value;
}

async function findPasswordAccount(
  ctx: Ctx,
  provider: string,
  email: string,
): Promise<Doc<"authAccounts"> | null> {
  try {
    const { account } = await retrieveAccount<DataModel>(ctx, {
      provider,
      account: { id: email },
    });
    return account;
  } catch (error) {
    if (isLibraryFailure(error, new Set(["InvalidAccountId"]))) return null;
    throw error;
  }
}

/** Runs a code check, mapping every rejection to the same public error. */
async function verifyCode<T>(check: () => Promise<T | null>): Promise<T> {
  let result: T | null;
  try {
    result = await check();
  } catch {
    throw authRecoveryError("InvalidCode");
  }
  if (result === null) throw authRecoveryError("InvalidCode");
  return result;
}

/**
 * Password provider whose public responses do not depend on whether a password
 * account exists for the submitted email:
 *
 * - wrong password, unknown email and locked-out account fail identically;
 * - reset and verification-code requests always answer "code requested" and
 *   only email an address that has a matching account;
 * - sign-up for a registered email answers like a new sign-up and emails the
 *   owner a verification code instead of reporting a conflict. The submitted
 *   password is bound to that code and applied only after verification.
 *
 * Providers without email verification cannot make sign-up neutral, so they
 * refuse sign-up for every email and only keep legacy sign-in.
 */
export function NeutralPassword(config: NeutralPasswordConfig) {
  const { id: provider, reset, verify } = config;

  async function sendVerification(
    ctx: Ctx,
    account: Doc<"authAccounts">,
    params: Params,
    passwordHash?: string,
  ) {
    if (!verify) return { userId: account.userId };
    const code = verify.generateVerificationToken
      ? await verify.generateVerificationToken()
      : Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
    const baseUrl = env.SITE_URL.replace(/\/$/, "");
    const destination =
      typeof params.redirectTo === "string"
        ? new URL(params.redirectTo, `${baseUrl}/`)
        : new URL(baseUrl);
    if (destination.origin !== new URL(baseUrl).origin)
      throw new Error("Invalid redirectTo");
    destination.searchParams.set("code", code);
    const expires = new Date(Date.now() + (verify.maxAge ?? 86400) * 1000);
    await ctx.runMutation(internal.passwordRecovery.verification.createCode, {
      accountId: account._id,
      provider: verify.id,
      email: String(params.email),
      code,
      expirationTime: expires.getTime(),
      ...(passwordHash === undefined ? {} : { passwordHash }),
    });
    await verify.sendVerificationRequest({
      identifier: String(params.email),
      url: destination.toString(),
      token: code,
      expires,
      provider: verify,
      request: new Request("http://localhost"),
      theme: ctx.auth.config.theme,
    });
    return null;
  }

  async function signUp(ctx: Ctx, params: Params, email: string) {
    if (!verify) throw authRecoveryError("SignUpUnavailable");
    const secret = requirePasswordParam(params, "password");
    const existing = await findPasswordAccount(ctx, provider, email);
    if (existing) {
      const passwordHash = await new Scrypt().hash(secret);
      await sendVerification(ctx, existing, { email }, passwordHash);
      return null;
    }
    let created: Doc<"authAccounts">;
    try {
      ({ account: created } = await createAccount<DataModel>(ctx, {
        provider,
        account: { id: email, secret },
        profile: { email },
        shouldLinkViaEmail: true,
        shouldLinkViaPhone: false,
      }));
    } catch (error) {
      const raced = await findPasswordAccount(ctx, provider, email);
      if (!raced) throw error;
      await sendVerification(
        ctx,
        raced,
        { email },
        await new Scrypt().hash(secret),
      );
      return null;
    }
    return await sendVerification(
      ctx,
      created,
      { ...params, email },
      created.secret,
    );
  }

  async function signIn(ctx: Ctx, params: Params, email: string) {
    const secret = params.password;
    if (typeof secret !== "string")
      throw authRecoveryError("InvalidCredentials");
    let account: Doc<"authAccounts">;
    try {
      ({ account } = await retrieveAccount<DataModel>(ctx, {
        provider,
        account: { id: email, secret },
      }));
    } catch (error) {
      if (isLibraryFailure(error, failedCredentialReasons)) {
        if (error instanceof Error && error.message === "InvalidAccountId") {
          await padUnknownPassword(secret);
        }
        throw authRecoveryError("InvalidCredentials");
      }
      throw error;
    }
    if (verify && !account.emailVerified) {
      return await sendVerification(ctx, account, { ...params, email });
    }
    return { userId: account.userId };
  }

  async function requestReset(ctx: Ctx, email: string) {
    if (!reset)
      throw new Error(`Password reset is not enabled for ${provider}`);
    const account = await findPasswordAccount(ctx, provider, email);
    if (!account) {
      await enforceCodeRequestLimit(ctx, email, "reset");
      return null;
    }
    return await signInViaProvider(ctx, reset, {
      accountId: account._id,
      params: { email },
    });
  }

  async function completeReset(ctx: Ctx, params: Params, email: string) {
    if (!reset)
      throw new Error(`Password reset is not enabled for ${provider}`);
    const newPassword = requirePasswordParam(params, "newPassword");
    const account = await findPasswordAccount(ctx, provider, email);
    if (!account || typeof params.code !== "string") {
      throw authRecoveryError("InvalidCode");
    }
    const { userId, sessionId } = await verifyCode(() =>
      signInViaProvider(ctx, reset, { params: { email, code: params.code } }),
    );
    if (account.userId !== userId) throw authRecoveryError("InvalidCode");
    await modifyAccountCredentials(ctx, {
      provider,
      account: { id: email, secret: newPassword },
    });
    await invalidateSessions(ctx, { userId, except: [sessionId] });
    return { userId, sessionId };
  }

  async function verifyEmail(ctx: Ctx, params: Params, email: string) {
    if (!verify) {
      throw new Error(`Email verification is not enabled for ${provider}`);
    }
    const code = params.code;
    const account = await findPasswordAccount(ctx, provider, email);
    if (typeof code !== "string") {
      if (!account) {
        await enforceCodeRequestLimit(
          ctx,
          email,
          codeRequestFlow(verify.id, true),
        );
        return null;
      }
      return await sendVerification(ctx, account, { email });
    }
    if (!account) throw authRecoveryError("InvalidCode");
    return await verifyCode(() =>
      signInViaProvider(ctx, verify, {
        accountId: account._id,
        params: { email, code },
      }),
    );
  }

  return ConvexCredentials<DataModel>({
    id: provider,
    authorize: async (params, ctx) => {
      const { email } = config.profile(params);
      switch (params.flow) {
        case "signUp":
          return await signUp(ctx, params, email);
        case "signIn":
          return await signIn(ctx, params, email);
        case "reset":
          return await requestReset(ctx, email);
        case "reset-verification":
          return await completeReset(ctx, params, email);
        case "email-verification":
          return await verifyEmail(ctx, params, email);
        default:
          throw new Error(
            'Missing `flow` param, it must be one of "signUp", "signIn", "reset", "reset-verification" or "email-verification"',
          );
      }
    },
    crypto: {
      hashSecret: async (password) => await new Scrypt().hash(password),
      verifySecret: async (password, hash) =>
        await new Scrypt().verify(hash, password),
    },
    extraProviders: [reset, verify],
  });
}
