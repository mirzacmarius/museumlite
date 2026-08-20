import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

test("dispatch rejects pending loans", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["loans.read", "loans.update"],
    {
      subscriptionTier: "pro",
      slugPrefix: "loan-fsm",
      organizationName: "Loan FSM Museum",
    },
  );

  const loanId = await t.run(async (ctx) => {
    return await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-PENDING-DISPATCH",
      type: "outgoing",
      lenderBorrowerName: "Borrowing Museum",
      startDate: Date.now(),
      status: "pending",
    });
  });

  const authed = authedForUser(t, userId);

  await expect(authed.mutation(api.loans.dispatch, { loanId })).rejects.toThrow(
    "Loan must be active to dispatch",
  );
});
