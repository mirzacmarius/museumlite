import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { alertEpisodeErrorCodeFromError } from "../convex/utils/alertEpisodeErrors";
import { addMember } from "./notificationFixtures";
import {
  authedForUser,
  type ConvexTest,
  createConvexTestWithRateLimiter,
  createOrgUserWithPermissions,
} from "./testHarness";

const PAPER_STORE_THRESHOLDS = {
  temperatureMin: 18,
  temperatureMax: 22,
  humidityMin: 40,
  humidityMax: 55,
};

/** Awaits a call expected to fail and returns its alert episode error code. */
async function alertEpisodeErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return alertEpisodeErrorCodeFromError(error) ?? error;
  }
  throw new Error("Expected the call to be rejected");
}

/** An organization whose location administrator manages a paper store. */
async function paperStore(t: ConvexTest) {
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "organization.manage_settings",
    "locations.read",
    "locations.update",
  ]);
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Paper Store",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );
  return {
    organizationId,
    locationId,
    managerId: userId,
    manager: authedForUser(t, userId),
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

interface ReadingInput {
  readingId: string;
  observedAt: number;
  temperature?: number;
  humidity?: number;
}

/** Posts one reading from a device through the authenticated HTTP receiver. */
function sendReading(
  t: ConvexTest,
  token: string,
  probeId: string,
  reading: ReadingInput,
) {
  return t.fetch("/v1/environmental-readings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      readingId: reading.readingId,
      probeId,
      timestamp: reading.observedAt,
      temperature: { value: reading.temperature ?? 20, unit: "C" },
      humidity: { value: reading.humidity ?? 50, unit: "%" },
    }),
  });
}

/** The paper store with thresholds set and one probe of a logger bound to it. */
async function monitoredPaperStore(t: ConvexTest) {
  const store = await paperStore(t);
  const { organizationId, locationId, manager } = store;
  await manager.mutation(api.environmentalMonitoring.setThresholds, {
    locationId,
    thresholds: PAPER_STORE_THRESHOLDS,
  });
  const { deviceId, token } = await manager.mutation(
    api.environmentalDevices.register,
    { organizationId, name: "Store logger" },
  );
  await manager.mutation(api.environmentalDevices.bindProbe, {
    organizationId,
    deviceId,
    probeId: "probe-1",
    locationId,
  });
  return {
    ...store,
    deviceId,
    token,
    send: (reading: ReadingInput) => sendReading(t, token, "probe-1", reading),
    monitoring: (now = Date.now()) =>
      manager.query(api.environmentalMonitoring.getLocationMonitoring, {
        locationId,
        now,
      }),
    notifications: async () =>
      (
        await manager.query(api.notifications.getNotificationCenter, {
          organizationId,
        })
      ).notifications,
  };
}

describe("environmental thresholds", () => {
  test("a location administrator sets the thresholds that monitoring reports", async () => {
    const t = createConvexTestWithRateLimiter();
    const { locationId, manager } = await paperStore(t);

    await manager.mutation(api.environmentalMonitoring.setThresholds, {
      locationId,
      thresholds: PAPER_STORE_THRESHOLDS,
    });
    const monitoring = await manager.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId, now: Date.now() },
    );

    expect(monitoring?.thresholds).toEqual(PAPER_STORE_THRESHOLDS);
    expect(monitoring?.condition).toBe("no_devices");
  });

  test("impossible thresholds are refused and leave the saved ones", async () => {
    const t = createConvexTestWithRateLimiter();
    const { locationId, manager } = await paperStore(t);
    await manager.mutation(api.environmentalMonitoring.setThresholds, {
      locationId,
      thresholds: PAPER_STORE_THRESHOLDS,
    });

    const refusals = await Promise.all(
      [
        { temperatureMin: 22, temperatureMax: 18 },
        { humidityMin: 40, humidityMax: 40 },
        { humidityMax: 120 },
        { temperatureMin: -150 },
        { temperatureMax: Number.NaN },
      ].map((thresholds) =>
        alertEpisodeErrorOf(
          manager.mutation(api.environmentalMonitoring.setThresholds, {
            locationId,
            thresholds,
          }),
        ),
      ),
    );
    const monitoring = await manager.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId, now: Date.now() },
    );

    expect(refusals).toEqual(Array(5).fill("THRESHOLDS_INVALID"));
    expect(monitoring?.thresholds).toEqual(PAPER_STORE_THRESHOLDS);
  });

  test("staff who cannot administer locations cannot change thresholds", async () => {
    const t = createConvexTestWithRateLimiter();
    const { organizationId, locationId, manager } = await paperStore(t);
    const curatorId = await addMember(t, organizationId, "curator", [
      "locations.read",
      "locations.update",
    ]);
    const outsider = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
      "locations.update",
    ]);

    for (const caller of [
      authedForUser(t, curatorId),
      authedForUser(t, outsider.userId),
      t,
    ]) {
      await expect(
        caller.mutation(api.environmentalMonitoring.setThresholds, {
          locationId,
          thresholds: { humidityMax: 70 },
        }),
      ).rejects.toThrow();
    }
    const monitoring = await manager.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId, now: Date.now() },
    );
    expect(monitoring?.thresholds).toBeNull();
  });
});

describe("alert episodes", () => {
  test("a reading outside the thresholds opens one episode and notifies location managers", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const observedAt = Date.now() - 10 * MINUTE;

    const response = await store.send({
      readingId: "r1",
      observedAt,
      humidity: 61,
    });
    const monitoring = await store.monitoring();
    const notifications = await store.notifications();

    expect(response.status).toBe(202);
    expect(monitoring?.condition).toBe("out_of_range");
    expect(monitoring?.openEpisode).toMatchObject({
      status: "open",
      startedAt: observedAt,
      escalationLevel: 0,
      readingCount: 1,
      outOfRangeCount: 1,
      breaches: [{ measure: "humidity", direction: "above" }],
    });
    expect(notifications).toEqual([
      expect.objectContaining({
        type: "environmental_alert",
        category: "alerts",
        title: "Environment out of range: Paper Store",
        message: "Relative humidity 61% above the 55% maximum.",
        relatedEntityType: "alertEpisode",
        relatedEntityId: monitoring?.openEpisode?._id,
      }),
    ]);
  });
  test("further readings update the open episode without notifying again", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 30 * MINUTE;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({
      readingId: "r2",
      observedAt: start + 5 * MINUTE,
      humidity: 63,
      temperature: 23,
    });
    await store.send({
      readingId: "r3",
      observedAt: start + 10 * MINUTE,
      humidity: 59,
    });
    const monitoring = await store.monitoring();

    expect(monitoring?.openEpisode).toMatchObject({
      startedAt: start,
      lastObservedAt: start + 10 * MINUTE,
      readingCount: 3,
      outOfRangeCount: 3,
      breaches: [
        { measure: "temperature", direction: "above" },
        { measure: "humidity", direction: "above" },
      ],
      ranges: {
        temperature: { min: 20, max: 23 },
        humidity: { min: 59, max: 63 },
      },
    });
    expect(await store.notifications()).toHaveLength(1);
  });

  test("a retried reading is acknowledged without counting it twice", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const reading = {
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    };

    const first = await store.send(reading);
    const retry = await store.send(reading);
    const monitoring = await store.monitoring();

    expect([first.status, retry.status]).toEqual([202, 200]);
    expect(monitoring?.openEpisode).toMatchObject({
      readingCount: 1,
      outOfRangeCount: 1,
    });
    expect(await store.notifications()).toHaveLength(1);
  });
  test("a breach still reported an hour after it began escalates, and again after a day", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 30 * HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({
      readingId: "r2",
      observedAt: start + 59 * MINUTE,
      humidity: 62,
    });
    const beforeAnHour = await store.monitoring();
    await store.send({
      readingId: "r3",
      observedAt: start + 61 * MINUTE,
      humidity: 62,
    });
    await store.send({
      readingId: "r4",
      observedAt: start + 2 * HOUR,
      humidity: 63,
    });
    await store.send({
      readingId: "r5",
      observedAt: start + 25 * HOUR,
      humidity: 64,
    });
    const monitoring = await store.monitoring();
    const notifications = await store.notifications();

    expect(beforeAnHour?.openEpisode?.escalationLevel).toBe(0);
    expect(monitoring?.openEpisode).toMatchObject({
      escalationLevel: 2,
      escalatedAt: start + 25 * HOUR,
    });
    expect(notifications).toHaveLength(3);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Environment still out of range: Paper Store",
          message:
            "Out of range for over 1 hour. Relative humidity 62% above the 55% maximum.",
        }),
        expect.objectContaining({
          title: "Environment still out of range: Paper Store",
          message:
            "Out of range for over 24 hours. Relative humidity 64% above the 55% maximum.",
        }),
      ]),
    );
  });

  test("a breach reported again after a long gap escalates straight to the level it reached", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 30 * HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({
      readingId: "r2",
      observedAt: start + 26 * HOUR,
      humidity: 61,
    });
    const monitoring = await store.monitoring();
    const notifications = await store.notifications();

    expect(monitoring?.openEpisode?.escalationLevel).toBe(2);
    expect(notifications.map((notification) => notification.message)).toEqual(
      expect.arrayContaining([
        "Out of range for over 24 hours. Relative humidity 61% above the 55% maximum.",
      ]),
    );
    expect(notifications).toHaveLength(2);
  });
  test("a late reading outside the thresholds is kept but opens no episode", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const latest = Date.now() - 10 * MINUTE;

    const current = await store.send({ readingId: "r2", observedAt: latest });
    const late = await store.send({
      readingId: "r1",
      observedAt: latest - 5 * MINUTE,
      humidity: 70,
    });
    const monitoring = await store.monitoring();

    expect(await current.json()).toEqual({
      accepted: true,
      duplicate: false,
      late: false,
    });
    expect(await late.json()).toEqual({
      accepted: true,
      duplicate: false,
      late: true,
    });
    expect(monitoring?.openEpisode).toBeNull();
    expect(monitoring?.recentReadings).toEqual([
      expect.objectContaining({ humidity: 50, late: false, outOfRange: false }),
      expect.objectContaining({ humidity: 70, late: true, outOfRange: true }),
    ]);
    expect(await store.notifications()).toHaveLength(0);
  });

  test("readings delivered newest first leave the newest as the current state", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - HOUR;

    await store.send({ readingId: "r3", observedAt: start + 20 * MINUTE });
    const delayed = await Promise.all(
      [
        { readingId: "r1", observedAt: start, humidity: 61 },
        { readingId: "r2", observedAt: start + 10 * MINUTE, humidity: 62 },
      ].map(async (reading) => (await store.send(reading)).json()),
    );

    expect(delayed).toEqual([
      { accepted: true, duplicate: false, late: true },
      { accepted: true, duplicate: false, late: true },
    ]);
    expect((await store.monitoring())?.openEpisode).toBeNull();
  });

  test("a late reading observed during an open episode counts as its evidence only", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({
      readingId: "r3",
      observedAt: start + 20 * MINUTE,
      humidity: 62,
    });
    await store.send({
      readingId: "r2",
      observedAt: start + 10 * MINUTE,
      humidity: 64,
    });
    await store.send({
      readingId: "r0",
      observedAt: start - 10 * MINUTE,
      humidity: 66,
    });
    const monitoring = await store.monitoring();

    expect(monitoring?.openEpisode).toMatchObject({
      startedAt: start,
      lastObservedAt: start + 20 * MINUTE,
      readingCount: 3,
      outOfRangeCount: 3,
      lateReadingCount: 1,
      ranges: { humidity: { min: 61, max: 64 } },
    });
  });
});
