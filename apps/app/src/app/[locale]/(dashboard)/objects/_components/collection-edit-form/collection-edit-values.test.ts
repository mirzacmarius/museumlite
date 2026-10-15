import { expect, test } from "vitest";
import { initialRecordFormState, recordFormReducer } from "@/lib/record-form";
import { EMPTY_EDIT_FORM } from "../collection-form-shared/utils";
import {
  type CollectionEditValues,
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
