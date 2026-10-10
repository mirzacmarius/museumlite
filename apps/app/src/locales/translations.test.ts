import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";
import en from "./en";
import es from "./es";
import fr from "./fr";
import no from "./no";
import ro from "./ro";

function flattenTranslations(
  dictionary: object,
  prefix = "",
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dictionary).flatMap(([key, value]) => {
      const path = `${prefix}${key}`;
      if (typeof value === "string") return [[path, value]];
      if (typeof value === "object" && value !== null) {
        return Object.entries(flattenTranslations(value, `${path}.`));
      }
      throw new Error(`Invalid translation at ${path}`);
    }),
  );
}

function interpolationValues(value: string): string[] {
  // English plural suffixes may be omitted or repeated for another language's grammar.
  return [
    ...new Set([...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])),
  ]
    .filter(
      (name): name is string => !!name && name !== "s" && name !== "plural",
    )
    .sort();
}

const english = flattenTranslations(en);

for (const [locale, dictionary] of Object.entries({ en, es, fr, no, ro })) {
  test(`${locale} includes every English translation and its interpolation values`, () => {
    const translations = flattenTranslations(dictionary);
    const missing = Object.keys(english).filter(
      (key) => !(key in translations),
    );
    expect(missing).toEqual([]);
    for (const [key, value] of Object.entries(english)) {
      const translated = translations[key];
      expect(translated?.trim(), `${locale}:${key}`).toBeTruthy();
      expect(
        interpolationValues(translated ?? ""),
        `${locale}:${key} interpolation values`,
      ).toEqual(interpolationValues(value));
    }
  });

  test(`${locale} has no translations that English lacks`, () => {
    const orphans = Object.keys(flattenTranslations(dictionary)).filter(
      (key) => !(key in english),
    );
    expect(orphans).toEqual([]);
  });
}

/** Words of three or more letters, without interpolation values. */
function words(value: string): string[] {
  return value.replace(/\{[^{}]+\}/g, " ").match(/\p{L}{3,}/gu) ?? [];
}

/**
 * URLs, addresses, field names such as `accessionNumber` and lists of CSV
 * values read the same everywhere.
 */
function isTechnical(value: string): boolean {
  return /:\/\/|@|\b\p{Ll}+\p{Lu}\p{L}*|^\p{Ll}+(, \p{Ll}+)+$/u.test(value);
}

/** Proper names kept in English in every language. */
const PROPER_NAMES = new Set([
  "library.catalog.new.lcClassification",
  "library.settings.libraryOfCongress",
  "untranslatedDashboard.settings.libraryOfCongress",
  "untranslatedRecords.collections.import.templates.tms",
]);

for (const [locale, dictionary] of Object.entries({ es, fr, no, ro })) {
  test(`${locale} translates every phrase instead of repeating the English`, () => {
    const translations = flattenTranslations(dictionary);
    const untranslated = Object.entries(english)
      .filter(
        ([key, value]) =>
          translations[key] === value &&
          words(value).length >= 2 &&
          !isTechnical(value) &&
          !PROPER_NAMES.has(key),
      )
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
}

type Locale = "es" | "fr" | "no" | "ro";

/**
 * Each locale's word for a glossary term (GLOSSARY.md, Translations). Where
 * English names the term, the translation uses the accepted word and never
 * the word for a different term.
 */
const GLOSSARY_TERMS: Array<{
  english: RegExp;
  accepted?: Record<Locale, RegExp>;
  avoided?: Record<Locale, RegExp>;
  exceptions?: ReadonlySet<string>;
}> = [
  {
    english: /(?<!\p{L})objects?(?!\p{L})/iu,
    accepted: { es: /objeto/iu, fr: /objet/iu, no: /objekt/iu, ro: /obiect/iu },
    // French collection records call an object's name its "dénomination".
    exceptions: new Set(["documentationQuality.requirements.object_name"]),
  },
  {
    english: /(?<!\p{L})locations?(?!\p{L})/iu,
    accepted: {
      es: /ubicaci/iu,
      fr: /emplacement/iu,
      no: /plassering|sted/iu,
      ro: /loca[tț]i/iu,
    },
    // The place an insurance incident happened is not a Location record.
    exceptions: new Set(["untranslatedDashboard.insurance.incidentLocation"]),
  },
  {
    // An Accession is not an Acquisition: English that names only accessions
    // never reads as an acquisition.
    english: /^(?!.*acqui)(?!.*deaccession).*(?<!\p{L})accession/iu,
    avoided: {
      es: /adquisici/iu,
      fr: /acquisition/iu,
      no: /erverv/iu,
      ro: /achizi/iu,
    },
  },
];

/** Optional modules, the Library Module and reports name their own fields. */
const OWN_VOCABULARY =
  /^(modules\.|library\.|analytics\.|untranslatedDashboard\.analytics\.)/;

for (const [locale, dictionary] of Object.entries({ es, fr, no, ro })) {
  test(`${locale} uses the glossary's word wherever English names a glossary term`, () => {
    const translations = flattenTranslations(dictionary);
    const drifted = GLOSSARY_TERMS.flatMap(
      ({ english: term, accepted, avoided, exceptions }) =>
        Object.entries(english)
          .filter(([key, value]) => {
            if (
              !term.test(value.replace(/\{[^{}]+\}/g, "")) ||
              OWN_VOCABULARY.test(key) ||
              isTechnical(value) ||
              exceptions?.has(key)
            ) {
              return false;
            }
            const translated = translations[key] ?? "";
            return (
              accepted?.[locale as Locale].test(translated) === false ||
              avoided?.[locale as Locale].test(translated) === true
            );
          })
          .map(([key]) => key),
    );
    expect(drifted).toEqual([]);
  });
}

/**
 * GLOSSARY.md reserves Item for library circulation. Outside the Library
 * Module, staff never read the "item" words below for an Object.
 */
const ITEM_WORDS = {
  en: /(?<!\p{L})items?(?!\p{L})/iu,
  es: /(?<!\p{L})(artículos?|elementos?)(?!\p{L})/iu,
  fr: /(?<!\p{L})(articles?|éléments?)(?!\p{L})/iu,
  no: /(?<!\p{L})(artikkel\p{L}*|artikl\p{L}*|element\p{L}*)(?!\p{L})/iu,
  ro: /(?<!\p{L})(articol\p{L}*|element\p{L}*)(?!\p{L})/iu,
};

/** Library circulation, developer tools, reports and provenance evidence items. */
const ITEM_NAMESPACES =
  /^(library\.|modules\.library|untranslatedDashboard\.settings\.|developer\.|settings\.developer\.|settings\.data\.|analytics\.|untranslatedDashboard\.analytics\.|exportJobs\.|registerReports\.|provenance\.)/;

for (const [locale, dictionary] of Object.entries({ en, es, fr, no, ro })) {
  test(`${locale} never calls an object an item outside the Library Module`, () => {
    const itemWord = ITEM_WORDS[locale as keyof typeof ITEM_WORDS];
    const items = Object.entries(flattenTranslations(dictionary))
      .filter(
        ([key, value]) =>
          !ITEM_NAMESPACES.test(key) &&
          itemWord.test(value.replace(/\{[^{}]+\}/g, "")),
      )
      .map(([key]) => key);
    expect(items).toEqual([]);
  });
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "locales" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

test("literal translation calls resolve to an English string", () => {
  const files = sourceFiles(fileURLToPath(new URL("../", import.meta.url)));
  const program = ts.createProgram(files, {
    noResolve: true,
    noLib: true,
    jsx: ts.JsxEmit.Preserve,
  });
  const checker = program.getTypeChecker();
  const missing = new Set<string>();
  const hooks = new Set([
    "useI18n",
    "getI18n",
    "useScopedI18n",
    "getScopedI18n",
  ]);
  const scopedHooks = new Set(["useScopedI18n", "getScopedI18n"]);
  let checkedCalls = 0;

  for (const path of files) {
    const source = program.getSourceFile(path);
    if (!source) continue;

    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const declaration = checker.getSymbolAtLocation(
          node.expression,
        )?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration)) {
          let initializer = declaration.initializer;
          if (initializer && ts.isAwaitExpression(initializer)) {
            initializer = initializer.expression;
          }
          if (
            initializer &&
            ts.isCallExpression(initializer) &&
            ts.isIdentifier(initializer.expression) &&
            hooks.has(initializer.expression.text)
          ) {
            const argument = node.arguments[0];
            const scope = initializer.arguments[0];
            if (argument && ts.isStringLiteralLike(argument)) {
              const prefix =
                scopedHooks.has(initializer.expression.text) &&
                scope &&
                ts.isStringLiteralLike(scope)
                  ? `${scope.text}.`
                  : "";
              const key = `${prefix}${argument.text}`;
              checkedCalls++;
              if (!(key in english)) missing.add(key);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  expect(checkedCalls).toBeGreaterThan(0);
  expect(Array.from(missing).toSorted()).toEqual([]);
}, 15_000);
