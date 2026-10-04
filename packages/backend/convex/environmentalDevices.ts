import { getAuthUserId } from "@convex-dev/auth/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

const limiter = new RateLimiter(components.rateLimiter, {
  environmentalReadings: { kind: "token bucket", rate: 120, period: MINUTE },
});

function createCredential(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  const bytes = new Uint8Array(64);
  while (secret.length < 43) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= 248) continue;
      secret += alphabet[byte % alphabet.length];
      if (secret.length === 43) break;
    }
  }
  return `env_${secret}`;
}

async function hashCredential(credential: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(credential),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function equalHash(storedHash: string, candidateHash: string): boolean {
  if (storedHash.length !== candidateHash.length) return false;
  let difference = 0;
  for (let index = 0; index < storedHash.length; index++) {
    difference |=
      storedHash.charCodeAt(index) ^ candidateHash.charCodeAt(index);
  }
  return difference === 0;
}

async function requireDeviceManagement(
  ctx: Parameters<typeof requirePermission>[0],
  organizationId: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  await requirePermission(ctx, organizationId, "organization.manage_settings");
  return userId;
}

export const register = mutation({
  args: { organizationId: v.id("organizations"), name: v.string() },
  returns: v.object({
    deviceId: v.id("environmentalDevices"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireDeviceManagement(ctx, args.organizationId);
    const name = args.name.trim();
    if (!name || name.length > 100) throw new Error("Device name is invalid");
    const token = createCredential();
    const deviceId = await ctx.db.insert("environmentalDevices", {
      organizationId: args.organizationId,
      name,
      credentialPrefix: token.slice(0, 12),
      credentialHash: await hashCredential(token),
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "registered_environmental_device",
      entityType: "environmentalDevice",
      entityId: deviceId,
      changes: { name },
    });
    return { deviceId, token };
  },
});

export const bindProbe = mutation({
  args: {
    organizationId: v.id("organizations"),
    deviceId: v.id("environmentalDevices"),
    probeId: v.string(),
    locationId: v.id("locations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireDeviceManagement(ctx, args.organizationId);
    const [device, location] = await Promise.all([
      ctx.db.get(args.deviceId),
      ctx.db.get(args.locationId),
    ]);
    const probeId = args.probeId.trim();
    if (
      !device ||
      device.organizationId !== args.organizationId ||
      !location ||
      location.organizationId !== args.organizationId ||
      !probeId ||
      probeId.length > 100
    ) {
      throw new Error("Device, probe, or location is invalid");
    }
    const existing = await ctx.db
      .query("environmentalProbes")
      .withIndex("by_device_and_probe", (q) =>
        q.eq("deviceId", args.deviceId).eq("probeId", probeId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        organizationId: args.organizationId,
        locationId: args.locationId,
        isActive: true,
        boundBy: userId,
        boundAt: Date.now(),
      });
    } else {
      await ctx.db.insert("environmentalProbes", {
        organizationId: args.organizationId,
        deviceId: args.deviceId,
        probeId,
        locationId: args.locationId,
        isActive: true,
        boundBy: userId,
        boundAt: Date.now(),
      });
    }
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "bound_environmental_probe",
      entityType: "environmentalDevice",
      entityId: args.deviceId,
      changes: { probeId, locationId: args.locationId },
    });
    return null;
  },
});

export const rotate = mutation({
  args: {
    organizationId: v.id("organizations"),
    deviceId: v.id("environmentalDevices"),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const userId = await requireDeviceManagement(ctx, args.organizationId);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.organizationId !== args.organizationId) {
      throw new Error("Device not found");
    }
    const token = createCredential();
    await ctx.db.patch(args.deviceId, {
      credentialPrefix: token.slice(0, 12),
      credentialHash: await hashCredential(token),
      status: "active",
      rotatedAt: Date.now(),
      revokedAt: undefined,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "rotated_environmental_device_credential",
      entityType: "environmentalDevice",
      entityId: args.deviceId,
      changes: { name: device.name, credentialPrefix: token.slice(0, 12) },
    });
    return { token };
  },
});

export const revoke = mutation({
  args: {
    organizationId: v.id("organizations"),
    deviceId: v.id("environmentalDevices"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireDeviceManagement(ctx, args.organizationId);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.organizationId !== args.organizationId) {
      throw new Error("Device not found");
    }
    await ctx.db.patch(args.deviceId, {
      status: "revoked",
      revokedAt: Date.now(),
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "revoked_environmental_device",
      entityType: "environmentalDevice",
      entityId: args.deviceId,
      changes: { name: device.name, credentialPrefix: device.credentialPrefix },
    });
    return null;
  },
});

export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("environmentalDevices"),
      name: v.string(),
      credentialPrefix: v.string(),
      status: v.union(v.literal("active"), v.literal("revoked")),
      createdAt: v.number(),
      lastSeenAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      lastErrorAt: v.optional(v.number()),
      probes: v.array(
        v.object({
          _id: v.id("environmentalProbes"),
          probeId: v.string(),
          locationId: v.id("locations"),
          locationName: v.string(),
          isActive: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireDeviceManagement(ctx, args.organizationId);
    const devices = await ctx.db
      .query("environmentalDevices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(100);
    return await Promise.all(
      devices.map(async (device) => {
        const probes = await ctx.db
          .query("environmentalProbes")
          .withIndex("by_organization_and_device", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("deviceId", device._id),
          )
          .take(50);
        return {
          _id: device._id,
          name: device.name,
          credentialPrefix: device.credentialPrefix,
          status: device.status,
          createdAt: device.createdAt,
          lastSeenAt: device.lastSeenAt,
          lastError: device.lastError,
          lastErrorAt: device.lastErrorAt,
          probes: await Promise.all(
            probes.map(async (probe) => ({
              _id: probe._id,
              probeId: probe.probeId,
              locationId: probe.locationId,
              locationName:
                (await ctx.db.get(probe.locationId))?.name ??
                "Deleted location",
              isActive: probe.isActive,
            })),
          ),
        };
      }),
    );
  },
});

export const listLocations = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({ _id: v.id("locations"), name: v.string(), type: v.string() }),
  ),
  handler: async (ctx, args) => {
    await requireDeviceManagement(ctx, args.organizationId);
    return await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(500)
      .then((locations) =>
        locations.map(({ _id, name, type }) => ({ _id, name, type })),
      );
  },
});

export const ingest = internalMutation({
  args: {
    credential: v.string(),
    readingId: v.string(),
    probeId: v.string(),
    observedAt: v.number(),
    temperature: v.number(),
    humidity: v.number(),
  },
  returns: v.object({
    accepted: v.boolean(),
    duplicate: v.boolean(),
    conflict: v.boolean(),
    rateLimited: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (
      args.credential.length > 256 ||
      !args.readingId.trim() ||
      args.readingId.length > 128 ||
      !args.probeId.trim() ||
      args.probeId.length > 100 ||
      !Number.isFinite(args.observedAt) ||
      args.observedAt > now + 300_000 ||
      args.observedAt < now - 90 * 24 * 60 * 60 * 1000 ||
      !Number.isFinite(args.temperature) ||
      args.temperature < -100 ||
      args.temperature > 100 ||
      !Number.isFinite(args.humidity) ||
      args.humidity < 0 ||
      args.humidity > 100
    ) {
      return {
        accepted: false,
        duplicate: false,
        conflict: false,
        rateLimited: false,
      };
    }
    const prefix = args.credential.slice(0, 12);
    const candidateHash = await hashCredential(args.credential);
    const devices = await ctx.db
      .query("environmentalDevices")
      .withIndex("by_credential_prefix", (q) =>
        q.eq("credentialPrefix", prefix),
      )
      .take(10);
    let device: Doc<"environmentalDevices"> | undefined;
    for (const candidate of devices) {
      if (equalHash(candidate.credentialHash, candidateHash))
        device = candidate;
    }
    if (!device || device.status !== "active") {
      return {
        accepted: false,
        duplicate: false,
        conflict: false,
        rateLimited: false,
      };
    }
    const probe = await ctx.db
      .query("environmentalProbes")
      .withIndex("by_device_and_probe", (q) =>
        q.eq("deviceId", device._id).eq("probeId", args.probeId),
      )
      .unique();
    const location = probe?.isActive
      ? await ctx.db.get(probe.locationId)
      : null;
    if (
      !probe ||
      !location ||
      location.organizationId !== device.organizationId ||
      probe.organizationId !== device.organizationId
    ) {
      return {
        accepted: false,
        duplicate: false,
        conflict: false,
        rateLimited: false,
      };
    }
    const status = await limiter.limit(ctx, "environmentalReadings", {
      key: device._id,
    });
    if (!status.ok) {
      await ctx.db.patch(device._id, {
        lastError: "Reading rate limit exceeded",
        lastErrorAt: now,
      });
      return {
        accepted: false,
        duplicate: false,
        conflict: false,
        rateLimited: true,
      };
    }
    const existing = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_sensor_device_and_probe_and_external_reading", (q) =>
        q
          .eq("sensorDeviceId", device._id)
          .eq("sensorProbeId", probe.probeId)
          .eq("externalReadingId", args.readingId),
      )
      .unique();
    if (existing) {
      if (
        existing.recordedAt !== args.observedAt ||
        existing.temperature !== args.temperature ||
        existing.humidity !== args.humidity
      ) {
        return {
          accepted: false,
          duplicate: false,
          conflict: true,
          rateLimited: false,
        };
      }
      await ctx.db.patch(device._id, {
        lastSeenAt: now,
        lastError: undefined,
        lastErrorAt: undefined,
      });
      return {
        accepted: true,
        duplicate: true,
        conflict: false,
        rateLimited: false,
      };
    }
    const violations: string[] = [];
    const thresholds = location.environmentalThresholds;
    const latestObservation = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_location_and_time", (q) =>
        q.eq("locationId", location._id),
      )
      .order("desc")
      .first();
    const isCurrentObservation =
      !latestObservation || args.observedAt >= latestObservation.recordedAt;
    if (
      thresholds?.temperatureMin !== undefined &&
      args.temperature < thresholds.temperatureMin
    ) {
      violations.push(
        `Temperature ${args.temperature}°C below minimum ${thresholds.temperatureMin}°C`,
      );
    }
    if (
      thresholds?.temperatureMax !== undefined &&
      args.temperature > thresholds.temperatureMax
    ) {
      violations.push(
        `Temperature ${args.temperature}°C above maximum ${thresholds.temperatureMax}°C`,
      );
    }
    if (
      thresholds?.humidityMin !== undefined &&
      args.humidity < thresholds.humidityMin
    ) {
      violations.push(
        `Humidity ${args.humidity}% below minimum ${thresholds.humidityMin}%`,
      );
    }
    if (
      thresholds?.humidityMax !== undefined &&
      args.humidity > thresholds.humidityMax
    ) {
      violations.push(
        `Humidity ${args.humidity}% above maximum ${thresholds.humidityMax}%`,
      );
    }
    let alertId: Id<"conservationAlerts"> | undefined;
    if (violations.length > 0 && isCurrentObservation) {
      alertId = await ctx.db.insert("conservationAlerts", {
        organizationId: device.organizationId,
        alertType: "environmental_alert",
        title: `Environmental Alert: ${location.name}`,
        description: violations.join(". "),
        priority: violations.length >= 2 ? "high" : "medium",
        status: "active",
        createdAt: now,
      });
    }
    await ctx.db.insert("environmentalReadings", {
      organizationId: device.organizationId,
      locationId: location._id,
      temperature: args.temperature,
      humidity: args.humidity,
      recordedAt: args.observedAt,
      observedAt: args.observedAt,
      receivedAt: now,
      source: "sensor",
      sensorId: device.name,
      sensorDeviceId: device._id,
      sensorProbeId: probe.probeId,
      externalReadingId: args.readingId,
      alertTriggered: violations.length > 0,
      alertId,
    });
    await ctx.db.patch(device._id, {
      lastSeenAt: now,
      lastError: undefined,
      lastErrorAt: undefined,
    });
    return {
      accepted: true,
      duplicate: false,
      conflict: false,
      rateLimited: false,
    };
  },
});
