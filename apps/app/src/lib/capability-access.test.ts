import { expect, test } from "vitest";
import {
  type CapabilityState,
  sectionCapabilityState,
} from "./capability-access";

const base = { capability: "reporting", listed: true } as const;

test("a section is open when the capability is available and the role has its permission", () => {
  const state: CapabilityState = { ...base, status: "available" };
  expect(sectionCapabilityState(state, true)).toEqual(state);
});

test("a role without the section permission sees it as permission missing, never as an upgrade", () => {
  expect(
    sectionCapabilityState({ ...base, status: "available" }, false),
  ).toEqual({ ...base, status: "permission_missing" });
  expect(
    sectionCapabilityState(
      { ...base, status: "tier_required", requiredTier: "pro" },
      false,
    ),
  ).toEqual({ ...base, status: "permission_missing" });
});

test("a disabled module still explains the section before the role does", () => {
  const state: CapabilityState = {
    capability: "accounts",
    listed: true,
    status: "module_disabled",
    module: "accounts",
  };
  expect(sectionCapabilityState(state, false)).toEqual(state);
});
