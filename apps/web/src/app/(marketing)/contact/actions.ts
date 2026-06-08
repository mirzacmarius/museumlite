"use server";

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
  } catch (submitError) {
    return {
      ok: false,
      error:
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
    };
  }
}
