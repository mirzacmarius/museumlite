import type { LoanAgreementTemplateSection } from "@/lib/loan-agreement-template";
import type {
  LoanAgreementTemplate,
  TemplateLanguage,
  TemplateLoanType,
} from "./template-options";

export interface DraftSection extends LoanAgreementTemplateSection {
  /** Client-only key so sections keep their identity while reordered. */
  id: string;
}

export interface TemplateDraftState {
  name: string;
  language: TemplateLanguage;
  loanType: TemplateLoanType;
  sections: DraftSection[];
  isSaving: boolean;
  error: string | null;
}

export type TemplateDraftAction =
  | { type: "setName"; name: string }
  | { type: "setLanguage"; language: TemplateLanguage }
  | { type: "setLoanType"; loanType: TemplateLoanType }
  | {
      type: "updateSection";
      id: string;
      patch: Partial<LoanAgreementTemplateSection>;
    }
  | { type: "addSection"; id: string }
  | { type: "removeSection"; id: string }
  | { type: "moveSection"; id: string; offset: -1 | 1 }
  | {
      type: "replaceSections";
      sections: DraftSection[];
      language: TemplateLanguage;
    }
  | { type: "saveStarted" }
  | { type: "saveFailed"; error: string };

let nextSectionNumber = 0;

/** Creates a client-only section key; call from event handlers, not reducers. */
export function newSectionId() {
  nextSectionNumber += 1;
  return `draft-section-${nextSectionNumber}`;
}

export function withSectionIds(
  sections: LoanAgreementTemplateSection[],
): DraftSection[] {
  return sections.map((section) => ({ ...section, id: newSectionId() }));
}

export function initialTemplateDraft({
  template,
  language,
}: {
  template: LoanAgreementTemplate | null;
  language: TemplateLanguage;
}): TemplateDraftState {
  return {
    name: template?.name ?? "",
    language: template?.language ?? language,
    loanType: template?.loanType ?? "any",
    sections: template
      ? withSectionIds(template.sections)
      : [{ id: newSectionId(), heading: "", body: "" }],
    isSaving: false,
    error: null,
  };
}

function moveSection(sections: DraftSection[], id: string, offset: -1 | 1) {
  const from = sections.findIndex((section) => section.id === id);
  const to = from + offset;
  const moving = sections[from];
  if (from === -1 || to < 0 || to >= sections.length || !moving) {
    return sections;
  }
  const reordered = sections.filter((section) => section.id !== id);
  reordered.splice(to, 0, moving);
  return reordered;
}

export function templateDraftReducer(
  state: TemplateDraftState,
  action: TemplateDraftAction,
): TemplateDraftState {
  switch (action.type) {
    case "setName":
      return { ...state, name: action.name };
    case "setLanguage":
      return { ...state, language: action.language };
    case "setLoanType":
      return { ...state, loanType: action.loanType };
    case "updateSection":
      return {
        ...state,
        sections: state.sections.map((section) =>
          section.id === action.id ? { ...section, ...action.patch } : section,
        ),
      };
    case "addSection":
      return {
        ...state,
        sections: [...state.sections, { id: action.id, heading: "", body: "" }],
      };
    case "removeSection":
      return {
        ...state,
        sections: state.sections.filter((section) => section.id !== action.id),
      };
    case "moveSection":
      return {
        ...state,
        sections: moveSection(state.sections, action.id, action.offset),
      };
    case "replaceSections":
      return {
        ...state,
        sections: action.sections,
        language: action.language,
      };
    case "saveStarted":
      return { ...state, isSaving: true, error: null };
    case "saveFailed":
      return { ...state, isSaving: false, error: action.error };
  }
}
