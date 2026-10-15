// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { CollectionEditPhysicalTab } from "../../_components/collection-edit-form/tabs/physical-tab";
import { ConditionAssessmentPanel } from "./condition-assessment-panel";
import { PhysicalTab } from "./physical-tab";
import type { CollectionData } from "./types";

vi.mock("./object-incidents", () => ({ ObjectIncidents: () => null }));
vi.mock("@/components/materials-combobox", () => ({
  MaterialsCombobox: () => null,
}));

const ALL_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "collections.accept_condition",
  "media.read",
  "media.upload",
];
let permissions = new Set(ALL_PERMISSIONS);
const mediaItems = [
  {
    _id: "photo-1",
    fileName: "base.jpg",
    fileType: "image",
    uploadStatus: "completed",
  },
];
const assessments = [
  {
    _id: "assessment-1",
    condition: "Poor",
    assessedAt: 1790812800000,
    assessorName: "Assessor",
    status: "draft",
    summary: "Crack at base",
    observations: [],
    photos: [],
  },
];
const legacyEntry = {
  condition: "Fair",
  changedAt: 1759276800000,
  changedBy: "user-1",
  changedByName: "Ola Nordmann",
  note: "Recorded at intake",
};
let detail = acceptedDetail();

function acceptedDetail() {
  return {
    organizationId: "org",
    current: {
      condition: "Good" as string | null,
      source: "assessment",
      assessmentId: "assessment-0",
    },
    comparison: {},
    legacy: { history: [] as (typeof legacyEntry)[] },
  };
}

const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "conditionAssessments:create": vi.fn(),
  "conditionAssessments:accept": vi.fn(),
  "media:generateUploadUrl": vi.fn(),
  "media:create": vi.fn(),
};
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(reference as never)) {
      case "media:list":
        return mediaItems;
      case "conditionOptions:list":
        return [{ _id: "fair", name: "Fair", description: "Stable" }];
      case "conditionAssessments:getForObject":
        return detail;
      default:
        return undefined;
    }
  },
  usePaginatedQuery: () => ({
    results: assessments,
    status: "Exhausted",
    loadMore: () => {},
  }),
  useMutation: (reference: unknown) =>
    mutations[getFunctionName(reference as never)] ?? vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    hasPermission: (name: string) => permissions.has(name),
  }),
}));

const create = mutations["conditionAssessments:create"] as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  permissions = new Set(ALL_PERMISSIONS);
  detail = acceptedDetail();
  for (const mutation of Object.values(mutations)) mutation.mockReset();
  mutations["conditionAssessments:accept"]?.mockResolvedValue(null);
  create.mockResolvedValue("assessment-2");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderPanel() {
  await renderOnPage(
    <ConditionAssessmentPanel
      collectionId={"object-1" as Id<"collections">}
      mode="edit"
    />,
    "/en/objects/object-1/edit",
  );
  return userEvent.setup();
}

async function chooseCondition(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole("combobox", { name: "Condition" }));
  await user.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
  );
}

const viewedObject = {
  _id: "object-1",
  organizationId: "org",
  title: "Vase",
  condition: "Good",
} as CollectionData;

test("viewing an object shows its current condition and history without authoring controls", async () => {
  await renderOnPage(<PhysicalTab collection={viewedObject} />);

  const panel = screen.getByRole("region", { name: "Condition assessments" });
  expect(within(panel).getByText("Good").textContent).toBe("Good");
  expect(within(panel).getByText("Crack at base").textContent).toBe(
    "Crack at base",
  );
  for (const control of [
    "Set condition",
    "Add observation",
    "Upload photo",
    "Save draft",
    "Accept assessment",
  ]) {
    expect(screen.queryByRole("button", { name: control })).toBeNull();
  }
  expect(screen.queryByRole("heading", { name: "New assessment" })).toBeNull();
});

test("a reviewer who cannot edit the object accepts drafts from the view tab", async () => {
  permissions = new Set(["collections.read", "collections.accept_condition"]);
  await renderOnPage(<PhysicalTab collection={viewedObject} />);
  const user = userEvent.setup();

  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Accept assessment" }));

  expect(mutations["conditionAssessments:accept"]).toHaveBeenCalledWith({
    assessmentId: "assessment-1",
  });
});

test("the view tab lists legacy condition history once, with who recorded it", async () => {
  detail.legacy.history = [legacyEntry];
  await renderOnPage(
    <PhysicalTab
      collection={{ ...viewedObject, conditionHistory: [legacyEntry] }}
    />,
  );

  expect(screen.getAllByText("Legacy condition history")).toHaveLength(1);
  const panel = screen.getByRole("region", { name: "Condition assessments" });
  expect(within(panel).getByText(/Ola Nordmann/).textContent).toContain(
    "Ola Nordmann",
  );
});

test("standard conditions read in the staff member's language", async () => {
  await renderOnPage(
    <ConditionAssessmentPanel collectionId={"object-1" as Id<"collections">} />,
    "/no/objects/object-1",
  );

  const panel = screen.getByRole("region", { name: "Tilstandsvurderinger" });
  expect(within(panel).getByText("God").textContent).toBe("God");
  expect(within(panel).getByText("Dårlig").textContent).toBe("Dårlig");
});

test("an object with no recorded condition reads Unknown without a legacy caption", async () => {
  detail.current = { condition: null, source: "unknown", assessmentId: "" };
  await renderOnPage(
    <ConditionAssessmentPanel collectionId={"object-1" as Id<"collections">} />,
  );

  const panel = screen.getByRole("region", { name: "Condition assessments" });
  expect(within(panel).getByText("Unknown").textContent).toBe("Unknown");
  expect(
    within(panel).queryByText(
      "Legacy condition; source and date may be uncertain",
    ),
  ).toBeNull();
});

test("the edit Physical tab sets condition through an assessment dialog, not the legacy picker", async () => {
  const outerSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  await renderOnPage(
    <form onSubmit={outerSubmit}>
      <CollectionEditPhysicalTab
        formData={{ title: "Vase", condition: "Fair" }}
        updateField={vi.fn()}
        placeholders={() => ""}
        currentOrganizationId="org"
        typedCollectionId={"object-1" as Id<"collections">}
      />
    </form>,
    "/en/objects/object-1/edit",
  );
  const user = userEvent.setup();
  expect(screen.getByText("Good").textContent).toBe("Good");
  expect(screen.queryByText("Fair")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Set condition" }));
  const dialog = screen.getByRole("dialog", { name: "Set condition" });
  await chooseCondition(user, "Poor");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Summary" }),
    "Crack at base",
  );
  await user.click(within(dialog).getByRole("button", { name: "Save draft" }));

  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ condition: "Poor", summary: "Crack at base" }),
  );
  expect(outerSubmit).not.toHaveBeenCalled();
});

test("an accession's object draft keeps its intake condition picker", async () => {
  const updateField = vi.fn();
  await renderOnPage(
    <CollectionEditPhysicalTab
      formData={{ title: "Vase", condition: "Fair" }}
      updateField={updateField}
      placeholders={() => ""}
      currentOrganizationId="org"
    />,
  );
  const user = userEvent.setup();

  const condition = screen.getByRole("combobox", { name: "Condition" });
  expect(condition.textContent).toBe("Fair");
  await chooseCondition(user, "Poor");

  expect(updateField).toHaveBeenCalledWith("condition", "Poor");
  expect(screen.queryByRole("button", { name: "Set condition" })).toBeNull();
});

test("Set condition is offered to staff who may record or accept an assessment", async () => {
  permissions = new Set(["collections.read", "collections.accept_condition"]);
  const tab = (
    <CollectionEditPhysicalTab
      formData={{ title: "Vase" }}
      updateField={vi.fn()}
      placeholders={() => ""}
      currentOrganizationId="org"
      typedCollectionId={"object-1" as Id<"collections">}
    />
  );
  const { unmount } = await renderOnPage(tab);
  expect(
    screen.getByRole("button", { name: "Set condition" }).textContent,
  ).toBe("Set condition");
  unmount();

  permissions = new Set(["collections.read"]);
  await renderOnPage(tab);
  expect(screen.queryByRole("button", { name: "Set condition" })).toBeNull();
});

test("the condition picker offers translated standard conditions and the organization's own", async () => {
  const user = await renderPanel();

  await user.click(screen.getByRole("combobox", { name: "Condition" }));
  const options = screen.getAllByRole("option");
  const labels = ["Excellent", "Very Good", "Good", "Poor", "Fair"];
  expect(options).toHaveLength(labels.length);
  for (const [index, label] of labels.entries()) {
    expect(within(options[index]!).getByText(label).textContent).toBe(label);
  }
  await user.click(screen.getByRole("option", { name: /^Fair/ }));
  expect(screen.getByRole("combobox", { name: "Condition" }).textContent).toBe(
    "Fair",
  );
});

test("an assessment of today recorded in the morning is not dated in the future", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 8, 30));
  const user = await renderPanel();

  await chooseCondition(user, "Fair");
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Checked on receipt from the borrower",
  );
  await user.click(screen.getByRole("button", { name: "Save draft" }));

  expect(create).toHaveBeenCalledTimes(1);
  const { assessedAt } = create.mock.calls[0]?.[0] as { assessedAt: number };
  expect(assessedAt).toBeLessThanOrEqual(Date.now());
  expect(new Date(assessedAt).getDate()).toBe(10);
});

test("an assessment recorded the morning after the app was opened is dated that morning", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const opened = new Date();
  opened.setDate(opened.getDate() + 1);
  opened.setHours(17, 0, 0, 0);
  vi.setSystemTime(opened);
  const { unmount } = await renderOnPage(
    <ConditionAssessmentPanel
      collectionId={"object-1" as Id<"collections">}
      mode="edit"
    />,
  );
  unmount();
  const nextMorning = new Date(opened);
  nextMorning.setDate(opened.getDate() + 1);
  nextMorning.setHours(8, 30, 0, 0);
  vi.setSystemTime(nextMorning);

  const user = await renderPanel();
  await chooseCondition(user, "Good");
  await user.type(screen.getByRole("textbox", { name: "Summary" }), "Check");
  await user.click(screen.getByRole("button", { name: "Save draft" }));

  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ assessedAt: nextMorning.getTime() }),
  );
});

test("saving without a condition says so at the field and focuses it, keeping the summary", async () => {
  const user = await renderPanel();
  const summary = screen.getByRole("textbox", { name: "Summary" });
  await user.type(summary, "Checked on receipt from the borrower");

  await user.click(screen.getByRole("button", { name: "Save draft" }));

  const condition = screen.getByRole("combobox", { name: "Condition" });
  expect(condition.getAttribute("aria-invalid")).toBe("true");
  const described = condition.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(described)?.textContent).toBe(
    "Choose a condition.",
  );
  expect(document.activeElement).toBe(condition);
  expect((summary as HTMLTextAreaElement).value).toBe(
    "Checked on receipt from the borrower",
  );
  expect(create).not.toHaveBeenCalled();
});

test("a refused save is explained in words, takes focus and keeps the input", async () => {
  create.mockRejectedValue(new Error("[Request ID: 1a2b] Server Error"));
  const user = await renderPanel();
  await chooseCondition(user, "Fair");
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Checked on receipt from the borrower",
  );

  await user.click(screen.getByRole("button", { name: "Save draft" }));

  const refusal = await screen.findByRole("alert");
  expect(refusal.textContent).toBe("Could not save the draft. Try again.");
  expect(document.activeElement).toBe(refusal);
  expect(screen.getByRole("combobox", { name: "Condition" }).textContent).toBe(
    "Fair",
  );
});

test("photo upload is an application button, and the uploaded photo becomes evidence", async () => {
  mutations["media:generateUploadUrl"]?.mockResolvedValue({
    uploadUrl: "https://upload.test/1",
  });
  mutations["media:create"]?.mockResolvedValue("photo-2");
  const fetchUpload = vi.fn(async () =>
    Response.json({ storageId: "storage-2" }),
  );
  vi.stubGlobal("fetch", fetchUpload);
  const user = await renderPanel();

  const upload = screen.getByRole("button", { name: "Upload photo" });
  expect(upload.getAttribute("type")).toBe("button");
  const fileInput = screen.getByLabelText<HTMLInputElement>("Upload photo", {
    selector: "input",
  });
  expect(fileInput.hidden).toBe(true);
  await user.upload(
    fileInput,
    new File(["x"], "crack.jpg", { type: "image/jpeg" }),
  );
  expect((await screen.findByRole("status")).textContent).toBe(
    "Photo uploaded and selected.",
  );
  await chooseCondition(user, "Poor");
  await user.type(screen.getByRole("textbox", { name: "Summary" }), "Crack");
  await user.click(screen.getByRole("button", { name: "Save draft" }));

  expect(fetchUpload).toHaveBeenCalledWith(
    "https://upload.test/1",
    expect.objectContaining({ method: "POST" }),
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ photos: ["photo-2"] }),
  );
});

test("after a failed upload, choosing the same photo again retries it", async () => {
  mutations["media:generateUploadUrl"]
    ?.mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ uploadUrl: "https://upload.test/2" });
  mutations["media:create"]?.mockResolvedValue("photo-3");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ storageId: "storage-3" })),
  );
  const user = await renderPanel();
  const fileInput = screen.getByLabelText<HTMLInputElement>("Upload photo", {
    selector: "input",
  });
  const photo = new File(["x"], "crack.jpg", { type: "image/jpeg" });

  await user.upload(fileInput, photo);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Photo upload failed. Try again.",
  );
  await user.upload(fileInput, photo);

  expect((await screen.findByRole("status")).textContent).toBe(
    "Photo uploaded and selected.",
  );
  expect(mutations["media:generateUploadUrl"]).toHaveBeenCalledTimes(2);
});

test("observations can be removed without changing the remaining observation or evidence", async () => {
  const user = await renderPanel();
  await chooseCondition(user, "Poor");
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Inspection",
  );
  await user.click(screen.getByRole("button", { name: "Add observation" }));
  await user.click(screen.getByRole("button", { name: "Add observation" }));
  await user.type(screen.getAllByRole("textbox", { name: "Area" })[1]!, "Base");
  await user.type(
    screen.getAllByRole("textbox", { name: "Description" })[1]!,
    "Crack",
  );
  await user.selectOptions(
    screen.getAllByRole("combobox", { name: "Severity" })[1]!,
    "severe",
  );
  await user.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
  await user.click(screen.getByRole("checkbox", { name: "base.jpg" }));
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      condition: "Poor",
      summary: "Inspection",
      observations: [
        { area: "Base", description: "Crack", severity: "severe" },
      ],
      photos: ["photo-1"],
    }),
  );
  expect(
    screen.getByText("Draft saved. A reviewer can accept it.").textContent,
  ).toBe("Draft saved. A reviewer can accept it.");
});

test("a reviewer without capture permission can accept a draft but not record one", async () => {
  permissions.delete("collections.update");
  const user = await renderPanel();
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Accept assessment" }));
  expect(mutations["conditionAssessments:accept"]).toHaveBeenCalledWith({
    assessmentId: "assessment-1",
  });
  expect(
    screen.getByText("Assessment accepted. Current condition updated.")
      .textContent,
  ).toBe("Assessment accepted. Current condition updated.");
});
