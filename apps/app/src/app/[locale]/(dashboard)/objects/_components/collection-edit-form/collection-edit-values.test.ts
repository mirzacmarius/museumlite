import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { expect, test } from "vitest";
import {
  draftFromEdtf,
  EMPTY_PRODUCTION_DATE_DRAFT,
} from "@/components/production-date/production-date-draft";
import { EMPTY_PARTIAL_DATE } from "@/components/provenance/historical-date";
import {
  differingFields,
  initialRecordFormState,
  recordFormReducer,
} from "@/lib/record-form";
import { EMPTY_EDIT_FORM } from "../collection-form-shared/utils";
import {
  type CollectionEditValues,
  collectionUpdatePatch,
  comparableCollectionEdit,
} from "./collection-edit-values";

test("accepting a condition assessment does not hold up unsaved edits to the object", () => {
  const reduce = recordFormReducer(comparableCollectionEdit);
  const stored: CollectionEditValues = {
    ...EMPTY_EDIT_FORM,
    title: "Vase",
    condition: "Fair",
    conditionChangeNote: "",
  };
  let state = reduce(initialRecordFormState(stored), {
    type: "sync",
    latest: { values: stored, editVersion: "before-acceptance" },
    recovered: null,
  });
  state = reduce(state, {
    type: "update",
    update: (values) => ({ ...values, title: "Blue vase" }),
  });

  state = reduce(state, {
    type: "sync",
    latest: {
      values: { ...stored, condition: "Poor" },
      editVersion: "after-acceptance",
    },
    recovered: null,
  });

  expect(state.base?.editVersion).toBe("after-acceptance");
  expect(state.values.title).toBe("Blue vase");
});

const collectionId = "collection" as Id<"collections">;

function changedFrom(
  stored: CollectionEditValues,
  edited: CollectionEditValues,
) {
  return differingFields(edited, stored, comparableCollectionEdit);
}

test("a structured date made saves as EDTF, and an empty one clears it", () => {
  const stored: CollectionEditValues = {
    ...EMPTY_EDIT_FORM,
    title: "Jug",
    dateCreated: "about 1850",
    dateCreatedEdtf: draftFromEdtf("1850~"),
    conditionChangeNote: "",
  };
  const ranged: CollectionEditValues = {
    ...stored,
    dateCreatedEdtf: draftFromEdtf("1848/1852"),
  };
  expect(changedFrom(stored, ranged)).toEqual(["dateCreatedEdtf"]);
  expect(
    collectionUpdatePatch(collectionId, ranged, changedFrom(stored, ranged)),
  ).toEqual({ collectionId, dateCreatedEdtf: "1848/1852" });

  const cleared = { ...stored, dateCreatedEdtf: EMPTY_PRODUCTION_DATE_DRAFT };
  expect(
    collectionUpdatePatch(collectionId, cleared, changedFrom(stored, cleared)),
  ).toEqual({ collectionId, dateCreatedEdtf: "" });
});

test("only a structured date staff touched is sent", () => {
  const stored: CollectionEditValues = {
    ...EMPTY_EDIT_FORM,
    title: "Jug",
    dateCreatedEdtf: draftFromEdtf("18XX"),
    conditionChangeNote: "",
  };
  const retitled = { ...stored, title: "Stoneware jug" };
  expect(
    collectionUpdatePatch(
      collectionId,
      retitled,
      changedFrom(stored, retitled),
    ),
  ).toEqual({ collectionId, title: "Stoneware jug" });

  const hiddenParts = {
    ...stored,
    dateCreatedEdtf: draftFromEdtf(undefined),
  };
  const untouched = {
    ...hiddenParts,
    dateCreatedEdtf: {
      ...EMPTY_PRODUCTION_DATE_DRAFT,
      to: { ...EMPTY_PARTIAL_DATE, year: "1900", qualifier: "circa" as const },
    },
  };
  expect(changedFrom(hiddenParts, untouched)).toEqual([]);
});

test("a half-entered structured date counts as a change", () => {
  const stored: CollectionEditValues = {
    ...EMPTY_EDIT_FORM,
    title: "Jug",
    conditionChangeNote: "",
  };
  const started = {
    ...stored,
    dateCreatedEdtf: {
      ...EMPTY_PRODUCTION_DATE_DRAFT,
      from: { ...EMPTY_PARTIAL_DATE, precision: "year" as const },
    },
  };
  expect(changedFrom(stored, started)).toEqual(["dateCreatedEdtf"]);
});
