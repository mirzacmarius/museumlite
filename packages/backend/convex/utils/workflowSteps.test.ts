import { describe, expect, test } from "vitest";
import {
  resolveWorkflowApprovalDecision,
  resolveWorkflowApprovalPolicy,
  resolveWorkflowStepState,
} from "./workflowSteps";

describe("resolveWorkflowStepState", () => {
  test("sorts approval steps and resolves the next step", () => {
    const state = resolveWorkflowStepState(
      [{ stepNumber: 3 }, { stepNumber: 0 }, { stepNumber: 1 }],
      1,
    );

    expect(state.approvalSteps.map((step) => step.stepNumber)).toEqual([1, 3]);
    expect(state.currentStep).toBe(1);
    expect(state.nextStep).toBe(3);
    expect(state.isLastStep).toBe(false);
  });
});

describe("resolveWorkflowApprovalPolicy", () => {
  test("defaults missing approval policy to single approval", () => {
    expect(resolveWorkflowApprovalPolicy({ stepNumber: 1 })).toEqual({
      approvalMode: "single",
      requiredApprovals: 1,
    });
  });
});

describe("resolveWorkflowApprovalDecision", () => {
  test("single approvals advance without stored approval records", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "single",
        isPastLastStep: false,
        requiredApprovals: 1,
      }),
    ).toMatchObject({
      requiresStoredApproval: false,
      shouldAdvance: true,
      userHasAlreadyApproved: false,
    });
  });

  test("past-last-step approvals advance immediately", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "multi",
        isPastLastStep: true,
        requiredApprovals: 2,
      }),
    ).toMatchObject({
      requiresStoredApproval: false,
      shouldAdvance: true,
    });
  });

  test("multi approvals wait until the configured count is reached", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "multi",
        approvalStatus: {
          currentApprovals: 0,
          requiredApprovals: 5,
          userHasApproved: false,
        },
        isPastLastStep: false,
        requiredApprovals: 2,
      }),
    ).toEqual({
      effectiveRequiredApprovals: 2,
      newApprovalCount: 1,
      requiresStoredApproval: true,
      shouldAdvance: false,
      userHasAlreadyApproved: false,
    });
  });

  test("multi approvals advance when the configured count is reached", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "multi",
        approvalStatus: {
          currentApprovals: 1,
          requiredApprovals: 5,
          userHasApproved: false,
        },
        isPastLastStep: false,
        requiredApprovals: 2,
      }).shouldAdvance,
    ).toBe(true);
  });

  test("unanimous approvals use the computed approver count", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "unanimous",
        approvalStatus: {
          currentApprovals: 2,
          requiredApprovals: 3,
          userHasApproved: false,
        },
        isPastLastStep: false,
        requiredApprovals: 1,
      }),
    ).toMatchObject({
      effectiveRequiredApprovals: 3,
      newApprovalCount: 3,
      shouldAdvance: true,
    });
  });

  test("exposes duplicate approvals to the caller", () => {
    expect(
      resolveWorkflowApprovalDecision({
        approvalMode: "multi",
        approvalStatus: {
          currentApprovals: 1,
          requiredApprovals: 2,
          userHasApproved: true,
        },
        isPastLastStep: false,
        requiredApprovals: 2,
      }).userHasAlreadyApproved,
    ).toBe(true);
  });
});
