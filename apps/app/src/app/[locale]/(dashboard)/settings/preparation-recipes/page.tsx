"use client";

import { useOrganization } from "@/components/organization-provider";
import { RecipesManager } from "./_components/recipes-manager";

export default function PreparationRecipesSettingsPage() {
  const { currentOrganization } = useOrganization();
  if (!currentOrganization) return null;
  return <RecipesManager organizationId={currentOrganization._id} />;
}
