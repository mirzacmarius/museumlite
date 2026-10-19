export interface Dictionary {
  readonly [key: string]: string | Dictionary;
}

export type TranslationValues = Record<
  string,
  string | number | null | undefined
>;
export type Translate = (key: string, values?: TranslationValues) => string;

export interface Translations {
  translator(scope?: string): Translate;
}

const PLACEHOLDER = /\{([^}]*)\}/g;

function flattenDictionary(dictionary: Dictionary): Map<string, string> {
  const messages = new Map<string, string>();
  const visit = (node: Dictionary, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") messages.set(prefix + key, value);
      else visit(value, `${prefix}${key}.`);
    }
  };
  visit(dictionary, "");
  return messages;
}

/**
 * Translators for one locale's dictionary. The dictionary is flattened once
 * and each scope's translator is built once, so a hook call in every row of
 * a long list costs a map lookup instead of a pass over every key.
 */
export function createTranslations(dictionary: Dictionary): Translations {
  const messages = flattenDictionary(dictionary);
  const translators = new Map<string, Translate>();

  return {
    translator(scope = "") {
      const cached = translators.get(scope);
      if (cached) return cached;
      const prefix = scope ? `${scope}.` : "";
      const translate: Translate = (key, values) => {
        const message = messages.get(prefix + key) || key;
        if (!values) return message;
        return message.replace(PLACEHOLDER, (_, name: string) =>
          String(values[name] ?? ""),
        );
      };
      translators.set(scope, translate);
      return translate;
    },
  };
}
