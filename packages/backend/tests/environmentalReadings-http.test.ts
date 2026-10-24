import { convexTest } from "convex-test";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

const rateLimiterModules = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      "../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.{ts,js}",
    ),
  ).filter(([path]) => !path.endsWith(".d.ts")),
);

async function createReceiver(t: ReturnType<typeof convexTest>) {
  const setup = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Receiver Test Museum",
      slug: `receiver-test-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "pro",
    });
    const userId = await ctx.db.insert("users", {
      name: "Receiver Admin",
      email: `receiver-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const permissionIds = await Promise.all(
      [
        "organization.manage_settings",
        "organization.view_analytics",
        "collections.read",
        "collections.update",
        "locations.read",
      ].map((name) =>
        ctx.db.insert("permissions", {
          name,
          category: name.split(".")[0] ?? "collections",
        }),
      ),
    );
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });
    await Promise.all(
      permissionIds.map((permissionId) =>
        ctx.db.insert("rolePermissions", { roleId, permissionId }),
      ),
    );
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Paper Store",
      type: "storage",
      sortOrder: 0,
      isActive: true,
      environmentalThresholds: {
        temperatureMin: 18,
        temperatureMax: 22,
        humidityMin: 40,
        humidityMax: 55,
      },
    });
    return { organizationId, userId, locationId };
  });
  const admin = t.withIdentity({
    subject: `${setup.userId}|session`,
    issuer: "https://example.test",
  });
  const device = await admin.mutation(api.environmentalDevices.register, {
    organizationId: setup.organizationId,
    name: "Storage logger",
  });
  await admin.mutation(api.environmentalDevices.bindProbe, {
    organizationId: setup.organizationId,
    deviceId: device.deviceId,
    probeId: "probe-1",
    locationId: setup.locationId,
  });
  return { ...setup, admin, ...device };
}

function createTestContext() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

describe("POST /v1/environmental-readings", () => {
  test("authenticates, normalizes units, deduplicates retries and keeps observation time", async () => {
    const t = createTestContext();
    const { organizationId, locationId, token, deviceId, admin } =
      await createReceiver(t);
    const observedAt = Date.now() - 5_000;
    const body = JSON.stringify({
      readingId: "probe-1/reading-42",
      probeId: "probe-1",
      timestamp: observedAt,
      temperature: { value: 68, unit: "F" },
      humidity: { value: 50, unit: "%" },
    });
    const request = () =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });

    const first = await request();
    const retry = await request();
    const conflict = await t.fetch("/v1/environmental-readings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        readingId: "probe-1/reading-42",
        probeId: "probe-1",
        timestamp: observedAt,
        temperature: { value: 21, unit: "C" },
        humidity: { value: 50, unit: "%" },
      }),
    });
    const readings = await admin.query(
      api.conservationTreatments.getEnvironmentalReadings,
      { locationId },
    );
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    const alerts = await admin.query(api.conservationTreatments.listAlerts, {
      organizationId,
    });

    expect(first.status).toBe(202);
    expect(retry.status).toBe(200);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      error: "reading_id_conflict",
    });
    expect(await retry.json()).toMatchObject({
      accepted: true,
      duplicate: true,
    });
    expect(readings).toHaveLength(1);
    expect(readings[0]?.temperature).toBeCloseTo(20);
    expect(readings[0]?.recordedAt).toBe(observedAt);
    expect(readings[0]?.observedAt).toBe(observedAt);
    expect(readings[0]?.receivedAt).toBeGreaterThan(observedAt);
    expect(readings[0]?.source).toBe("sensor");
    expect(readings[0]?.sensorDeviceId).toBe(deviceId);
    expect(readings[0]?.sensorProbeId).toBe("probe-1");
    expect(readings[0]?.externalReadingId).toBe("probe-1/reading-42");
    expect(devices[0]?.lastSeenAt).toBeGreaterThan(observedAt);
    expect(alerts).toHaveLength(0);
  });

  test("a retried breach opens one alert episode and a delayed breach does not join it", async () => {
    const t = createTestContext();
    const { organizationId, locationId, token, admin } =
      await createReceiver(t);
    const send = (readingId: string, timestamp: number, temperature: number) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readingId,
          probeId: "probe-1",
          timestamp,
          temperature: { value: temperature, unit: "C" },
          humidity: { value: 50, unit: "%" },
        }),
      });
    const latestObservedAt = Date.now() - 10_000;
    const lateObservedAt = latestObservedAt - 60_000;

    await send("latest-reading", latestObservedAt, 30);
    await send("latest-reading", latestObservedAt, 30);
    await send("late-reading", lateObservedAt, 35);
    const readings = await admin.query(
      api.conservationTreatments.getEnvironmentalReadings,
      { locationId },
    );
    const summary = await admin.query(
      api.conservationTreatments.getEnvironmentalSummary,
      { locationId },
    );
    const monitoring = await admin.query(
      api.environmentalMonitoring.getLocationMonitoring,
      { locationId, now: Date.now() },
    );
    const alerts = await admin.query(api.conservationTreatments.listAlerts, {
      organizationId,
    });

    expect(readings).toHaveLength(2);
    expect(summary.temperature.current).toBe(30);
    expect(summary.humidity.current).toBe(50);
    expect(monitoring?.openEpisode).toMatchObject({
      startedAt: latestObservedAt,
      readingCount: 1,
      lateReadingCount: 0,
    });
    expect(alerts).toHaveLength(0);
    expect(readings[1]?.alertTriggered).toBe(true);
  });

  test("limits each device to 120 new readings per minute", async () => {
    // The bucket refills 2 tokens a second; a frozen clock keeps a slow run
    // from earning a 121st reading.
    vi.useFakeTimers({ toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const t = createTestContext();
    const { token, organizationId, admin } = await createReceiver(t);
    const submit = (index: number) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readingId: `rate-test-${index}`,
          probeId: "probe-1",
          timestamp: Date.now(),
          temperature: { value: 20, unit: "C" },
          humidity: { value: 50, unit: "%" },
        }),
      });
    let lastResponse: Response | undefined;
    for (let index = 0; index < 121; index++) {
      lastResponse = await submit(index);
    }

    expect(lastResponse?.status).toBe(429);
    expect(await lastResponse?.json()).toMatchObject({
      error: "rate_limit_exceeded",
    });
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.lastError).toBe("Reading rate limit exceeded");
    expect(devices[0]?.lastErrorAt).toBeDefined();
  });

  test("charges malformed requests and protects health writes with device quota", async () => {
    const t = createTestContext();
    const { organizationId, locationId, token, admin } =
      await createReceiver(t);
    const send = (body: unknown) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

    for (let index = 0; index < 120; index++) {
      expect((await send({ malformed: index })).status).toBe(400);
    }
    const valid = await send({
      readingId: "valid-after-malformed-burst",
      probeId: "probe-1",
      timestamp: Date.now(),
      temperature: { value: 20, unit: "C" },
      humidity: { value: 50, unit: "%" },
    });

    expect(valid.status).toBe(429);
    expect(await valid.json()).toMatchObject({ error: "rate_limit_exceeded" });
    expect(
      await admin.query(api.conservationTreatments.getEnvironmentalReadings, {
        locationId,
      }),
    ).toHaveLength(0);
    expect(
      await admin.query(api.conservationTreatments.listAlerts, {
        organizationId,
        status: "active",
      }),
    ).toHaveLength(0);
    expect(
      (await admin.query(api.environmentalDevices.list, { organizationId }))[0]
        ?.lastError,
    ).toBe("Reading rate limit exceeded");
  });

  test("charges known devices for unknown-probe attempts", async () => {
    // Same frozen clock as above, so a slow run can't refill the bucket.
    vi.useFakeTimers({ toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const t = createTestContext();
    const { token } = await createReceiver(t);
    const submit = (probeId: string, readingId: string) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readingId,
          probeId,
          timestamp: Date.now(),
          temperature: { value: 20, unit: "C" },
          humidity: { value: 50, unit: "%" },
        }),
      });
    for (let index = 0; index < 120; index++) {
      expect((await submit("unknown-probe", `bad-probe-${index}`)).status).toBe(
        401,
      );
    }

    expect((await submit("probe-1", "valid-after-invalid-probes")).status).toBe(
      429,
    );
  });

  test("records safe health errors for verified device failures only", async () => {
    const t = createTestContext();
    const { organizationId, token, admin } = await createReceiver(t);
    const send = (credential: string, body: unknown) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const valid = {
      readingId: "health-check",
      probeId: "probe-1",
      timestamp: Date.now(),
      temperature: { value: 20, unit: "C" },
      humidity: { value: 50, unit: "%" },
    };
    await send(token, valid);
    expect(
      (await send(token, { ...valid, probeId: "unknown-probe" })).status,
    ).toBe(401);
    let devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.lastError).toBe("Unknown probe");
    expect(JSON.stringify(devices)).not.toContain(token);

    expect(
      (
        await send(token, {
          ...valid,
          temperature: { value: 25, unit: "C" },
        })
      ).status,
    ).toBe(409);
    devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.lastError).toBe("Reading ID conflict");

    await send(token, { ...valid, temperature: { value: "hot", unit: "C" } });
    devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(devices[0]?.lastError).toBe("Invalid measurement");

    await send("env_unknown-credential", {});
    const afterBadCredential = await admin.query(
      api.environmentalDevices.list,
      { organizationId },
    );
    expect(afterBadCredential[0]?.lastError).toBe("Invalid measurement");
    expect(afterBadCredential[0]?.lastError).not.toContain("env_");
  });

  test("rejects impossible ISO calendar dates without normalizing them", async () => {
    const t = createTestContext();
    const { token, organizationId, locationId, admin } =
      await createReceiver(t);
    const response = await t.fetch("/v1/environmental-readings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        readingId: "nonexistent-date",
        probeId: "probe-1",
        timestamp: "2026-09-31T12:00:00Z",
        temperature: { value: 20, unit: "C" },
        humidity: { value: 50, unit: "%" },
      }),
    });
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_payload");
    expect(devices[0]?.lastError).toBe("Invalid payload");
    expect(
      await admin.query(api.conservationTreatments.getEnvironmentalReadings, {
        locationId,
      }),
    ).toHaveLength(0);
  });

  test("rejects bound probes whose location later becomes inactive", async () => {
    const t = createTestContext();
    const { organizationId, locationId, token, admin } =
      await createReceiver(t);
    await t.run((ctx) => ctx.db.patch(locationId, { isActive: false }));
    const response = await t.fetch("/v1/environmental-readings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        readingId: "inactive-location",
        probeId: "probe-1",
        timestamp: Date.now(),
        temperature: { value: 30, unit: "C" },
        humidity: { value: 50, unit: "%" },
      }),
    });
    expect(response.status).toBe(401);
    expect(
      await admin.query(api.conservationTreatments.getEnvironmentalReadings, {
        locationId,
      }),
    ).toHaveLength(0);
    expect(
      await admin.query(api.conservationTreatments.listAlerts, {
        organizationId,
      }),
    ).toHaveLength(0);
    expect(
      (await admin.query(api.environmentalDevices.list, { organizationId }))[0]
        ?.lastError,
    ).toBe("Inactive location");
  });

  test("rotation invalidates the old credential and revocation invalidates the replacement", async () => {
    const t = createTestContext();
    const {
      token: oldToken,
      organizationId,
      locationId,
      deviceId,
      admin,
    } = await createReceiver(t);
    const rotated = await admin.mutation(api.environmentalDevices.rotate, {
      organizationId,
      deviceId,
    });
    const send = (credential: string, readingId: string) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readingId,
          probeId: "probe-1",
          timestamp: Date.now(),
          temperature: { value: 20, unit: "C" },
          humidity: { value: 50, unit: "%" },
        }),
      });

    const oldCredentialResponse = await send(oldToken, "old-key-reading");
    const replacementResponse = await send(
      rotated.token,
      "replacement-reading",
    );
    await admin.mutation(api.environmentalDevices.revoke, {
      organizationId,
      deviceId,
    });
    const revokedResponse = await send(rotated.token, "revoked-key-reading");
    const recovered = await admin.mutation(api.environmentalDevices.rotate, {
      organizationId,
      deviceId,
    });
    const recoveredResponse = await send(
      recovered.token,
      "recovered-device-reading",
    );
    const readings = await admin.query(
      api.conservationTreatments.getEnvironmentalReadings,
      { locationId },
    );

    expect(oldCredentialResponse.status).toBe(401);
    expect(replacementResponse.status).toBe(202);
    expect(revokedResponse.status).toBe(401);
    expect(recoveredResponse.status).toBe(202);
    expect(readings).toHaveLength(2);
  });

  test("rejects malformed, wrong-probe and revoked-device submissions without readings", async () => {
    const t = createTestContext();
    const { organizationId, locationId, token, deviceId, admin } =
      await createReceiver(t);
    const send = (credential: string, body: unknown) =>
      t.fetch("/v1/environmental-readings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const valid = {
      readingId: "bad-set/1",
      probeId: "foreign-probe",
      timestamp: Date.now(),
      temperature: { value: 20, unit: "C" },
      humidity: { value: 50, unit: "%" },
    };
    const malformed = await send(token, {
      ...valid,
      temperature: { value: "hot", unit: "C" },
    });
    const oversized = await send(token, "x".repeat(5_000));
    const nonFinite = await send(token, {
      ...valid,
      readingId: "non-finite",
      probeId: "probe-1",
      temperature: { value: Number.POSITIVE_INFINITY, unit: "C" },
    });
    const outOfRange = await send(token, {
      ...valid,
      readingId: "out-of-range",
      probeId: "probe-1",
      temperature: { value: 300, unit: "F" },
    });
    const futureTimestamp = await send(token, {
      ...valid,
      readingId: "future-time",
      probeId: "probe-1",
      timestamp: Date.now() + 10 * 60_000,
    });
    const staleTimestamp = await send(token, {
      ...valid,
      readingId: "stale-time",
      probeId: "probe-1",
      timestamp: Date.now() - 100 * 24 * 60 * 60_000,
    });
    const wrongProbe = await send(token, valid);
    await admin.mutation(api.environmentalDevices.revoke, {
      organizationId,
      deviceId,
    });
    const revoked = await send(token, { ...valid, probeId: "probe-1" });
    const readings = await admin.query(
      api.conservationTreatments.getEnvironmentalReadings,
      { locationId },
    );
    const devices = await admin.query(api.environmentalDevices.list, {
      organizationId,
    });
    const alerts = await admin.query(api.conservationTreatments.listAlerts, {
      organizationId,
    });

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(nonFinite.status).toBe(400);
    expect(outOfRange.status).toBe(400);
    expect(futureTimestamp.status).toBe(400);
    expect(staleTimestamp.status).toBe(400);
    expect(wrongProbe.status).toBe(401);
    expect(revoked.status).toBe(401);
    expect(readings).toHaveLength(0);
    expect(alerts).toHaveLength(0);
    expect(devices[0]?.lastSeenAt).toBeDefined();
    expect(devices[0]?.probes).toHaveLength(1);
    expect(readings).toHaveLength(0);
  });

  test("reserves sensor provenance for device ingestion and audits manual capture", async () => {
    const t = createTestContext();
    const { organizationId, locationId, admin } = await createReceiver(t);

    await expect(
      t.mutation(api.conservationTreatments.recordEnvironmentalReading, {
        locationId,
        source: "sensor",
        temperature: 20,
        humidity: 50,
      }),
    ).rejects.toThrow();
    await expect(
      admin.mutation(api.conservationTreatments.recordEnvironmentalReading, {
        locationId,
        source: "sensor",
        temperature: 20,
        humidity: 50,
      }),
    ).rejects.toThrow();
    const noUnauthorizedReadings = await admin.query(
      api.conservationTreatments.getEnvironmentalReadings,
      { locationId },
    );
    expect(noUnauthorizedReadings).toHaveLength(0);

    const recorded = await admin.mutation(
      api.conservationTreatments.recordEnvironmentalReading,
      {
        locationId,
        source: "manual",
        temperature: 20,
        humidity: 50,
        notes: "Staff reading with calibrated thermometer",
      },
    );
    const audit = await admin.query(api.audit.listOrganizationActivity, {
      organizationId,
      entityType: "environmentalReading",
      limit: 10,
    });
    const manualReading = (
      await admin.query(api.conservationTreatments.getEnvironmentalReadings, {
        locationId,
      })
    ).find((reading) => reading._id === recorded.readingId);
    expect(audit.activities).toContainEqual(
      expect.objectContaining({
        action: "recorded_environmental_reading",
        entityId: recorded.readingId,
      }),
    );
    expect(manualReading?.source).toBe("manual");
    expect(manualReading?.recordedBy).toBeDefined();
    expect(manualReading?.sensorDeviceId).toBeUndefined();
  });
});
