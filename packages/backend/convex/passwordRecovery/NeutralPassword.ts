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
import type { DataModel, Doc } from "../_generated/dataModel";
import { authRecoveryError } from "./authRecoveryErrors";
import { enforceCodeRequestLimit } from "./codeRequestLimit";

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
    const { account } = await retrieveAccount(ctx, {
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
 *   password is discarded, so it cannot replace the owner's password.
 *
 * Providers without email verification cannot make sign-up neutral, so they
 * refuse sign-up for every email and only keep legacy sign-in.
 */
export function NeutralPassword(config: NeutralPasswordConfig) {
  const { id: provider, reset, verify } = config;

  async function sendVerification(ctx: Ctx, account: Doc<"authAccounts">, params: Params) {
    if (!verify) return { userId: account.userId };
    return await signInViaProvider(ctx, verify, {
      accountId: account._id,
      params,
    });
  }

  async function signUp(ctx: Ctx, params: Params, email: string) {
    if (!verify) throw authRecoveryError("SignUpUnavailable");
    const secret = requirePasswordParam(params, "password");
    const existing = await findPasswordAccount(ctx, provider, email);
    if (existing) {
      await sendVerification(ctx, existing, { email });
      return null;
    }
    let created: Doc<"authAccounts">;
    try {
      ({ account: created } = await createAccount(ctx, {
        provider,
        account: { id: email, secret },
        profile: { email },
        shouldLinkViaEmail: true,
        shouldLinkViaPhone: false,
      }));
    } catch (error) {
      const raced = await findPasswordAccount(ctx, provider, email);
      if (!raced) throw error;
      await sendVerification(ctx, raced, { email });
      return null;
    }
    return await sendVerification(ctx, created, params);
  }

  async function signIn(ctx: Ctx, params: Params, email: string) {
    const secret = params.password;
    if (typeof secret !== "string") throw authRecoveryError("InvalidCredentials");
    let account: Doc<"authAccounts">;
    try {
      ({ account } = await retrieveAccount(ctx, {
        provider,
        account: { id: email, secret },
      }));
    } catch (error) {
      if (isLibraryFailure(error, failedCredentialReasons)) {
        throw authRecoveryError("InvalidCredentials");
      }
      throw error;
    }
    if (verify && !account.emailVerified) {
      return await sendVerification(ctx, account, params);
    }
    return { userId: account.userId };
  }

  async function requestReset(ctx: Ctx, email: string) {
    if (!reset) throw new Error(`Password reset is not enabled for ${provider}`);
    const account = await findPasswordAccount(ctx, provider, email);
    if (!account) {
      await enforceCodeRequestLimit(ctx, email);
      return null;
    }
    return await signInViaProvider(ctx, reset, {
      accountId: account._id,
      params: { email },
    });
  }

  async function completeReset(ctx: Ctx, params: Params, email: string) {
    if (!reset) throw new Error(`Password reset is not enabled for ${provider}`);
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
        await enforceCodeRequestLimit(ctx, email);
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
