import { describe, expect, it } from "vitest";
import {
  getLoginRedirectPath,
  getSignInRedirectPath,
  isInviteRoute,
  isSignInRoute,
} from "./locale-routes";

describe("locale-aware public auth routes", () => {
  it.each([
    "/login",
    "/register",
    "/fr/login",
    "/ro/register",
    "/es/login/",
  ])("recognizes %s as a sign-in route", (pathname) => {
    expect(isSignInRoute(pathname)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/fr/dashboard",
    "/fr/login/help",
    "/de/login",
  ])("does not expose %s as a sign-in route", (pathname) => {
    expect(isSignInRoute(pathname)).toBe(false);
  });

  it.each([
    "/invite/token",
    "/fr/invite/token",
  ])("keeps invite route %s public", (pathname) => {
    expect(isInviteRoute(pathname)).toBe(true);
  });

  it("preserves a supported locale in auth redirects", () => {
    expect(getLoginRedirectPath("/fr/settings")).toBe("/fr/login");
    expect(getSignInRedirectPath("/fr/login")).toBe("/fr/");
    expect(getLoginRedirectPath("/settings")).toBe("/login");
    expect(getSignInRedirectPath("/login")).toBe("/");
  });
});
