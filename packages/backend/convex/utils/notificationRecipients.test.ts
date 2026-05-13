import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { getWorkflowCreatorRecipient } from "./notificationRecipients";

describe("notification recipients", () => {
  test("resolves workflow creator and excludes the actor", () => {
    const creatorId = "creator" as Id<"users">;
    const actorId = "actor" as Id<"users">;

    expect(
      getWorkflowCreatorRecipient(
        [
          {
            step: 0,
            approvedBy: creatorId,
          },
        ],
        actorId,
      ),
    ).toBe(creatorId);

    expect(
      getWorkflowCreatorRecipient(
        [
          {
            step: 0,
            approvedBy: actorId,
          },
        ],
        actorId,
      ),
    ).toBeNull();
  });
});
