import { afterEach, describe, expect, it, vi } from "vitest";
import { persistWebLocale } from "./persist";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("persistWebLocale", () => {
  it("uses CookieStore with a one-year expiry when available", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const set = vi.fn();
    vi.stubGlobal("window", {
      cookieStore: { set },
      location: { protocol: "https:" },
    });

    await persistWebLocale("fr");

    expect(set).toHaveBeenCalledWith({
      name: "museumlite-web-locale",
      value: "fr",
      expires: new Date("2027-01-01T00:00:00.000Z").getTime(),
      path: "/",
      sameSite: "lax",
    });
  });

  it("falls back to a host-only secure cookie and resolves invalid locales to English", async () => {
    let cookieValue = "";
    const documentStub = Object.defineProperty({}, "cookie", {
      get: () => cookieValue,
      set: (value: string) => {
        cookieValue = value;
      },
    });
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    vi.stubGlobal("document", documentStub);

    await persistWebLocale("unsupported");

    expect(cookieValue).toContain("museumlite-web-locale=en");
    expect(cookieValue).toContain("Max-Age=31536000");
    expect(cookieValue).toContain("Path=/");
    expect(cookieValue).toContain("SameSite=Lax");
    expect(cookieValue).toContain("Secure");
    expect(cookieValue).not.toContain("Domain=");
  });

  it("omits Secure for the fallback cookie on HTTP", async () => {
    let cookieValue = "";
    const documentStub = Object.defineProperty({}, "cookie", {
      set: (value: string) => {
        cookieValue = value;
      },
    });
    vi.stubGlobal("window", { location: { protocol: "http:" } });
    vi.stubGlobal("document", documentStub);

    await persistWebLocale("no");

    expect(cookieValue).toContain("museumlite-web-locale=no");
    expect(cookieValue).not.toContain("Secure");
  });
});
