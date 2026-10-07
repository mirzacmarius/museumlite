"use server";

/* oxlint-disable react-doctor/server-auth-actions -- Public marketing tour request; no session required. */

import { api } from "@v1/backend/convex/_generated/api";
import { fetchAction } from "convex/nextjs";

export interface SubmitTourRequestInput {
  name: string;
  institution: string;
  email: string;
  collectionSize?: string;
  message?: string;
}

export type SubmitTourRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitTourRequest(
  input: SubmitTourRequestInput,
): Promise<SubmitTourRequestResult> {
  try {
    await fetchAction(api.web.submitTourRequest, {
      name: input.name,
      institution: input.institution,
      email: input.email,
      collectionSize: input.collectionSize,
      message: input.message,
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "submission_failed",
    };
  }
}
