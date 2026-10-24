// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MediaDetailModal } from "./media-detail-modal";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

let item: Record<string, unknown>;
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) =>
    getFunctionName(reference as never) === "media:getWithMetadata"
      ? item
      : undefined,
  useMutation: () => vi.fn(),
}));

beforeEach(() => {
  item = {
    _id: "media-1",
    collectionId: "object-1",
    collectionTitle: "Fishing net",
    fileName: "net.pdf",
    fileType: "document",
    fileSize: 2048,
    mimeType: "application/pdf",
    isPrimary: false,
    url: null,
    thumbnailUrl: null,
    originalUrl: null,
    uploadedAt: Date.parse("2026-10-01T12:00:00Z"),
    watermarked: false,
  };
});

async function renderModal() {
  await renderOnPage(
    <MediaDetailModal
      mediaId={"media-1" as Id<"mediaFiles">}
      organizationId={"org-1" as Id<"organizations">}
      onClose={() => {}}
    />,
    "/en/media",
  );
}

test("a file without a statement of its own shows the organization's default, linked to it", async () => {
  item = { ...item, rightsStatementInEffect: IN_COPYRIGHT };
  await renderModal();

  const link = screen.getByRole("link", { name: "In Copyright" });
  expect(link.getAttribute("href")).toBe(IN_COPYRIGHT);
  expect(link.getAttribute("rel")).toContain("license");
  expect(screen.getByText("Organization default")).toBeTruthy();
});

test("a file's own statement is shown without the default note", async () => {
  item = { ...item, rightsStatement: CC_BY, rightsStatementInEffect: CC_BY };
  await renderModal();

  expect(
    screen.getByRole("link", {
      name: "Creative Commons Attribution 4.0 International",
    }),
  ).toBeTruthy();
  expect(screen.queryByText("Organization default")).toBeNull();
});

test("with no statement in effect, none is shown", async () => {
  await renderModal();

  expect(screen.getByText("net.pdf")).toBeTruthy();
  expect(screen.queryByText("Rights statement")).toBeNull();
});
