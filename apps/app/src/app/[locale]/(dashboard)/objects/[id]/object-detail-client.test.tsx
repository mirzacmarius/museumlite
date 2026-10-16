// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import type { ObjectDetailData } from "./_components/types";
import { ObjectDetailClient } from "./object-detail-client";

interface ModuleSettings {
  enabledModules: [];
  disabledModules?: ["comments"];
}

const COMMENTS_ON: ModuleSettings = { enabledModules: [] };
const COMMENTS_OFF: ModuleSettings = {
  enabledModules: [],
  disabledModules: ["comments"],
};
let settingsByOrganization: Record<string, ModuleSettings>;

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  usePreloadedQuery: () => undefined,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => {
    const organizations = Object.entries(settingsByOrganization).map(
      ([_id, settings]) => ({ _id, settings }),
    );
    return {
      currentOrganizationId: "org-current",
      currentOrganization: organizations[0],
      organizations,
    };
  },
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    permissions: ["collections.read", "collections.update"],
  }),
}));
vi.mock("./_components/object-detail/object-detail-header", () => ({
  ObjectDetailHeader: () => null,
}));
vi.mock("./_components/object-detail/object-detail-hero", () => ({
  ObjectDetailHero: () => null,
}));
vi.mock("./_components/object-entry-notice", () => ({
  ObjectEntryNotice: () => null,
}));

async function renderObjectOf(organizationId: string) {
  const objectDetail = {
    collection: {
      _id: "object-1",
      organizationId,
      title: "Harbour at Dawn",
      accessionNumber: "2026.1",
      status: "active",
    },
    collectionGroup: null,
    locationPath: [],
    heroImage: null,
  } as unknown as ObjectDetailData;
  await renderOnPage(
    <ObjectDetailClient
      collectionId={"object-1" as Id<"collections">}
      initialObjectDetail={objectDetail}
    />,
    "/en/objects/object-1",
    { id: "object-1" },
  );
}

beforeEach(() => {
  settingsByOrganization = { "org-current": COMMENTS_ON };
});

test("an object shows its Comments tab while the Comments module is on", async () => {
  await renderObjectOf("org-current");

  expect(screen.getByRole("button", { name: "Comments" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Logs" })).toBeTruthy();
});

test("an object has no Comments tab once the Comments module is off", async () => {
  settingsByOrganization = { "org-current": COMMENTS_OFF };
  await renderObjectOf("org-current");

  expect(screen.queryByRole("button", { name: "Comments" })).toBeNull();
  expect(screen.getByRole("button", { name: "Logs" })).toBeTruthy();
});

test("an object follows the Comments module of the organization that holds it", async () => {
  settingsByOrganization = {
    "org-current": COMMENTS_ON,
    "org-holder": COMMENTS_OFF,
  };
  await renderObjectOf("org-holder");

  expect(screen.queryByRole("button", { name: "Comments" })).toBeNull();
});
