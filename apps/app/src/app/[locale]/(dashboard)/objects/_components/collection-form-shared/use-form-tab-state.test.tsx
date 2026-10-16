// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useFormTabState } from "./use-form-tab-state";

test("the edit form opens on the tab its link names", () => {
  const { result } = renderHook(() =>
    useFormTabState({
      isLocationTrackingEnabled: true,
      initialTab: "provenance",
    }),
  );

  expect(result.current.activeTab).toBe("provenance");
});

test("a linked Valuation tab opens once the viewer's permissions load", () => {
  const { result, rerender } = renderHook(
    ({ permissions }: { permissions: string[] }) =>
      useFormTabState({
        isLocationTrackingEnabled: true,
        savedObject: true,
        initialTab: "valuation",
        permissions,
      }),
    { initialProps: { permissions: [] } },
  );
  expect(result.current.activeTab).toBe("general");

  rerender({ permissions: ["collections.view_valuation"] });

  expect(result.current.activeTab).toBe("valuation");
});

test("a link to a tab the form lacks opens the first tab", () => {
  const { result } = renderHook(() =>
    useFormTabState({ isLocationTrackingEnabled: true, initialTab: "logs" }),
  );

  expect(result.current.activeTab).toBe("general");
});
