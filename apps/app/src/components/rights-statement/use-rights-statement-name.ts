"use client";

import { rightsStatementByUri } from "@v1/backend/convex/utils/rightsStatements";
import { useCallback } from "react";
import { useI18n } from "@/locales/client";

/** A rights statement's name in the app language; an unknown URI as stored. */
export function useRightsStatementName() {
  const tRoot = useI18n();
  return useCallback(
    (uri: string) => {
      const statement = rightsStatementByUri(uri);
      return statement
        ? tRoot(`rightsStatements.names.${statement.code}`)
        : uri;
    },
    [tRoot],
  );
}
