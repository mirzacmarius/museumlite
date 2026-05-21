import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestSetup(
  t: ReturnType<typeof convexTest>,
): Promise<TestSetup> {
  const [organizationId, userId, manageSettingsPermissionId] =
    await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: "organization.manage_settings",
          category: "organization",
        });
      }),
    ]);
  const roleId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: manageSettingsPermissionId,
    });

    return roleId;
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

describe("API Key Generation Security", () => {
  test("should generate keys with correct format (ml_ prefix + 37 chars)", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-format`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.apiKeys.create, {
      organizationId,
      name: "Test Key",
      permissions: ["read"],
    });

    expect(result.key).toBeDefined();
    expect(result.key).toMatch(/^ml_[A-Za-z0-9]{37}$/);
    expect(result.key.length).toBe(40); // 'ml_' (3) + 37 chars
    expect(result.key.startsWith("ml_")).toBe(true);
  });

  test("should generate keys using only allowed characters (A-Za-z0-9)", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-charset`,
      issuer: "https://example.test",
    });

    // Generate multiple keys to test character set compliance
    await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const result = await authed.mutation(api.apiKeys.create, {
          organizationId,
          name: `Test Key ${i}`,
          permissions: ["read"],
        });

        const keyBody = result.key.substring(3);
        expect(keyBody).toMatch(/^[A-Za-z0-9]+$/);

        for (const char of keyBody) {
          expect(/[A-Za-z0-9]/.test(char)).toBe(true);
        }
      }),
    );
  });

  test("should generate unique keys (no collisions in 1000+ generations)", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-uniqueness`,
      issuer: "https://example.test",
    });

    const generatedKeys = new Set<string>();
    const iterations = 1000;

    await Promise.all(
      Array.from({ length: iterations }, async (_, i) => {
        const result = await authed.mutation(api.apiKeys.create, {
          organizationId,
          name: `Test Key ${i}`,
          permissions: ["read"],
        });

        expect(generatedKeys.has(result.key)).toBe(false);
        generatedKeys.add(result.key);
      }),
    );

    expect(generatedKeys.size).toBe(iterations);
  });

  test("should generate keys with sufficient entropy (no predictable patterns)", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-entropy`,
      issuer: "https://example.test",
    });

    const keys: string[] = [];
    const charFrequency = new Map<string, number>();

    // Generate 100 keys to analyze
    const keyBodies = await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        const result = await authed.mutation(api.apiKeys.create, {
          organizationId,
          name: `Test Key ${i}`,
          permissions: ["read"],
        });

        return result.key.substring(3);
      }),
    );

    for (const keyBody of keyBodies) {
      keys.push(keyBody);
      for (const char of keyBody) {
        charFrequency.set(char, (charFrequency.get(char) || 0) + 1);
      }
    }

    // Test 1: No two consecutive keys should be identical
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).not.toBe(keys[i - 1]);
    }

    // Test 2: No key should be a simple pattern (all same character)
    for (const key of keys) {
      const firstChar = key[0];
      const allSame = key.split("").every((char) => char === firstChar);
      expect(allSame).toBe(false);
    }

    // Test 3: Character distribution should be reasonably uniform
    // With 62 possible chars and 3700 total chars (100 keys * 37 chars),
    // we expect roughly 59-60 occurrences per character on average
    // We'll check that no character appears less than 20 times or more than 100 times
    // to ensure reasonable distribution (allowing for random variance)
    const totalChars = keys.length * 37;
    const expectedPerChar = totalChars / 62; // ~59.7

    let tooRare = 0;
    let tooCommon = 0;

    for (const [char, count] of charFrequency.entries()) {
      if (count < expectedPerChar * 0.3) tooRare++; // Less than 30% of expected
      if (count > expectedPerChar * 1.7) tooCommon++; // More than 170% of expected
    }

    // Allow some variance but not too much
    expect(tooRare).toBeLessThan(10); // At most 10 chars can be very rare
    expect(tooCommon).toBeLessThan(10); // At most 10 chars can be very common

    // Test 4: Hamming distance between consecutive keys should be high
    // (most characters should differ between consecutive keys)
    for (let i = 1; i < Math.min(keys.length, 20); i++) {
      let differences = 0;
      for (let j = 0; j < 37; j++) {
        if (keys[i][j] !== keys[i - 1][j]) {
          differences++;
        }
      }
      // Expect at least 30 out of 37 positions to differ (81% difference)
      expect(differences).toBeGreaterThan(30);
    }
  });

  test("should create API key end-to-end with proper database storage", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-e2e`,
      issuer: "https://example.test",
    });

    const result = await authed.mutation(api.apiKeys.create, {
      organizationId,
      name: "Production API Key",
      permissions: ["read", "write"],
      expiresAt: Date.now() + 86400000, // 24 hours
    });

    expect(result.id).toBeDefined();
    expect(result.key).toBeDefined();
    expect(result.key).toMatch(/^ml_[A-Za-z0-9]{37}$/);

    // Verify the key was stored correctly
    const keys = await authed.query(api.apiKeys.list, { organizationId });
    const createdKey = keys.find((k) => k._id === result.id);

    expect(createdKey).toBeDefined();
    expect(createdKey?.name).toBe("Production API Key");
    expect(createdKey?.permissions).toEqual(["read", "write"]);
    expect(createdKey?.prefix).toBe(result.key.substring(0, 10));
    expect(createdKey?.isRevoked).toBe(false);
  });

  test("should validate generated keys successfully", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-validate`,
      issuer: "https://example.test",
    });

    // Create a key
    const result = await authed.mutation(api.apiKeys.create, {
      organizationId,
      name: "Validation Test Key",
      permissions: ["read", "write"],
    });

    // Validate the key
    const validation = await authed.mutation(api.apiKeys.validate, {
      apiKey: result.key,
    });

    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.organizationId).toBe(organizationId);
      expect(validation.permissions).toEqual(["read", "write"]);
      expect(validation.keyId).toBe(result.id);
    }
  });

  test("should not validate keys with incorrect format", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-invalid`,
      issuer: "https://example.test",
    });

    // Try to validate a fake key
    const validation = await authed.mutation(api.apiKeys.validate, {
      apiKey: "ml_fakekeythatdoesnotexist1234567890",
    });

    expect(validation.valid).toBe(false);
  });

  test("should not validate revoked keys", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-revoked`,
      issuer: "https://example.test",
    });

    // Create and revoke a key
    const result = await authed.mutation(api.apiKeys.create, {
      organizationId,
      name: "Key to Revoke",
      permissions: ["read"],
    });

    await authed.mutation(api.apiKeys.revoke, {
      organizationId,
      keyId: result.id,
    });

    // Try to validate the revoked key
    const validation = await authed.mutation(api.apiKeys.validate, {
      apiKey: result.key,
    });

    expect(validation.valid).toBe(false);
  });

  test("should not validate expired keys", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-expired`,
      issuer: "https://example.test",
    });

    // Create a key that's already expired
    const result = await authed.mutation(api.apiKeys.create, {
      organizationId,
      name: "Expired Key",
      permissions: ["read"],
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    });

    // Try to validate the expired key
    const validation = await authed.mutation(api.apiKeys.validate, {
      apiKey: result.key,
    });

    expect(validation.valid).toBe(false);
  });

  test("should generate different keys for different organizations", async () => {
    const t = convexTest(schema, modules);
    const { organizationId: org1Id, userId } = await createTestSetup(t);

    // Create second organization
    const [org2Id, manageSettingsPermissionId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum 2",
          slug: `test-museum-2-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: "organization.manage_settings",
          category: "organization",
        });
      }),
    ]);
    const role2Id = await t.run(async (ctx) => {
      const roleId = await ctx.db.insert("roles", {
        organizationId: org2Id,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: manageSettingsPermissionId,
      });

      return roleId;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: org2Id,
        roleId: role2Id,
        joinedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-multi-org`,
      issuer: "https://example.test",
    });

    const [key1, key2] = await Promise.all([
      authed.mutation(api.apiKeys.create, {
        organizationId: org1Id,
        name: "Org 1 Key",
        permissions: ["read"],
      }),
      authed.mutation(api.apiKeys.create, {
        organizationId: org2Id,
        name: "Org 2 Key",
        permissions: ["read"],
      }),
    ]);
    expect(key1.key).not.toBe(key2.key);
    expect(key1.key).toMatch(/^ml_[A-Za-z0-9]{37}$/);
    expect(key2.key).toMatch(/^ml_[A-Za-z0-9]{37}$/);
  });
});
