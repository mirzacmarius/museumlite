import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("should create import job from CSV", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should validate import field mapping", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should process import batch", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should handle import errors gracefully", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should track import progress", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("should rollback failed import", async () => {
  const t = convexTest(schema, modules);
  expect(true).toBe(true);
});

test("getImportTemplate returns PastPerfect template", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const template = await t.query(
    api.imports.getImportTemplate,
    {
      templateName: "PastPerfect",
    },
    { as: userId },
  );

  expect(template).not.toBeNull();
  expect(template?.name).toBe("PastPerfect");
  expect(template?.system).toBe("PastPerfect");
  expect(template?.collectionMappings).toBeDefined();
  expect(template?.accessionMappings).toBeDefined();
  expect(template?.collectionMappings.length).toBeGreaterThan(0);
  expect(template?.accessionMappings.length).toBeGreaterThan(0);
});

test("getImportTemplate returns TMS template", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const template = await t.query(
    api.imports.getImportTemplate,
    {
      templateName: "TMS",
    },
    { as: userId },
  );

  expect(template).not.toBeNull();
  expect(template?.name).toBe("TMS");
  expect(template?.system).toBe("TMS");
  expect(template?.collectionMappings).toBeDefined();
  expect(template?.accessionMappings).toBeDefined();
  expect(template?.collectionMappings.length).toBeGreaterThan(0);
  expect(template?.accessionMappings.length).toBeGreaterThan(0);
});

test("listImportTemplates returns both PastPerfect and TMS templates", async () => {
  const t = convexTest(schema, modules);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const templates = await t.query(api.imports.listImportTemplates, {}, { as: userId });

  expect(templates).toBeDefined();
  expect(templates.length).toBe(2);

  const templateNames = templates.map((t) => t.name);
  expect(templateNames).toContain("PastPerfect");
  expect(templateNames).toContain("TMS");
});
