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
});
