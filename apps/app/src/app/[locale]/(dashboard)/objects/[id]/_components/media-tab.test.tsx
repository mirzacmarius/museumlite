// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { createRef, type ReactNode, type RefObject } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import {
  CollectionEditMediaTab,
  type CollectionEditMediaTabProps,
} from "../../_components/collection-edit-form/tabs/media-tab";
import { ObjectImageGallery } from "../../_components/collection-form-shared/object-image-gallery";
import { createEmptyFormData } from "../../_components/collection-form-shared/utils";
import { MediaTab } from "./media-tab";
import type { CollectionData } from "./types";

const objectId = "object-1" as Id<"collections">;
const imageUrl = "/storage/dwarf-front.jpg";
const documentUrl = "/storage/condition-report.docx";
const frontView = {
  _id: "media-image",
  collectionId: objectId,
  fileName: "dwarf-front.jpg",
  fileType: "image",
  mimeType: "image/jpeg",
  mediaCategory: "image",
  fileSize: 204_800,
  isPrimary: false,
  url: imageUrl,
  thumbnailUrl: null,
};
const conditionReport = {
  _id: "media-document",
  collectionId: objectId,
  fileName: "condition-report.docx",
  fileType: "document",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mediaCategory: "document",
  fileSize: 51_200,
  isPrimary: false,
  url: documentUrl,
  thumbnailUrl: null,
};

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) =>
    getFunctionName(reference as never) === "media:list"
      ? [frontView, conditionReport]
      : [],
  useMutation: () => vi.fn(),
}));
// Every permission is granted, so nothing below is hidden for lack of one.
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

const objectRecord = {
  _id: objectId,
  title: "Dwarf (one of a pair)",
  links: [],
} as unknown as CollectionData;

function uploadControls() {
  return [
    ...screen.queryAllByRole("button", { name: /upload/i }),
    ...screen.queryAllByRole("link", { name: /upload/i }),
  ].map((control) => control.textContent);
}

function chooser(ref: RefObject<HTMLInputElement | null>) {
  if (!ref.current) throw new Error("file chooser is not rendered");
  return ref.current;
}

test("the object page shows media to view and download, with no way to upload", async () => {
  await renderOnPage(
    <MediaTab collectionId={objectId} collection={objectRecord} />,
    "/en/objects/object-1?tab=media",
    { id: "object-1" },
  );

  expect(screen.getByRole("heading", { name: "Visual Media" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "View dwarf-front.jpg" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
    documentUrl,
  );
  expect(
    screen.getByRole("link", { name: "Download" }).getAttribute("href"),
  ).toBe(documentUrl);

  expect(uploadControls()).toEqual([]);
  expect(document.querySelector('input[type="file"]')).toBeNull();
});

test("Edit Object offers image upload in its image panel and document upload in its Media tab", async () => {
  const user = userEvent.setup();
  const fileInputRef = createRef<HTMLInputElement>();
  const cameraInputRef = createRef<HTMLInputElement>();
  const documentInputRef = createRef<HTMLInputElement>();
  const onImageSelect = vi.fn();
  const onDocumentSelect = vi.fn();
  const savedMedia = {
    images: [frontView],
    documents: [conditionReport],
  } as unknown as Pick<CollectionEditMediaTabProps, "images" | "documents">;

  await renderOnPage(
    <>
      <ObjectImageGallery
        images={[{ id: frontView._id, src: imageUrl, alt: frontView.fileName }]}
        fileInputRef={fileInputRef}
        cameraInputRef={cameraInputRef}
        onFileSelect={onImageSelect}
      />
      <CollectionEditMediaTab
        formData={createEmptyFormData()}
        updateField={vi.fn()}
        placeholders={(key) => key}
        currentOrganizationId={"org-1" as Id<"organizations">}
        isLocationTrackingEnabled={false}
        collection={
          objectRecord as unknown as CollectionEditMediaTabProps["collection"]
        }
        typedCollectionId={objectId}
        {...savedMedia}
        common={(key) => key}
        t={(key) => key}
        documentInputRef={documentInputRef}
        handleDocumentSelect={onDocumentSelect}
        handleSetPrimary={vi.fn()}
        setEditingImageId={vi.fn()}
        markedImageIds={new Map()}
        onKeepImage={vi.fn()}
        hasConditionChanged={false}
        requiresConditionChangeNote={false}
        conditionChangeNote=""
        onConditionChangeNoteChange={vi.fn()}
      />
    </>,
    "/en/objects/object-1/edit?tab=media",
    { id: "object-1" },
  );

  const imageChooserOpened = vi.fn();
  chooser(fileInputRef).addEventListener("click", imageChooserOpened);
  await user.click(screen.getByRole("button", { name: "Upload" }));
  expect(imageChooserOpened).toHaveBeenCalledOnce();

  const documentChooserOpened = vi.fn();
  chooser(documentInputRef).addEventListener("click", documentChooserOpened);
  await user.click(screen.getByRole("button", { name: "Upload Documents" }));
  expect(documentChooserOpened).toHaveBeenCalledOnce();

  await user.upload(
    chooser(documentInputRef),
    new File(["report"], "loan-agreement.pdf", { type: "application/pdf" }),
  );
  expect(onDocumentSelect).toHaveBeenCalledOnce();
});

test("an image marked for deletion says so in Edit Object and can be kept", async () => {
  const user = userEvent.setup();
  const onKeepImage = vi.fn();
  await renderOnPage(
    <CollectionEditMediaTab
      formData={createEmptyFormData()}
      updateField={vi.fn()}
      placeholders={(key) => key}
      currentOrganizationId={"org-1" as Id<"organizations">}
      isLocationTrackingEnabled={false}
      collection={
        objectRecord as unknown as CollectionEditMediaTabProps["collection"]
      }
      typedCollectionId={objectId}
      images={[frontView] as unknown as CollectionEditMediaTabProps["images"]}
      documents={[]}
      common={(key) => key}
      t={(key) => key}
      documentInputRef={createRef<HTMLInputElement>()}
      handleDocumentSelect={vi.fn()}
      handleSetPrimary={vi.fn()}
      setEditingImageId={vi.fn()}
      markedImageIds={new Map([[frontView._id as Id<"mediaFiles">, true]])}
      onKeepImage={onKeepImage}
      hasConditionChanged={false}
      requiresConditionChangeNote={false}
      conditionChangeNote=""
      onConditionChangeNoteChange={vi.fn()}
    />,
    "/en/objects/object-1/edit?tab=media",
    { id: "object-1" },
  );

  expect(screen.getByText("Marked for deletion").textContent).toBe(
    "Marked for deletion",
  );
  await user.click(screen.getByRole("button", { name: "Keep image" }));
  expect(onKeepImage).toHaveBeenCalledWith(frontView._id);
});
