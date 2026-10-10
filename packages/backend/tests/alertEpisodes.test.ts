import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { alertEpisodeErrorCodeFromError } from "../convex/utils/alertEpisodeErrors";
import {
  addMember,
  categoryChoices,
  emailChoices,
} from "./notificationFixtures";
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
    "organization.view_analytics",
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
  test("readings back within the thresholds for 30 minutes recover the episode once", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 2 * HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({ readingId: "r2", observedAt: start + 10 * MINUTE });
    await store.send({ readingId: "r3", observedAt: start + 25 * MINUTE });
    const recovering = await store.monitoring();
    await store.send({
      readingId: "r4",
      observedAt: start + 40 * MINUTE,
      humidity: 52,
    });
    await store.send({ readingId: "r5", observedAt: start + 50 * MINUTE });
    const monitoring = await store.monitoring();
    const notifications = await store.notifications();

    expect(recovering?.openEpisode?.status).toBe("open");
    expect(monitoring?.openEpisode).toBeNull();
    expect(monitoring?.recentEpisodes).toEqual([
      expect.objectContaining({
        status: "recovered",
        startedAt: start,
        endedAt: start + 40 * MINUTE,
        readingCount: 4,
        outOfRangeCount: 1,
      }),
    ]);
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Environment back in range: Paper Store",
          message:
            "Readings are back within the thresholds. Highest relative humidity 61%.",
          relatedEntityId: recovering?.openEpisode?._id,
        }),
      ]),
    );
  });

  test("a breach while recovering keeps the same episode open", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 2 * HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({ readingId: "r2", observedAt: start + 10 * MINUTE });
    await store.send({
      readingId: "r3",
      observedAt: start + 20 * MINUTE,
      humidity: 58,
    });
    await store.send({ readingId: "r4", observedAt: start + 30 * MINUTE });
    await store.send({ readingId: "r5", observedAt: start + 50 * MINUTE });
    const stillOpen = await store.monitoring();
    await store.send({ readingId: "r6", observedAt: start + 60 * MINUTE });
    const monitoring = await store.monitoring();

    expect(stillOpen?.openEpisode?.readingCount).toBe(5);
    expect(monitoring?.recentEpisodes).toEqual([
      expect.objectContaining({
        status: "recovered",
        endedAt: start + 60 * MINUTE,
      }),
    ]);
    expect(await store.notifications()).toHaveLength(2);
  });

  test("a late reading neither escalates nor interrupts recovery", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 4 * HOUR;

    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    await store.send({ readingId: "r3", observedAt: start + 2 * HOUR });
    await store.send({
      readingId: "r2",
      observedAt: start + 90 * MINUTE,
      humidity: 66,
    });
    const afterLateBreach = await store.monitoring();
    await store.send({
      readingId: "r4",
      observedAt: start + 2 * HOUR + 30 * MINUTE,
    });
    const monitoring = await store.monitoring();

    expect(afterLateBreach?.openEpisode).toMatchObject({
      escalationLevel: 0,
      lateReadingCount: 1,
    });
    expect(monitoring?.recentEpisodes).toEqual([
      expect.objectContaining({
        status: "recovered",
        endedAt: start + 2 * HOUR + 30 * MINUTE,
        escalationLevel: 0,
      }),
    ]);
  });

  test("every probe that went out of range must recover before the episode does", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.manager.mutation(api.environmentalDevices.bindProbe, {
      organizationId: store.organizationId,
      deviceId: store.deviceId,
      probeId: "probe-2",
      locationId: store.locationId,
    });
    const second = (reading: ReadingInput) =>
      sendReading(t, store.token, "probe-2", reading);
    const start = Date.now() - 3 * HOUR;

    await store.send({ readingId: "a1", observedAt: start, humidity: 61 });
    await second({
      readingId: "b1",
      observedAt: start + 5 * MINUTE,
      humidity: 62,
    });
    await store.send({ readingId: "a2", observedAt: start + 10 * MINUTE });
    await store.send({ readingId: "a3", observedAt: start + 45 * MINUTE });
    await second({ readingId: "b2", observedAt: start + 50 * MINUTE });
    const firstRecovered = await store.monitoring();
    await second({ readingId: "b3", observedAt: start + 80 * MINUTE });
    const monitoring = await store.monitoring();

    expect(firstRecovered?.openEpisode?.status).toBe("open");
    expect(monitoring?.recentEpisodes).toEqual([
      expect.objectContaining({
        status: "recovered",
        endedAt: start + 80 * MINUTE,
      }),
    ]);
  });

  test("readings from a probe that stayed in range cannot recover a silent one", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.manager.mutation(api.environmentalDevices.bindProbe, {
      organizationId: store.organizationId,
      deviceId: store.deviceId,
      probeId: "probe-2",
      locationId: store.locationId,
    });
    const start = Date.now() - 3 * HOUR;

    await store.send({ readingId: "a1", observedAt: start, humidity: 61 });
    for (const minutes of [5, 40, 80, 120]) {
      await sendReading(t, store.token, "probe-2", {
        readingId: `b${minutes}`,
        observedAt: start + minutes * MINUTE,
      });
    }
    const monitoring = await store.monitoring();

    expect(monitoring?.openEpisode).toMatchObject({
      status: "open",
      readingCount: 5,
    });
  });
});

describe("silent devices", () => {
  test("a probe with no reading for over two hours is silent, never in range", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const now = Date.now();

    await store.send({ readingId: "r1", observedAt: now - 30 * MINUTE });
    const reporting = await store.monitoring(now);
    const silent = await store.monitoring(now + 2 * HOUR);

    expect(reporting?.condition).toBe("in_range");
    expect(reporting?.probes).toEqual([
      expect.objectContaining({
        probeId: "probe-1",
        deviceName: "Store logger",
        status: "reporting",
        latest: expect.objectContaining({ observedAt: now - 30 * MINUTE }),
      }),
    ]);
    expect(silent?.condition).toBe("silent");
    expect(silent?.probes[0]?.status).toBe("silent");
  });

  test("a newly bound probe awaits its first reading, then turns silent", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const now = Date.now();

    const awaiting = await store.monitoring(now);
    const silent = await store.monitoring(now + 3 * HOUR);

    expect(awaiting?.condition).toBe("awaiting_readings");
    expect(awaiting?.probes[0]).toMatchObject({
      status: "awaiting_first_reading",
      latest: null,
    });
    expect(silent?.condition).toBe("silent");
  });

  test("an open episode whose probe stops reporting stays open and shows the silence", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const now = Date.now();

    await store.send({
      readingId: "r1",
      observedAt: now - 3 * HOUR,
      humidity: 61,
    });
    const monitoring = await store.monitoring(now);

    expect(monitoring?.condition).toBe("out_of_range");
    expect(monitoring?.openEpisode).toMatchObject({
      status: "open",
      escalationLevel: 0,
      sources: [
        expect.objectContaining({
          probeId: "probe-1",
          deviceName: "Store logger",
          lastObservedAt: now - 3 * HOUR,
          silent: true,
        }),
      ],
    });
    expect(monitoring?.probes[0]?.status).toBe("silent");
  });

  test("device management tells a device's last request apart from its probes' last readings", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const observedAt = Date.now() - 3 * HOUR;
    await store.send({ readingId: "r1", observedAt });

    const failed = await sendReading(t, store.token, "unbound-probe", {
      readingId: "r2",
      observedAt: Date.now(),
    });
    const [device] = await store.manager.query(api.environmentalDevices.list, {
      organizationId: store.organizationId,
    });

    expect(failed.status).toBe(401);
    expect(device).toMatchObject({
      lastError: "Unknown probe",
      probes: [
        expect.objectContaining({
          probeId: "probe-1",
          lastObservedAt: observedAt,
        }),
      ],
    });
    expect(device?.lastSeenAt).toBeGreaterThan(observedAt + 2 * HOUR);
    expect(device?.probes[0]?.lastReceivedAt).toBeGreaterThan(observedAt);
  });

  test("a revoked device no longer counts as monitoring the location", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.send({ readingId: "r1", observedAt: Date.now() - MINUTE });

    await store.manager.mutation(api.environmentalDevices.revoke, {
      organizationId: store.organizationId,
      deviceId: store.deviceId,
    });
    const monitoring = await store.monitoring();

    expect(monitoring?.condition).toBe("no_devices");
    expect(monitoring?.probes[0]?.status).toBe("revoked");
  });

  test("readings without thresholds are shown but not judged", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.manager.mutation(api.environmentalMonitoring.setThresholds, {
      locationId: store.locationId,
      thresholds: {},
    });

    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 90,
    });
    const monitoring = await store.monitoring();

    expect(monitoring?.condition).toBe("no_thresholds");
    expect(monitoring?.thresholds).toBeNull();
    expect(monitoring?.openEpisode).toBeNull();
  });
});

describe("episode notifications follow each recipient's choices", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_fixture_key");
    vi.stubEnv("RESEND_SENDER_EMAIL_AUTH", "notify@museum.example.test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("managers are told in the app, by email or in their digest as they chose, and not at all with alerts off", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const { organizationId } = store;
    const [conservatorId, registrarId, curatorId] = await Promise.all(
      ["conservator", "registrar", "curator"].map((username) =>
        addMember(t, organizationId, username, [
          "locations.read",
          "locations.update",
        ]),
      ),
    );
    const conservator = authedForUser(t, conservatorId!);
    const registrar = authedForUser(t, registrarId!);
    const curator = authedForUser(t, curatorId!);
    await conservator.mutation(api.notifications.updatePreferences, {
      organizationId,
      categories: emailChoices(["alerts"]),
    });
    await registrar.mutation(api.notifications.updatePreferences, {
      organizationId,
      categories: emailChoices(["alerts"]),
      emailSchedule: { cadence: "daily", time: "08:00", timezone: "UTC" },
    });
    await curator.mutation(api.notifications.updatePreferences, {
      organizationId,
      categories: categoryChoices({ alerts: { enabled: false, email: false } }),
    });
    const provider = vi.fn(async () =>
      Response.json({ id: "email-fixture" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", provider);
    vi.useFakeTimers();

    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    });
    await t.finishAllScheduledFunctions(() => {
      vi.advanceTimersByTime(0);
    });
    const centerOf = async (client: typeof conservator) =>
      (
        await client.query(api.notifications.getNotificationCenter, {
          organizationId,
        })
      ).notifications;

    expect(await centerOf(conservator)).toEqual([
      expect.objectContaining({
        title: "Environment out of range: Paper Store",
        email: expect.objectContaining({ status: "succeeded" }),
      }),
    ]);
    expect(await centerOf(registrar)).toEqual([
      expect.objectContaining({
        title: "Environment out of range: Paper Store",
        email: expect.objectContaining({
          status: "pending",
          digest: expect.objectContaining({ cadence: "daily" }),
        }),
      }),
    ]);
    expect(await centerOf(curator)).toEqual([]);
    expect(await centerOf(store.manager)).toEqual([
      expect.objectContaining({ email: null }),
    ]);
    expect(provider).toHaveBeenCalledTimes(1);
    const [, request] = provider.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const email = JSON.parse(String(request.body));
    expect(email).toMatchObject({
      to: ["conservator@example.test"],
      subject: "Environment out of range: Paper Store",
    });
    expect(email.text).toContain(
      "Relative humidity 61% above the 55% maximum.",
    );
    expect(email.text).toContain("/locations/episodes/");
  });
});

describe("who sees alert episodes", () => {
  test("members who cannot read locations are neither notified nor shown the episode", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const { organizationId, locationId } = store;
    const [movesOnlyId, viewerId] = await Promise.all([
      addMember(t, organizationId, "mover", ["locations.update"]),
      addMember(t, organizationId, "viewer", ["locations.read"]),
    ]);
    const outsider = await createOrgUserWithPermissions(t, [
      "locations.read",
      "locations.update",
    ]);

    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    });
    const centerOf = async (userId: typeof viewerId, orgId = organizationId) =>
      (
        await authedForUser(t, userId).query(
          api.notifications.getNotificationCenter,
          { organizationId: orgId },
        )
      ).notifications;
    const monitoringFor = (userId: typeof viewerId) =>
      authedForUser(t, userId).query(
        api.environmentalMonitoring.getLocationMonitoring,
        { locationId, now: Date.now() },
      );

    expect(await centerOf(movesOnlyId)).toEqual([]);
    await expect(monitoringFor(movesOnlyId)).rejects.toThrow();
    expect(await centerOf(viewerId)).toEqual([]);
    expect((await monitoringFor(viewerId))?.condition).toBe("out_of_range");
    expect(await monitoringFor(outsider.userId)).toBeNull();
    expect(await centerOf(outsider.userId, outsider.organizationId)).toEqual(
      [],
    );
    expect(
      await t.query(api.environmentalMonitoring.getLocationMonitoring, {
        locationId,
        now: Date.now(),
      }),
    ).toBeNull();
  });
});

describe("resolving an episode", () => {
  test("a location manager closes an open episode with a note and the next breach opens a new one", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - HOUR;
    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    const episodeId = (await store.monitoring())?.openEpisode?._id;
    if (!episodeId) throw new Error("Expected an open episode");

    await store.manager.mutation(api.environmentalMonitoring.resolveEpisode, {
      episodeId,
      note: "  Probe sat in a damp transit case; checked 48% by hand.  ",
    });
    const resolved = await store.monitoring();
    await store.send({
      readingId: "r2",
      observedAt: start + 30 * MINUTE,
      humidity: 62,
    });
    const reopened = await store.monitoring();
    const activity = await store.manager.query(
      api.audit.listOrganizationActivity,
      { organizationId: store.organizationId, entityType: "alertEpisode" },
    );

    expect(resolved?.openEpisode).toBeNull();
    expect(resolved?.recentEpisodes).toEqual([
      expect.objectContaining({
        _id: episodeId,
        status: "resolved",
        resolution: expect.objectContaining({
          note: "Probe sat in a damp transit case; checked 48% by hand.",
          resolvedByName: "Test User",
        }),
      }),
    ]);
    expect(reopened?.openEpisode?._id).not.toBe(episodeId);
    expect(reopened?.openEpisode?.startedAt).toBe(start + 30 * MINUTE);
    expect(await store.notifications()).toHaveLength(2);
    expect(activity.activities).toContainEqual(
      expect.objectContaining({
        action: "resolved_alert_episode",
        entityId: episodeId,
      }),
    );
  });

  test("resolving needs a note and an episode that is still open", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const start = Date.now() - 2 * HOUR;
    await store.send({ readingId: "r1", observedAt: start, humidity: 61 });
    const episodeId = (await store.monitoring())?.openEpisode?._id;
    if (!episodeId) throw new Error("Expected an open episode");
    const resolve = (note: string) =>
      alertEpisodeErrorOf(
        store.manager.mutation(api.environmentalMonitoring.resolveEpisode, {
          episodeId,
          note,
        }),
      );

    const withoutNote = await resolve("   ");
    const tooLong = await resolve("x".repeat(1001));
    await store.send({ readingId: "r2", observedAt: start + 5 * MINUTE });
    await store.send({ readingId: "r3", observedAt: start + 40 * MINUTE });
    const afterRecovery = await resolve("Checked by hand");

    expect([withoutNote, tooLong]).toEqual([
      "RESOLUTION_NOTE_INVALID",
      "RESOLUTION_NOTE_INVALID",
    ]);
    expect(afterRecovery).toBe("EPISODE_NOT_OPEN");
    expect((await store.monitoring())?.recentEpisodes[0]?.status).toBe(
      "recovered",
    );
  });

  test("staff who do not manage locations cannot resolve an episode", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    });
    const episodeId = (await store.monitoring())?.openEpisode?._id;
    if (!episodeId) throw new Error("Expected an open episode");
    const viewerId = await addMember(t, store.organizationId, "viewer", [
      "locations.read",
    ]);
    const outsider = await createOrgUserWithPermissions(t, [
      "locations.read",
      "locations.update",
    ]);

    for (const caller of [
      authedForUser(t, viewerId),
      authedForUser(t, outsider.userId),
      t,
    ]) {
      await expect(
        caller.mutation(api.environmentalMonitoring.resolveEpisode, {
          episodeId,
          note: "Not mine to close",
        }),
      ).rejects.toThrow();
    }
    expect((await store.monitoring())?.openEpisode?.status).toBe("open");
  });
});

describe("staff readings", () => {
  test("a staff reading outside the thresholds opens an episode and an in-range spot check ends it", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await paperStore(t);
    await store.manager.mutation(api.environmentalMonitoring.setThresholds, {
      locationId: store.locationId,
      thresholds: PAPER_STORE_THRESHOLDS,
    });
    const conservatorId = await addMember(
      t,
      store.organizationId,
      "conservator",
      ["collections.update", "locations.read"],
    );
    const conservator = authedForUser(t, conservatorId);
    const record = (humidity: number) =>
      conservator.mutation(
        api.conservationTreatments.recordEnvironmentalReading,
        { locationId: store.locationId, source: "manual", humidity },
      );

    const breach = await record(61);
    const opened = await store.manager.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId: store.locationId, now: Date.now() },
    );
    const check = await record(48);
    const recovered = await store.manager.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId: store.locationId, now: Date.now() },
    );
    const alerts = await t.run((ctx) =>
      ctx.db.query("conservationAlerts").collect(),
    );

    expect(breach).toMatchObject({
      alertTriggered: true,
      episodeId: opened?.openEpisode?._id,
      violations: ["Relative humidity 61% above the 55% maximum"],
    });
    expect(opened?.openEpisode?.sources).toEqual([
      expect.objectContaining({ silent: false }),
    ]);
    expect(opened?.openEpisode?.sources[0]?.probeId).toBeUndefined();
    expect(check.episodeId).toBe(breach.episodeId);
    expect(recovered?.openEpisode).toBeNull();
    expect(recovered?.recentEpisodes[0]?.status).toBe("recovered");
    expect(recovered?.recentReadings[0]).toMatchObject({
      source: "manual",
      recordedByName: "conservator",
      humidity: 48,
    });
    expect(alerts).toEqual([]);
  });

  test("a staff spot check within the thresholds cannot recover a probe's breach", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    const conservatorId = await addMember(
      t,
      store.organizationId,
      "conservator",
      ["collections.update", "locations.read"],
    );
    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    });

    await authedForUser(t, conservatorId).mutation(
      api.conservationTreatments.recordEnvironmentalReading,
      { locationId: store.locationId, source: "manual", humidity: 48 },
    );
    const monitoring = await store.monitoring();

    expect(monitoring?.openEpisode).toMatchObject({
      status: "open",
      readingCount: 2,
    });
  });
});

describe("episode evidence", () => {
  test("an episode lists every reading it counted, newest observation first, late ones marked", async () => {
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
    await store.send({ readingId: "r4", observedAt: start + 30 * MINUTE });
    await store.send({
      readingId: "r0",
      observedAt: start - 10 * MINUTE,
      humidity: 70,
    });
    const episodeId = (await store.monitoring())?.openEpisode?._id;
    if (!episodeId) throw new Error("Expected an open episode");

    const detail = await store.manager.query(
      api.environmentalMonitoring.getEpisode,
      { episodeId, now: Date.now() },
    );
    const firstPage = await store.manager.query(
      api.environmentalMonitoring.listEpisodeReadings,
      { episodeId, paginationOpts: { numItems: 2, cursor: null } },
    );
    const secondPage = await store.manager.query(
      api.environmentalMonitoring.listEpisodeReadings,
      {
        episodeId,
        paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
      },
    );

    expect(detail).toMatchObject({
      location: { _id: store.locationId, name: "Paper Store" },
      episode: { _id: episodeId, status: "open", readingCount: 4 },
    });
    expect(
      [...firstPage.page, ...secondPage.page].map((reading) => [
        reading.observedAt - start,
        reading.late,
        reading.outOfRange,
      ]),
    ).toEqual([
      [30 * MINUTE, false, false],
      [20 * MINUTE, false, true],
      [10 * MINUTE, true, true],
      [0, false, true],
    ]);
  });

  test("an episode is shown only to members who may read locations", async () => {
    const t = createConvexTestWithRateLimiter();
    const store = await monitoredPaperStore(t);
    await store.send({
      readingId: "r1",
      observedAt: Date.now() - MINUTE,
      humidity: 61,
    });
    const episodeId = (await store.monitoring())?.openEpisode?._id;
    if (!episodeId) throw new Error("Expected an open episode");
    const [viewerId, moverId] = await Promise.all([
      addMember(t, store.organizationId, "viewer", ["locations.read"]),
      addMember(t, store.organizationId, "mover", ["locations.update"]),
    ]);
    const outsider = await createOrgUserWithPermissions(t, ["locations.read"]);
    const detailFor = (client: ReturnType<typeof authedForUser> | ConvexTest) =>
      client.query(api.environmentalMonitoring.getEpisode, {
        episodeId,
        now: Date.now(),
      });
    const readingsFor = (
      client: ReturnType<typeof authedForUser> | ConvexTest,
    ) =>
      client.query(api.environmentalMonitoring.listEpisodeReadings, {
        episodeId,
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect((await detailFor(authedForUser(t, viewerId)))?.episode._id).toBe(
      episodeId,
    );
    expect((await readingsFor(authedForUser(t, viewerId))).page).toHaveLength(
      1,
    );
    await expect(detailFor(authedForUser(t, moverId))).rejects.toThrow();
    await expect(readingsFor(authedForUser(t, moverId))).rejects.toThrow();
    expect(await detailFor(authedForUser(t, outsider.userId))).toBeNull();
    expect((await readingsFor(authedForUser(t, outsider.userId))).page).toEqual(
      [],
    );
    expect(await detailFor(t)).toBeNull();
    expect(
      await store.manager.query(api.environmentalMonitoring.getEpisode, {
        episodeId: "not-an-episode",
        now: Date.now(),
      }),
    ).toBeNull();
  });
});
