import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

describe("web", () => {
  test("submitTourRequest stores a marketing inquiry", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(api.web.submitTourRequest, {
      name: "Jane Curator",
      institution: "City Museum",
      email: "jane@citymuseum.org",
      collectionSize: "12,000 objects",
      message: "Interested in Gallery tier.",
    });

    expect(result).toEqual({ ok: true });

    const inquiries = await t.run(async (ctx) => {
      return await ctx.db.query("marketingInquiries").collect();
    });

    expect(inquiries).toHaveLength(1);
    expect(inquiries[0]?.name).toBe("Jane Curator");
    expect(inquiries[0]?.email).toBe("jane@citymuseum.org");
  });

  test("submitTourRequest rejects invalid email", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.web.submitTourRequest, {
        name: "Jane Curator",
        institution: "City Museum",
        email: "not-an-email",
      }),
    ).rejects.toThrow("valid email");
  });

  test("insertTourRequest trims fields", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation(internal.web.insertTourRequest, {
      name: "  Jane  ",
      institution: "  City Museum  ",
      email: "  JANE@MUSEUM.ORG  ",
      collectionSize: " 5000 ",
      message: " Hello ",
    });

    const inquiry = await t.run(async (ctx) => ctx.db.get(id));
    expect(inquiry?.name).toBe("Jane");
    expect(inquiry?.email).toBe("jane@museum.org");
  });
});
