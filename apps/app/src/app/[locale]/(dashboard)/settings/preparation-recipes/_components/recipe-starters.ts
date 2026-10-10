import { useScopedI18n } from "@/locales/client";
import {
  blankStep,
  type DueAnchor,
  type OwnerKind,
  type RecipeDraft,
  type StepDraft,
} from "./recipe-draft";

export const STARTERS = ["intake", "transport", "return", "blank"] as const;
export type StarterId = (typeof STARTERS)[number];

function step(
  title: string,
  options: {
    evidence?: StepDraft["evidence"];
    owner?: OwnerKind;
    due?: [DueAnchor, number];
    dependsOn?: StepDraft[];
  },
): StepDraft {
  return {
    ...blankStep(),
    title,
    evidence: options.evidence ?? "none",
    ownerKind: options.owner ?? "caseAssignee",
    dueAnchor: options.due?.[0] ?? "none",
    offsetDays: String(options.due?.[1] ?? 0),
    dependsOn: (options.dependsOn ?? []).map(
      (dependency) => dependency.clientKey,
    ),
  };
}

/**
 * Starting points for the three kinds of preparation: catalog, photography
 * and condition after an intake; packing, insurance and transport before a
 * loan or exhibition starts; and the return around its end. Staff edit them
 * before saving, in their own words.
 */
export function useRecipeStarter() {
  const t = useScopedI18n("preparationRecipes.starters");
  return (starter: StarterId): RecipeDraft => {
    switch (starter) {
      case "intake":
        return {
          name: t("intake.name"),
          trigger: "intake_accepted",
          loanDirection: "any",
          steps: [
            step(t("intake.catalog"), { due: ["event", 7] }),
            step(t("intake.photograph"), {
              evidence: "media",
              due: ["event", 14],
            }),
            step(t("intake.condition"), {
              evidence: "conditionAssessment",
              due: ["event", 14],
            }),
          ],
        };
      case "transport": {
        const condition = step(t("transport.condition"), {
          evidence: "conditionAssessment",
          due: ["start", -14],
        });
        const insurance = step(t("transport.insurance"), {
          owner: "approver",
          due: ["start", -10],
        });
        const pack = step(t("transport.pack"), {
          evidence: "media",
          due: ["start", -3],
          dependsOn: [condition],
        });
        const transport = step(t("transport.transport"), {
          due: ["start", -7],
          dependsOn: [insurance],
        });
        return {
          name: t("transport.name"),
          trigger: "loan_approved",
          loanDirection: "outgoing",
          steps: [condition, insurance, pack, transport],
        };
      }
      case "return": {
        const transport = step(t("return.transport"), { due: ["end", -21] });
        const condition = step(t("return.condition"), {
          evidence: "conditionAssessment",
          due: ["end", 3],
          dependsOn: [transport],
        });
        const move = step(t("return.move"), {
          evidence: "movement",
          due: ["end", 7],
          dependsOn: [condition],
        });
        return {
          name: t("return.name"),
          trigger: "loan_approved",
          loanDirection: "any",
          steps: [transport, condition, move],
        };
      }
      case "blank":
        return {
          name: "",
          trigger: "intake_accepted",
          loanDirection: "any",
          steps: [blankStep()],
        };
    }
  };
}
