import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("savedViews schema", () => {
  test("should create savedViews table entries directly", async () => {
    const t = convexTest(schema, modules);

    const [userId, orgId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", { email: "test@example.com" });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
    ]);
    const viewId = await t.run(async (ctx) => {
      return await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "My Test View",
        module: "objects",
        filters: JSON.stringify({ search: "test", status: "active" }),
        isDefault: false,
        createdAt: Date.now(),
      });
    });

    expect(viewId).toBeDefined();

    const view = await t.run(async (ctx) => {
      return await ctx.db.get(viewId);
    });

    expect(view).toBeDefined();
    expect(view?.name).toBe("My Test View");
    expect(view?.module).toBe("objects");
    expect(view?.filters).toBe(
      JSON.stringify({ search: "test", status: "active" }),
    );
  });

  test("should query savedViews by user and module index", async () => {
    const t = convexTest(schema, modules);

    const [userId, orgId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", { email: "test@example.com" });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "Objects View 1",
        module: "objects",
        filters: "{}",
        createdAt: Date.now(),
      });
      await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "Objects View 2",
        module: "objects",
        filters: "{}",
        createdAt: Date.now(),
      });
      await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "Loans View",
        module: "loans",
        filters: "{}",
        createdAt: Date.now(),
      });
    });

    const objectsViews = await t.run(async (ctx) => {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_user_and_module", (q) =>
          q.eq("userId", userId).eq("module", "objects"),
        )
        .collect();
    });

    expect(objectsViews).toHaveLength(2);

    const allViews = await t.run(async (ctx) => {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_organization_and_user", (q) =>
          q.eq("organizationId", orgId).eq("userId", userId),
        )
        .collect();
    });

    expect(allViews).toHaveLength(3);
  });

  test("should support isDefault flag", async () => {
    const t = convexTest(schema, modules);

    const [userId, orgId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", { email: "test@example.com" });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "Default Objects",
        module: "objects",
        filters: "{}",
        isDefault: true,
        createdAt: Date.now(),
      });
      await ctx.db.insert("savedViews", {
        organizationId: orgId,
        userId,
        name: "Non-default Objects",
        module: "objects",
        filters: "{}",
        isDefault: false,
        createdAt: Date.now(),
      });
    });

    const views = await t.run(async (ctx) => {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_user_and_module", (q) =>
          q.eq("userId", userId).eq("module", "objects"),
        )
        .collect();
    });

    const defaultView = views.find((v) => v.isDefault === true);
    expect(defaultView).toBeDefined();
    expect(defaultView?.name).toBe("Default Objects");
  });

  test("should support all module types", async () => {
    const t = convexTest(schema, modules);

    const [userId, orgId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", { email: "test@example.com" });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
    ]);
    const moduleTypes = [
      "objects",
      "loans",
      "accounts",
      "locations",
      "accessions",
    ] as const;

    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(moduleTypes).map(async (module) => {
          await ctx.db.insert("savedViews", {
            organizationId: orgId,
            userId,
            name: `${module} View`,
            module,
            filters: "{}",
            createdAt: Date.now(),
          });
        }),
      );
    });

    const allViews = await t.run(async (ctx) => {
      return await ctx.db
        .query("savedViews")
        .withIndex("by_organization_and_user", (q) =>
          q.eq("organizationId", orgId).eq("userId", userId),
        )
        .collect();
    });

    expect(allViews).toHaveLength(5);
    const viewsByModule = new Map(allViews.map((v) => [v.module, v]));
    for (const module of moduleTypes) {
      expect(viewsByModule.get(module)).toBeDefined();
    }
  });
});
