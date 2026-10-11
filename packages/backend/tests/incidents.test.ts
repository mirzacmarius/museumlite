import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { workErrorFromError } from "../convex/utils/workErrors";
import { addMember } from "./notificationFixtures";
import {
  authedForUser,
  createConvexTest,
  custodyConflictOf,
} from "./testHarness";

afterEach(() => {
  vi.useRealTimers();
});

const COORDINATOR_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "collections.coordinate_incidents",
  "locations.read",
  "locations.update",
  "media.read",
  "loans.read",
  "organization.manage_settings",
  "organization.view_analytics",
];
const RESPONDER_PERMISSIONS = [
  "collections.read",
  "collections.update",
  "locations.read",
  "locations.update",
  "media.read",
];
const VIEWER_PERMISSIONS = ["collections.read", "locations.read"];

async function setup() {
  const t = createConvexTest();
  const [organizationId, otherOrganizationId] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.insert("organizations", {
        name: "Home Museum",
        slug: "home-museum",
        type: "museum",
        subscriptionTier: "enterprise",
      }),
      ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: "other-museum",
        type: "museum",
        subscriptionTier: "enterprise",
      }),
    ]),
  );
  const coordinatorId = await addMember(
    t,
    organizationId,
    "cora",
    COORDINATOR_PERMISSIONS,
  );
  const responderId = await addMember(
    t,
    organizationId,
    "rita",
    RESPONDER_PERMISSIONS,
  );
  const colleagueId = await addMember(
    t,
    organizationId,
    "carl",
    RESPONDER_PERMISSIONS,
  );
  const viewerId = await addMember(
    t,
    organizationId,
    "vera",
    VIEWER_PERMISSIONS,
  );
  const outsiderId = await addMember(
    t,
    otherOrganizationId,
    "otto",
    COORDINATOR_PERMISSIONS,
  );
  const places = await t.run(async (ctx) => {
    const location = (name: string, organization = organizationId) =>
      ctx.db.insert("locations", {
        organizationId: organization,
        name,
        type: "room",
        sortOrder: 0,
        isActive: true,
      });
    const galleryId = await location("Gallery 2");
    const storeId = await location("Store A");
    const safeRoomId = await location("Safe room");
    const foreignLocationId = await location(
      "Their gallery",
      otherOrganizationId,
    );
    const object = (title: string, organization = organizationId) =>
      ctx.db.insert("collections", {
        organizationId: organization,
        accessionNumber: title,
        title,
        status: "active",
        catalogedBy: coordinatorId,
        catalogedAt: 1,
        currentLocationId:
          organization === organizationId ? galleryId : foreignLocationId,
      });
    return {
      galleryId,
      storeId,
      safeRoomId,
      foreignLocationId,
      vaseId: await object("Blue vase"),
      paintingId: await object("Harbour painting"),
      foreignObjectId: await object("Their bowl", otherOrganizationId),
    };
  });
  return {
    t,
    organizationId,
    otherOrganizationId,
    coordinatorId,
    responderId,
    colleagueId,
    viewerId,
    outsiderId,
    ...places,
    coordinator: authedForUser(t, coordinatorId),
    responder: authedForUser(t, responderId),
    colleague: authedForUser(t, colleagueId),
    viewer: authedForUser(t, viewerId),
    outsider: authedForUser(t, outsiderId),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function incidentOf(
  member: Setup["coordinator"],
  incidentId: Id<"incidents">,
) {
  const incident = await member.query(api.incidents.get, { incidentId });
  if (!incident) throw new Error("Incident not visible");
  return incident;
}

async function workErrorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    const data = workErrorFromError(error);
    if (!data) throw error;
    return data.code;
  }
  throw new Error("Expected the call to be rejected");
}

let intakeCounter = 0;

function waterLeak(
  s: Setup,
  overrides: Partial<{
    intakeKey: string;
    sensitive: boolean;
    collectionIds: Id<"collections">[];
    locationIds: Id<"locations">[];
    title: string;
  }> = {},
) {
  intakeCounter++;
  return {
    organizationId: s.organizationId,
    intakeKey: overrides.intakeKey ?? `intake-${intakeCounter}`,
    kind: "water" as const,
    title: overrides.title ?? "Water coming through the gallery ceiling",
    description: "Drip above the vase case; buckets placed.",
    discoveredAt: Date.now() - 60_000,
    locationIds: overrides.locationIds ?? [s.galleryId],
    collectionIds: overrides.collectionIds ?? [s.vaseId],
    impact: "at_risk" as const,
    sensitive: overrides.sensitive ?? false,
  };
}

test("any collection reader reports an incident that colleagues can read and outsiders cannot", async () => {
  const s = await setup();
  const { incidentId, duplicate } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s),
  );
  expect(duplicate).toBe(false);

  const seen = await incidentOf(s.responder, incidentId);
  expect(seen.incidentNumber).toMatch(/^INC-\d{4}-0001$/);
  expect(seen.status).toBe("reported");
  expect(seen.title).toBe("Water coming through the gallery ceiling");
  expect(seen.reportedByName).toBe("vera");
  expect(seen.locations.map((location) => location.name)).toEqual([
    "Gallery 2",
  ]);
  expect(
    seen.objects.map((object) => ({
      title: object.title,
      impact: object.impact,
      locationAtReportName: object.locationAtReportName,
    })),
  ).toEqual([
    {
      title: "Blue vase",
      impact: "at_risk",
      locationAtReportName: "Gallery 2",
    },
  ]);

  const list = await s.responder.query(api.incidents.list, {
    organizationId: s.organizationId,
    filter: "open",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(list.page.map((row) => row._id)).toEqual([incidentId]);

  expect(await s.outsider.query(api.incidents.get, { incidentId })).toBeNull();
  await expect(s.t.query(api.incidents.get, { incidentId })).rejects.toThrow();
  await expect(
    s.outsider.query(api.incidents.list, {
      organizationId: s.organizationId,
      filter: "open",
      paginationOpts: { numItems: 20, cursor: null },
    }),
  ).rejects.toThrow();
});

async function incidentNotifications(
  member: Setup["coordinator"],
  organizationId: Id<"organizations">,
  type: string,
) {
  const center = await member.query(api.notifications.getNotificationCenter, {
    organizationId,
  });
  return center.notifications
    .filter((notification) => notification.type === type)
    .map((notification) => notification.message);
}

test("a retried report is one incident and coordinators are notified once", async () => {
  const s = await setup();
  const report = waterLeak(s, { intakeKey: "form-1" });
  const first = await s.viewer.mutation(api.incidents.report, report);
  const retry = await s.viewer.mutation(api.incidents.report, report);
  expect(retry).toEqual({
    incidentId: first.incidentId,
    duplicate: true,
    visible: true,
  });

  const list = await s.coordinator.query(api.incidents.list, {
    organizationId: s.organizationId,
    filter: "open",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(list.page).toHaveLength(1);
  expect(
    await incidentNotifications(
      s.coordinator,
      s.organizationId,
      "incident_reported",
    ),
  ).toEqual([
    expect.stringContaining("Water coming through the gallery ceiling"),
  ]);
  // Only coordinators hear about a new report.
  expect(
    await incidentNotifications(
      s.responder,
      s.organizationId,
      "incident_reported",
    ),
  ).toEqual([]);
});

test("intake refuses foreign objects and locations, empty reports and impossible times", async () => {
  const s = await setup();
  for (const report of [
    waterLeak(s, { collectionIds: [s.vaseId, s.foreignObjectId] }),
    waterLeak(s, { locationIds: [s.foreignLocationId] }),
    waterLeak(s, { collectionIds: [], locationIds: [] }),
    waterLeak(s, { title: "   " }),
    { ...waterLeak(s), discoveredAt: Date.now() + 24 * 60 * 60 * 1000 },
    { ...waterLeak(s), occurredAt: Date.now() },
  ])
    expect(
      await workErrorCodeOf(s.viewer.mutation(api.incidents.report, report)),
    ).toBe("INVALID_INPUT");
  const list = await s.coordinator.query(api.incidents.list, {
    organizationId: s.organizationId,
    filter: "open",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(list.page).toEqual([]);
});

test("a sensitive incident is visible only to coordinators and the people named on it", async () => {
  const s = await setup();
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s, { sensitive: true, title: "Vase missing after event" }),
  );
  const listed = async (member: Setup["coordinator"]) =>
    (
      await member.query(api.incidents.list, {
        organizationId: s.organizationId,
        filter: "open",
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.map((row) => row._id);

  expect(await listed(s.viewer)).toEqual([incidentId]);
  expect(await listed(s.coordinator)).toEqual([incidentId]);
  expect(await listed(s.responder)).toEqual([]);
  expect(await s.responder.query(api.incidents.get, { incidentId })).toBeNull();
  // The coordinator's notification names only the number.
  const [message] = await incidentNotifications(
    s.coordinator,
    s.organizationId,
    "incident_reported",
  );
  expect(message).toMatch(/^INC-\d{4}-0001 \(restricted\)/);
  expect(message).not.toContain("Vase missing");
});

const FLOOD_PLAN = {
  name: "Water ingress response",
  trigger: "incident_response" as const,
  steps: [
    {
      title: "Cover or move objects under the leak",
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "event" as const, offsetDays: 0, offsetHours: 1 },
      dependsOn: [],
    },
    {
      title: "Assess condition of wet objects",
      evidence: "conditionAssessment" as const,
      owner: { kind: "caseAssignee" as const },
      due: { anchor: "event" as const, offsetDays: 0, offsetHours: 24 },
      dependsOn: [0],
    },
  ],
};

async function createPlan(s: Setup, plan = FLOOD_PLAN) {
  return await s.coordinator.mutation(api.preparationRecipes.create, {
    organizationId: s.organizationId,
    recipe: plan,
  });
}

async function incidentTasks(
  member: Setup["coordinator"],
  s: Setup,
  incidentId: Id<"incidents">,
) {
  const { tasks } = await member.query(api.caseTasks.listForCase, {
    organizationId: s.organizationId,
    caseType: "incident",
    caseId: incidentId,
  });
  return tasks;
}

test("a coordinator triages with a chosen plan whose steps become the lead's tasks once", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 12, 9, 30));
  const s = await setup();
  const planId = await createPlan(s);
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s),
  );
  const triage = {
    incidentId,
    severity: "major" as const,
    leadId: s.responderId,
    responderIds: [s.colleagueId],
    sensitive: false,
    plan: { kind: "plans" as const, recipeIds: [planId] },
    note: "Gallery closed to visitors",
  };

  expect(
    await workErrorCodeOf(s.responder.mutation(api.incidents.triage, triage)),
  ).toBe("NOT_INCIDENT_COORDINATOR");

  await s.coordinator.mutation(api.incidents.triage, triage);
  await s.coordinator.mutation(api.incidents.triage, triage);

  const incident = await incidentOf(s.colleague, incidentId);
  expect(incident.status).toBe("responding");
  expect(incident.severity).toBe("major");
  expect(incident.lead?.name).toBe("rita");
  expect(incident.plans).toEqual([
    { recipeId: planId, name: "Water ingress response" },
  ]);

  const tasks = await incidentTasks(s.responder, s, incidentId);
  expect(
    tasks
      .map((task) => ({
        title: task.title,
        owner: task.ownerName,
        due: task.dueDate,
      }))
      .sort((a, b) => (a.due ?? 0) - (b.due ?? 0)),
  ).toEqual([
    {
      title: "Cover or move objects under the leak",
      owner: "rita",
      due: Date.UTC(2026, 9, 12, 10, 30),
    },
    {
      title: "Assess condition of wet objects",
      owner: "rita",
      due: Date.UTC(2026, 9, 13, 9, 30),
    },
  ]);

  const center = await s.responder.query(
    api.notifications.getNotificationCenter,
    {
      organizationId: s.organizationId,
    },
  );
  expect(
    center.notifications.map((notification) => notification.type).sort(),
  ).toEqual(["incident_lead_assigned", "task_assigned", "task_assigned"]);
});

test("no plan is applied unless a coordinator chooses it, and only active incident plans can be chosen", async () => {
  const s = await setup();
  const planId = await createPlan(s);
  const loanRecipeId = await s.coordinator.mutation(
    api.preparationRecipes.create,
    {
      organizationId: s.organizationId,
      recipe: {
        name: "Loan packing",
        trigger: "intake_accepted",
        steps: [
          {
            title: "Catalog it",
            owner: { kind: "caseAssignee" },
            dependsOn: [],
          },
        ],
      },
    },
  );
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s),
  );
  const base = {
    incidentId,
    severity: "minor" as const,
    leadId: s.responderId,
    responderIds: [],
    sensitive: false,
  };
  for (const recipeId of [loanRecipeId]) {
    expect(
      await workErrorCodeOf(
        s.coordinator.mutation(api.incidents.triage, {
          ...base,
          plan: { kind: "plans", recipeIds: [recipeId] },
        }),
      ),
    ).toBe("PLAN_NOT_AVAILABLE");
  }
  await s.coordinator.mutation(api.preparationRecipes.setStatus, {
    recipeId: planId,
    status: "paused",
  });
  expect(
    await workErrorCodeOf(
      s.coordinator.mutation(api.incidents.triage, {
        ...base,
        plan: { kind: "plans", recipeIds: [planId] },
      }),
    ),
  ).toBe("PLAN_NOT_AVAILABLE");
  await s.coordinator.mutation(api.preparationRecipes.setStatus, {
    recipeId: planId,
    status: "active",
  });

  await s.coordinator.mutation(api.incidents.triage, {
    ...base,
    plan: { kind: "none" },
  });
  const incident = await incidentOf(s.coordinator, incidentId);
  expect(incident.status).toBe("responding");
  expect(incident.plans).toEqual([]);
  expect(await incidentTasks(s.coordinator, s, incidentId)).toEqual([]);
  // Applying recipes to the case adds nothing nobody chose.
  const outcome = await s.coordinator.mutation(
    api.preparationRecipes.applyToCase,
    {
      organizationId: s.organizationId,
      caseType: "incident",
      caseId: incidentId,
    },
  );
  expect(outcome.suggested).toBe(0);
  expect(await incidentTasks(s.coordinator, s, incidentId)).toEqual([]);
});

test("work on a sensitive incident stays with the people in its scope", async () => {
  const s = await setup();
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s, { sensitive: true, title: "Vase missing after the gala" }),
  );
  const triage = {
    incidentId,
    severity: "major" as const,
    leadId: s.responderId,
    responderIds: [] as Id<"users">[],
    sensitive: true,
    plan: { kind: "none" as const },
  };
  await s.coordinator.mutation(api.incidents.triage, triage);
  const task = {
    organizationId: s.organizationId,
    caseType: "incident" as const,
    caseId: incidentId,
    title: "Review gala camera footage",
  };

  const candidates = await s.coordinator.query(
    api.caseTasks.listAssignableMembers,
    {
      organizationId: s.organizationId,
      caseType: "incident",
      caseId: incidentId,
    },
  );
  expect(candidates.map((member) => member.name)).toEqual(["cora", "rita"]);
  expect(
    await workErrorCodeOf(
      s.coordinator.mutation(api.caseTasks.create, {
        ...task,
        ownerId: s.colleagueId,
      }),
    ),
  ).toBe("ASSIGNEE_NOT_ELIGIBLE");
  expect(
    await workErrorCodeOf(
      s.colleague.query(api.caseTasks.listForCase, {
        organizationId: s.organizationId,
        caseType: "incident",
        caseId: incidentId,
      }),
    ),
  ).toBe("CASE_NOT_FOUND");

  await s.coordinator.mutation(api.incidents.triage, {
    ...triage,
    responderIds: [s.colleagueId],
  });
  const taskId = await s.coordinator.mutation(api.caseTasks.create, {
    ...task,
    ownerId: s.colleagueId,
  });
  const myWork = await s.colleague.query(api.caseTasks.listMyWork, {
    organizationId: s.organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(myWork.page.map((row) => [row._id, row.caseLabel])).toEqual([
    [taskId, expect.stringMatching(/^INC-/)],
  ]);

  // Taking the colleague off the incident would strand their open task.
  expect(
    await workErrorCodeOf(s.coordinator.mutation(api.incidents.triage, triage)),
  ).toBe("ASSIGNEE_NOT_ELIGIBLE");

  // The organization audit log records who acted, not what the incident is about.
  const audit = await s.coordinator.query(api.auditLog.list, {
    organizationId: s.organizationId,
    limit: 100,
  });
  const logged = JSON.stringify(audit.entries);
  expect(logged).toContain("incident_triaged");
  expect(logged).toContain("task_created");
  expect(logged).not.toContain("gala");
});

test("an ordinary incident's tasks reach the owner's queue and every collection worker can read them", async () => {
  const s = await setup();
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s),
  );
  await s.coordinator.mutation(api.incidents.triage, {
    incidentId,
    severity: "minor",
    leadId: s.responderId,
    responderIds: [],
    sensitive: false,
    plan: { kind: "none" },
  });
  const taskId = await s.coordinator.mutation(api.caseTasks.create, {
    organizationId: s.organizationId,
    caseType: "incident",
    caseId: incidentId,
    title: "Dry the floor",
    ownerId: s.responderId,
  });
  const queue = async () =>
    (
      await s.responder.query(api.caseTasks.listMyWork, {
        organizationId: s.organizationId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.map((row) => row._id);
  expect(await queue()).toEqual([taskId]);
  const reviewer = await s.colleague.query(api.caseTasks.listForCase, {
    organizationId: s.organizationId,
    caseType: "incident",
    caseId: incidentId,
  });
  expect(reviewer.tasks).toHaveLength(1);
});

async function reportedLeak(s: Setup) {
  const { incidentId } = await s.viewer.mutation(
    api.incidents.report,
    waterLeak(s, { collectionIds: [s.vaseId] }),
  );
  return incidentId;
}

test("evacuation and recovery are guarded movements that cite the incident and survive a retry", async () => {
  const s = await setup();
  const incidentId = await reportedLeak(s);
  const evacuation = {
    incidentId,
    collectionId: s.vaseId,
    direction: "evacuation" as const,
    toLocationId: s.safeRoomId,
    expectedFromLocationId: s.galleryId,
    handoffKey: "evacuate-vase-1",
  };

  // Evacuation can start before triage, but only by someone who may move objects.
  expect(
    await workErrorCodeOf(
      s.viewer.mutation(api.incidents.recordHandoff, evacuation),
    ),
  ).toBe("NOT_INCIDENT_RESPONDER");
  const first = await s.responder.mutation(
    api.incidents.recordHandoff,
    evacuation,
  );
  const retry = await s.responder.mutation(
    api.incidents.recordHandoff,
    evacuation,
  );
  expect(retry).toEqual({ movementId: first.movementId, duplicate: true });

  const history = await s.responder.query(
    api.locations.getCollectionLocationHistory,
    {
      collectionId: s.vaseId,
    },
  );
  expect(
    history.map((row) => ({
      kind: row.movementKind,
      from: row.fromLocationName,
      to: row.toLocationName,
      reason: row.reason,
    })),
  ).toEqual([
    {
      kind: "incident_evacuation",
      from: "Gallery 2",
      to: "Safe room",
      reason: expect.stringMatching(/^Evacuation for INC-\d{4}-0001$/),
    },
  ]);

  // A colleague acting on what they saw earlier is told where the object is now.
  const stale = await custodyConflictOf(
    s.colleague.mutation(api.incidents.recordHandoff, {
      ...evacuation,
      toLocationId: s.storeId,
      handoffKey: "evacuate-vase-2",
    }),
  );
  expect(stale?.code).toBe("SOURCE_CHANGED");

  const notLinked = await workErrorCodeOf(
    s.responder.mutation(api.incidents.recordHandoff, {
      ...evacuation,
      collectionId: s.paintingId,
      handoffKey: "evacuate-painting",
    }),
  );
  expect(notLinked).toBe("OBJECT_NOT_AFFECTED");

  await s.responder.mutation(api.incidents.recordHandoff, {
    incidentId,
    collectionId: s.vaseId,
    direction: "recovery",
    toLocationId: s.galleryId,
    expectedFromLocationId: s.safeRoomId,
    handoffKey: "recover-vase-1",
  });
  const incident = await incidentOf(s.coordinator, incidentId);
  expect(incident.objects[0]).toMatchObject({
    currentLocationName: "Gallery 2",
    locationAtReportName: "Gallery 2",
    lastHandoff: { direction: "recovery", toLocationName: "Gallery 2" },
  });
  expect(
    incident.handoffs.map((row) => [
      row.direction,
      row.fromLocationName,
      row.toLocationName,
    ]),
  ).toEqual([
    ["evacuation", "Gallery 2", "Safe room"],
    ["recovery", "Safe room", "Gallery 2"],
  ]);
  expect(incident.events.map((event) => event.action)).toEqual(
    expect.arrayContaining(["evacuated", "recovered"]),
  );
});

test("affected objects are added and re-assessed but never unlinked", async () => {
  const s = await setup();
  const incidentId = await reportedLeak(s);
  expect(
    await workErrorCodeOf(
      s.viewer.mutation(api.incidents.addObjects, {
        incidentId,
        collectionIds: [s.paintingId],
        impact: "damaged",
      }),
    ),
  ).toBe("NOT_INCIDENT_RESPONDER");
  expect(
    await workErrorCodeOf(
      s.responder.mutation(api.incidents.addObjects, {
        incidentId,
        collectionIds: [s.foreignObjectId],
        impact: "damaged",
      }),
    ),
  ).toBe("INVALID_INPUT");
  await s.responder.mutation(api.incidents.addObjects, {
    incidentId,
    collectionIds: [s.paintingId, s.vaseId],
    impact: "damaged",
  });
  await s.responder.mutation(api.incidents.setObjectImpact, {
    incidentId,
    collectionId: s.vaseId,
    impact: "unaffected",
    note: "Case kept it dry",
  });
  const incident = await incidentOf(s.coordinator, incidentId);
  expect(
    incident.objects
      .map((object) => [object.title, object.impact, object.note])
      .sort(),
  ).toEqual([
    ["Blue vase", "unaffected", "Case kept it dry"],
    ["Harbour painting", "damaged", undefined],
  ]);
});

async function evidenceFixtures(s: Setup) {
  return await s.t.run(async (ctx) => {
    const assessment = (
      collectionId: Id<"collections">,
      status: "draft" | "accepted",
      organizationId = s.organizationId,
    ) =>
      ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: s.responderId,
        assessedAt: 10,
        recordedAt: 10,
        condition: "poor",
        summary: "Water staining on the base",
        observations: [],
        photos: [],
        status,
        ...(status === "accepted"
          ? { acceptedBy: s.coordinatorId, acceptedAt: 11 }
          : {}),
      });
    const policyId = await ctx.db.insert("insurancePolicies", {
      organizationId: s.organizationId,
      policyNumber: "FA-2026-01",
      carrier: "Fine Art Mutual",
      policyType: "scheduled",
      coverageAmount: 1_000_000,
      currency: "EUR",
      effectiveDate: Date.UTC(2026, 0, 1),
      expirationDate: Date.UTC(2027, 0, 1),
      status: "active",
      createdBy: s.coordinatorId,
      createdAt: 1,
    });
    await ctx.db.insert("insuranceCoverages", {
      organizationId: s.organizationId,
      policyId,
      targetType: "object",
      collectionId: s.vaseId,
      coveredValue: 25_000,
      currency: "EUR",
      status: "active",
      createdBy: s.coordinatorId,
      createdAt: 1,
    });
    const claimId = await ctx.db.insert("insuranceClaims", {
      organizationId: s.organizationId,
      policyId,
      claimNumber: "CLM-2026-0001",
      collectionIds: [s.vaseId],
      incidentDate: 20,
      incidentType: "water",
      incidentDescription: "Ceiling leak",
      claimedAmount: 4000,
      currency: "EUR",
      status: "draft",
      reportedDate: 21,
      createdBy: s.coordinatorId,
      createdAt: 21,
    });
    const mediaId = await ctx.db.insert("mediaFiles", {
      collectionId: s.vaseId,
      organizationId: s.organizationId,
      storageId: await ctx.storage.store(new Blob(["stain"])),
      fileName: "vase-stain.jpg",
      fileType: "image",
      fileSize: 5,
      mimeType: "image/jpeg",
      isPrimary: false,
      uploadedBy: s.responderId,
      uploadedAt: 12,
      uploadStatus: "completed",
    });
    return {
      acceptedId: await assessment(s.vaseId, "accepted"),
      draftId: await assessment(s.vaseId, "draft"),
      paintingAssessmentId: await assessment(s.paintingId, "accepted"),
      claimId,
      mediaId,
    };
  });
}

test("assessments, photos and claims are linked as retained evidence each viewer sees only with access", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 12, 9, 30));
  const s = await setup();
  const incidentId = await reportedLeak(s);
  const records = await evidenceFixtures(s);
  const link = (
    member: Setup["coordinator"],
    reference:
      | { kind: "conditionAssessment"; id: Id<"conditionAssessments"> }
      | { kind: "media"; id: Id<"mediaFiles"> }
      | { kind: "insuranceClaim"; id: Id<"insuranceClaims"> },
  ) =>
    member.mutation(api.incidentEvidence.linkEvidence, {
      incidentId,
      reference,
    });

  const assessmentLink = await link(s.responder, {
    kind: "conditionAssessment",
    id: records.acceptedId,
  });
  expect(
    await link(s.responder, {
      kind: "conditionAssessment",
      id: records.acceptedId,
    }),
  ).toBe(assessmentLink);
  expect(
    await workErrorCodeOf(
      link(s.responder, { kind: "conditionAssessment", id: records.draftId }),
    ),
  ).toBe("EVIDENCE_NOT_FOUND");
  expect(
    await workErrorCodeOf(
      link(s.responder, {
        kind: "conditionAssessment",
        id: records.paintingAssessmentId,
      }),
    ),
  ).toBe("OBJECT_NOT_AFFECTED");
  await link(s.responder, { kind: "media", id: records.mediaId });
  // Claims need insurance access.
  expect(
    await link(s.responder, {
      kind: "insuranceClaim",
      id: records.claimId,
    }).catch(() => "refused"),
  ).toBe("refused");
  await link(s.coordinator, { kind: "insuranceClaim", id: records.claimId });

  const evidenceOf = async (member: Setup["coordinator"]) =>
    (
      await member.query(api.incidentEvidence.getEvidence, { incidentId })
    ).evidence.map((row) => ({
      kind: row.kind,
      label: row.label,
      retracted: row.retraction?.reason,
    }));
  expect(await evidenceOf(s.coordinator)).toEqual([
    {
      kind: "conditionAssessment",
      label: "Blue vase - poor: Water staining on the base",
      retracted: undefined,
    },
    {
      kind: "media",
      label: "Blue vase - vase-stain.jpg",
      retracted: undefined,
    },
    {
      kind: "insuranceClaim",
      label: "CLM-2026-0001 (draft)",
      retracted: undefined,
    },
  ]);
  // The viewer reads assessments but not files or claims.
  expect(await evidenceOf(s.viewer)).toEqual([
    {
      kind: "conditionAssessment",
      label: "Blue vase - poor: Water staining on the base",
      retracted: undefined,
    },
    { kind: "media", label: undefined, retracted: undefined },
    { kind: "insuranceClaim", label: undefined, retracted: undefined },
  ]);

  expect(
    await workErrorCodeOf(
      s.responder.mutation(api.incidentEvidence.retractEvidence, {
        evidenceId: assessmentLink,
        reason: " ",
      }),
    ),
  ).toBe("INVALID_INPUT");
  await s.responder.mutation(api.incidentEvidence.retractEvidence, {
    evidenceId: assessmentLink,
    reason: "Assessment predates the leak",
  });
  expect((await evidenceOf(s.coordinator))[0]).toEqual({
    kind: "conditionAssessment",
    label: "Blue vase - poor: Water staining on the base",
    retracted: "Assessment predates the leak",
  });

  // Coverage in force when the incident was discovered, for insurance readers only.
  const coverage = await s.coordinator.query(api.incidentEvidence.getEvidence, {
    incidentId,
  });
  expect(coverage.coverage).toEqual([
    {
      collectionId: s.vaseId,
      objectTitle: "Blue vase",
      policyNumber: "FA-2026-01",
      carrier: "Fine Art Mutual",
      coveredValue: 25_000,
      currency: "EUR",
    },
  ]);
  expect(
    (await s.responder.query(api.incidentEvidence.getEvidence, { incidentId }))
      .coverage,
  ).toBeNull();
});

test("evidence candidates come from the affected objects and the claims that name them", async () => {
  const s = await setup();
  const incidentId = await reportedLeak(s);
  const records = await evidenceFixtures(s);
  const candidates = await s.coordinator.query(
    api.incidentEvidence.listEvidenceCandidates,
    { incidentId },
  );
  expect(candidates.map((row) => row.reference.id).sort()).toEqual(
    [records.acceptedId, records.mediaId, records.claimId].sort(),
  );
  const responderCandidates = await s.responder.query(
    api.incidentEvidence.listEvidenceCandidates,
    { incidentId },
  );
  expect(responderCandidates.map((row) => row.reference.kind).sort()).toEqual([
    "conditionAssessment",
    "media",
  ]);
});

test("an incident closes only with an after-action record and no open tasks, and can be reopened", async () => {
  const s = await setup();
  const incidentId = await reportedLeak(s);
  await s.coordinator.mutation(api.incidents.triage, {
    incidentId,
    severity: "moderate",
    leadId: s.responderId,
    responderIds: [s.colleagueId],
    sensitive: false,
    plan: { kind: "none" },
  });
  await s.responder.mutation(api.incidents.recordHandoff, {
    incidentId,
    collectionId: s.vaseId,
    direction: "evacuation",
    toLocationId: s.safeRoomId,
    expectedFromLocationId: s.galleryId,
    handoffKey: "evacuate",
  });
  const taskId = await s.coordinator.mutation(api.caseTasks.create, {
    organizationId: s.organizationId,
    caseType: "incident",
    caseId: incidentId,
    title: "Dry the floor",
    ownerId: s.responderId,
  });
  const afterAction = {
    incidentId,
    summary: "Roof drain blocked; one vase moved, no damage.",
    whatWorked: "Buckets and the safe room were ready",
    improvements: "Inspect roof drains monthly",
  };

  expect(
    await workErrorCodeOf(
      s.responder.mutation(api.incidents.close, afterAction),
    ),
  ).toBe("NOT_INCIDENT_COORDINATOR");
  expect(
    await workErrorCodeOf(
      s.coordinator.mutation(api.incidents.close, afterAction),
    ),
  ).toBe("TASKS_OPEN");
  expect(
    await workErrorCodeOf(
      s.coordinator.mutation(api.incidents.close, {
        ...afterAction,
        summary: "",
      }),
    ),
  ).toBe("INVALID_INPUT");

  await s.responder.mutation(api.caseTasks.complete, { taskId });
  await s.coordinator.mutation(api.incidents.close, afterAction);
  await s.coordinator.mutation(api.incidents.close, afterAction);

  const closed = await incidentOf(s.colleague, incidentId);
  expect(closed.status).toBe("closed");
  expect(closed.afterAction?.summary).toBe(afterAction.summary);
  // Closing records nothing physical: the vase is still in the safe room.
  expect(closed.objects[0]?.currentLocationName).toBe("Safe room");
  expect(
    await workErrorCodeOf(
      s.responder.mutation(api.incidents.addObjects, {
        incidentId,
        collectionIds: [s.paintingId],
        impact: "at_risk",
      }),
    ),
  ).toBe("STATUS_CHANGED");
  const closedList = await s.coordinator.query(api.incidents.list, {
    organizationId: s.organizationId,
    filter: "closed",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(closedList.page.map((row) => row._id)).toEqual([incidentId]);
  for (const member of [s.responder, s.colleague])
    expect(
      await incidentNotifications(member, s.organizationId, "incident_closed"),
    ).toHaveLength(1);

  expect(
    await workErrorCodeOf(
      s.coordinator.mutation(api.incidents.reopen, { incidentId, reason: "" }),
    ),
  ).toBe("INVALID_INPUT");
  await s.coordinator.mutation(api.incidents.reopen, {
    incidentId,
    reason: "Leak returned overnight",
  });
  const reopened = await incidentOf(s.coordinator, incidentId);
  expect(reopened.status).toBe("responding");
  expect(reopened.afterAction).toBeUndefined();
  expect(reopened.events.map((event) => event.action).slice(0, 2)).toEqual([
    "reopened",
    "closed",
  ]);
  expect(reopened.events[1]?.note).toBe(afterAction.summary);
});

test("reporting from the same alert episode again opens the existing incident", async () => {
  const s = await setup();
  const episodeId = await s.t.run((ctx) =>
    ctx.db.insert("alertEpisodes", {
      organizationId: s.organizationId,
      locationId: s.storeId,
      status: "open",
      startedAt: 100,
      lastObservedAt: 200,
      thresholds: { humidityMax: 60 },
      breaches: [{ measure: "humidity", direction: "above" }],
      ranges: { humidity: { min: 61, max: 78 } },
      escalationLevel: 1,
      readingCount: 4,
      outOfRangeCount: 4,
      lateReadingCount: 0,
      sources: [{ lastObservedAt: 200 }],
    }),
  );
  const fromEpisode = (intakeKey: string) => ({
    ...waterLeak(s, { intakeKey, collectionIds: [], locationIds: [] }),
    kind: "environmental" as const,
    title: "Humidity high in Store A",
    alertEpisodeId: episodeId,
  });
  const first = await s.responder.mutation(
    api.incidents.report,
    fromEpisode("a"),
  );
  const second = await s.colleague.mutation(
    api.incidents.report,
    fromEpisode("b"),
  );
  expect(second).toEqual({
    incidentId: first.incidentId,
    duplicate: true,
    visible: true,
  });
  const incident = await incidentOf(s.coordinator, first.incidentId);
  expect(incident.source).toEqual({ kind: "alertEpisode", episodeId });
  expect(incident.locations.map((location) => location.name)).toEqual([
    "Store A",
  ]);
  expect(
    incident.events.map((event) => [event.action, event.actorName]),
  ).toEqual([
    ["report_repeated", "carl"],
    ["reported", "rita"],
  ]);
  // Episodes are location records; reporting from one needs location access.
  const noLocations = await addMember(s.t, s.organizationId, "nils", [
    "collections.read",
  ]);
  expect(
    await workErrorCodeOf(
      authedForUser(s.t, noLocations).mutation(
        api.incidents.report,
        fromEpisode("c"),
      ),
    ),
  ).toBe("INVALID_INPUT");
});

test("the grant migration lets existing curators and collection managers coordinate incidents, and no one else", async () => {
  vi.useFakeTimers();
  const s = await setup();
  const member = async (
    username: string,
    roleName: string,
    permissions: string[],
  ) => {
    const userId = await s.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: username, username });
      const roleId = await ctx.db.insert("roles", {
        organizationId: s.organizationId,
        name: roleName,
        isSystemRole: true,
      });
      for (const name of permissions) {
        const permissionId = await ctx.db.insert("permissions", {
          name,
          category: "collections",
        });
        await ctx.db.insert("rolePermissions", { roleId, permissionId });
      }
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: s.organizationId,
        roleId,
        joinedAt: 1,
      });
      return userId;
    });
    return authedForUser(s.t, userId);
  };
  const curator = await member("cleo", "curator", [
    "collections.read",
    "collections.update",
  ]);
  const cataloger = await member("cato", "cataloger", [
    "collections.read",
    "collections.update",
  ]);
  const incidentId = await reportedLeak(s);
  const triage = {
    incidentId,
    severity: "minor" as const,
    leadId: s.responderId,
    responderIds: [],
    sensitive: false,
    plan: { kind: "none" as const },
  };
  expect(
    await workErrorCodeOf(curator.mutation(api.incidents.triage, triage)),
  ).toBe("NOT_INCIDENT_COORDINATOR");

  for (let run = 0; run < 2; run++) {
    await s.t.mutation(
      internal.migrations.grantIncidentCoordinationPermissions,
      {},
    );
    await s.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  }

  await curator.mutation(api.incidents.triage, triage);
  expect(
    await workErrorCodeOf(cataloger.mutation(api.incidents.triage, triage)),
  ).toBe("NOT_INCIDENT_COORDINATOR");
});

test("coordinators pick from active incident plans and eligible members; objects list the incidents they are in", async () => {
  const s = await setup();
  const planId = await createPlan(s);
  const pausedId = await createPlan(s, {
    ...FLOOD_PLAN,
    name: "Old fire plan",
  });
  await s.coordinator.mutation(api.preparationRecipes.setStatus, {
    recipeId: pausedId,
    status: "paused",
  });
  const incidentId = await reportedLeak(s);
  const restrictedId = (
    await s.viewer.mutation(
      api.incidents.report,
      waterLeak(s, { sensitive: true, title: "Theft suspected" }),
    )
  ).incidentId;

  const plans = await s.coordinator.query(api.incidents.listPlanOptions, {
    organizationId: s.organizationId,
  });
  expect(plans).toEqual([
    {
      recipeId: planId,
      name: "Water ingress response",
      steps: [
        {
          key: "s1",
          title: "Cover or move objects under the leak",
          offsetHours: 1,
        },
        {
          key: "s2",
          title: "Assess condition of wet objects",
          offsetHours: 24,
        },
      ],
    },
  ]);
  expect(
    await workErrorCodeOf(
      s.responder.query(api.incidents.listPlanOptions, {
        organizationId: s.organizationId,
      }),
    ),
  ).toBe("NOT_INCIDENT_COORDINATOR");

  const members = await s.coordinator.query(api.incidents.listTeamCandidates, {
    incidentId,
  });
  expect(members.map((member) => [member.name, member.canLead])).toEqual([
    ["carl", true],
    ["cora", true],
    ["rita", true],
    ["vera", false],
  ]);

  const forVase = async (member: Setup["coordinator"]) =>
    (
      await member.query(api.incidents.listForObject, {
        collectionId: s.vaseId,
      })
    ).map((row) => row._id);
  expect((await forVase(s.coordinator)).sort()).toEqual(
    [incidentId, restrictedId].sort(),
  );
  expect(await forVase(s.responder)).toEqual([incidentId]);
  expect(await forVase(s.outsider).catch(() => "refused")).toBe("refused");
});
