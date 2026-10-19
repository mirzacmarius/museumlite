import { expect, test } from "vitest";
import { createTranslations } from "./translator";

const translations = createTranslations({
  common: { save: "Save", greeting: "Hello {name}, you have {count} items" },
  objects: { list: { title: "Object Catalog" } },
  empty: "",
});

test("translates nested keys with and without a scope", () => {
  expect(translations.translator()("common.save")).toBe("Save");
  expect(translations.translator("objects.list")("title")).toBe(
    "Object Catalog",
  );
});

test("fills placeholders and leaves missing values empty", () => {
  const t = translations.translator("common");
  expect(t("greeting", { name: "Ada", count: 0 })).toBe(
    "Hello Ada, you have 0 items",
  );
  expect(t("greeting", { name: null })).toBe("Hello , you have  items");
  expect(t("greeting")).toBe("Hello {name}, you have {count} items");
});

test("returns the key when there is no message", () => {
  expect(translations.translator("common")("missing")).toBe("missing");
  expect(translations.translator()("empty")).toBe("empty");
});

test("builds each scope's translator once", () => {
  expect(translations.translator("common")).toBe(
    translations.translator("common"),
  );
  expect(translations.translator()).toBe(translations.translator(""));
});
