import { act, render, screen } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { ReactElement, ReactNode } from "react";
import { I18nProviderClient } from "@/locales/client";

const READY = "translations-ready";
// A test file's first render imports the whole dictionary cold, which took
// over a second on a busy CI runner, past findBy's 1 s default. Stay under
// vitest's 5 s test timeout so a load that never ends still fails here.
const DICTIONARY_TIMEOUT_MS = 4000;

const router: AppRouterInstance = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
};

/**
 * Renders a component on an app page, as under `/en/...`: Next's route
 * hooks read `url`, and the English dictionary is loaded. `rerender` keeps
 * the page.
 */
export async function renderOnPage(ui: ReactElement, url = "/en") {
  const { pathname, searchParams } = new URL(url, "http://localhost");
  const locale = pathname.split("/")[1] ?? "en";
  function Page({ children }: { children: ReactNode }) {
    return (
      <AppRouterContext.Provider value={router}>
        <PathnameContext.Provider value={pathname}>
          <SearchParamsContext.Provider value={searchParams}>
            <PathParamsContext.Provider value={{ locale }}>
              <I18nProviderClient locale={locale}>
                <span data-testid={READY} hidden />
                {children}
              </I18nProviderClient>
            </PathParamsContext.Provider>
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    );
  }

  // The dictionary provider suspends until the dictionary has loaded.
  const result = await act(async () => render(ui, { wrapper: Page }));
  await screen.findByTestId(READY, undefined, {
    timeout: DICTIONARY_TIMEOUT_MS,
  });
  return result;
}
