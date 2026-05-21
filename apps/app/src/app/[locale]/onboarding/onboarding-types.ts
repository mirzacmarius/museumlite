export type OnboardingStep = "username" | "organization" | "firstData";

export type OrganizationType = "museum" | "gallery" | "library" | "collector";

export interface OrganizationFormData {
  name: string;
  slug: string;
  type: OrganizationType;
}

export function getConvexErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return null;
  }

  const data = error.data;
  if (!data || typeof data !== "object" || !("code" in data)) {
    return null;
  }

  const { code } = data;
  return typeof code === "string" ? code : null;
}

export function isOrganizationSlugTakenError(error: unknown): boolean {
  const code = getConvexErrorCode(error);
  if (code === "ORGANIZATION_SLUG_TAKEN") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return `${error.message}\n${error.stack ?? ""}`.includes(
    "Organization slug already exists",
  );
}
