import {
  COMPLETENESS_LABELS,
  COMPLETENESS_VALUES,
  completenessFromText,
  MEASURED_PART_LABELS,
  MEASURED_PARTS,
  measuredPartFromText,
} from "@v1/backend/convex/utils/objectDescription";
import { expect, test } from "vitest";
import en from "@/locales/en";
import es from "@/locales/es";
import fr from "@/locales/fr";
import no from "@/locales/no";
import ro from "@/locales/ro";

// The import reads these labels from the backend's copy, in this order.
const LOCALES = [en, es, fr, no, ro] as const;

test.each(
  LOCALES.map((locale, index) => [index, locale] as const),
)("the import reads the completeness and measured part labels of locale %i", (index, locale) => {
  for (const code of COMPLETENESS_VALUES) {
    const label = locale.objectDescription.completeness[code];
    expect(COMPLETENESS_LABELS[code][index]).toBe(label);
    expect(completenessFromText(label)).toBe(code);
  }
  for (const code of MEASURED_PARTS) {
    const label = locale.objectDescription.parts[code];
    expect(MEASURED_PART_LABELS[code][index]).toBe(label);
    expect(measuredPartFromText(label)).toBe(code);
  }
});
