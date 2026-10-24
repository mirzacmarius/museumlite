import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { SUBMISSIONS_PER_EMAIL_PER_HOUR } from "../convex/web";
import { createConvexTestWithRateLimiter } from "./testHarness";

const mockEnv = vi.hoisted(() => ({
  LOOPS_FORM_ID: "form 1" as string | undefined,
}));
vi.mock("../convex/env", () => ({ env: mockEnv }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mockEnv.LOOPS_FORM_ID = "form 1";
});

const HOUR = 60 * 60 * 1000;

function tourRequest(email: string) {
  return {
    name: "Jane Curator",
    institution: "City Museum",
    email,
  };
}

function stubLoops(response: () => Response | Promise<Response>) {
  const provider = vi.fn(async (_url: string, _init?: RequestInit) =>
    response(),
  );
  vi.stubGlobal("fetch", provider);
  return provider;
}

describe("web", () => {
  test("submitTourRequest stores a marketing inquiry", async () => {
    const t = createConvexTestWithRateLimiter();

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
    const t = createConvexTestWithRateLimiter();

    await expect(
      t.action(api.web.submitTourRequest, tourRequest("not-an-email")),
    ).rejects.toThrow("valid email");
  });

  test("submitTourRequest refuses fields longer than the form allows", async () => {
    const t = createConvexTestWithRateLimiter();

    await expect(
      t.action(api.web.submitTourRequest, {
        ...tourRequest("jane@citymuseum.org"),
        message: "x".repeat(5001),
      }),
    ).rejects.toThrow("too long");
    await expect(
      t.action(
        api.web.submitTourRequest,
        tourRequest(`${"a".repeat(250)}@museum.org`),
      ),
    ).rejects.toThrow("valid email");

    const inquiries = await t.run(async (ctx) =>
      ctx.db.query("marketingInquiries").collect(),
    );
    expect(inquiries).toHaveLength(0);
  });

  test("one address gets a few tour requests an hour, then waits", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithRateLimiter();
    const request = tourRequest("Jane@CityMuseum.org");

    for (let sent = 0; sent < SUBMISSIONS_PER_EMAIL_PER_HOUR; sent++) {
      await t.action(api.web.submitTourRequest, request);
    }
    await expect(
      t.action(api.web.submitTourRequest, {
        ...request,
        email: "jane@citymuseum.org",
      }),
    ).rejects.toThrow("Too many requests");
    await t.action(
      api.web.submitTourRequest,
      tourRequest("someone@citymuseum.org"),
    );

    vi.advanceTimersByTime(HOUR);
    await t.action(api.web.submitTourRequest, request);

    const inquiries = await t.run(async (ctx) =>
      ctx.db.query("marketingInquiries").collect(),
    );
    expect(inquiries).toHaveLength(SUBMISSIONS_PER_EMAIL_PER_HOUR + 2);
  });

  test("tour requests from many addresses stop after a burst", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithRateLimiter();

    let refused = 0;
    for (let sender = 0; sender < 25; sender++) {
      try {
        await t.action(
          api.web.submitTourRequest,
          tourRequest(`visitor${sender}@example.org`),
        );
      } catch {
        refused++;
      }
    }

    const inquiries = await t.run(async (ctx) =>
      ctx.db.query("marketingInquiries").collect(),
    );
    expect(inquiries).toHaveLength(20);
    expect(refused).toBe(5);
  });

  test("insertTourRequest trims fields", async () => {
    const t = createConvexTestWithRateLimiter();

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

  test("subscribe answers only ok, never the provider's reply", async () => {
    const t = createConvexTestWithRateLimiter();
    const provider = stubLoops(() =>
      Response.json({ success: true, id: "contact_123" }),
    );

    const result = await t.action(api.web.subscribe, {
      email: " Reader@Example.org ",
      userGroup: "Collectors",
    });

    expect(result).toEqual({ ok: true });
    expect(provider).toHaveBeenCalledTimes(1);
    const [url, init] = provider.mock.calls[0]!;
    expect(url).toBe("https://app.loops.so/api/newsletter-form/form%201");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "reader@example.org",
      userGroup: "Collectors",
    });
  });

  test("subscribe reports a provider refusal or outage as unavailable", async () => {
    const t = createConvexTestWithRateLimiter();

    stubLoops(() =>
      Response.json(
        { success: false, message: "Invalid form" },
        { status: 400 },
      ),
    );
    expect(
      await t.action(api.web.subscribe, {
        email: "reader@example.org",
        userGroup: "",
      }),
    ).toEqual({ ok: false, error: "unavailable" });

    stubLoops(() => {
      throw new TypeError("fetch failed");
    });
    expect(
      await t.action(api.web.subscribe, {
        email: "other@example.org",
        userGroup: "",
      }),
    ).toEqual({ ok: false, error: "unavailable" });

    mockEnv.LOOPS_FORM_ID = undefined;
    const provider = stubLoops(() => Response.json({ success: true }));
    expect(
      await t.action(api.web.subscribe, {
        email: "third@example.org",
        userGroup: "",
      }),
    ).toEqual({ ok: false, error: "unavailable" });
    expect(provider).not.toHaveBeenCalled();
  });

  test("subscribe refuses bad input before calling the provider", async () => {
    const t = createConvexTestWithRateLimiter();
    const provider = stubLoops(() => Response.json({ success: true }));

    for (const args of [
      { email: "not-an-email", userGroup: "" },
      { email: "reader@example.org", userGroup: "x".repeat(65) },
    ]) {
      expect(await t.action(api.web.subscribe, args)).toEqual({
        ok: false,
        error: "invalid_input",
      });
    }
    expect(provider).not.toHaveBeenCalled();
  });

  test("one address is signed up a few times an hour at most", async () => {
    const t = createConvexTestWithRateLimiter();
    const provider = stubLoops(() => Response.json({ success: true }));

    for (let sent = 0; sent < SUBMISSIONS_PER_EMAIL_PER_HOUR; sent++) {
      expect(
        await t.action(api.web.subscribe, {
          email: "reader@example.org",
          userGroup: "",
        }),
      ).toEqual({ ok: true });
    }
    expect(
      await t.action(api.web.subscribe, {
        email: "READER@example.org",
        userGroup: "",
      }),
    ).toEqual({ ok: false, error: "rate_limited" });
    expect(provider).toHaveBeenCalledTimes(SUBMISSIONS_PER_EMAIL_PER_HOUR);
  });
});
