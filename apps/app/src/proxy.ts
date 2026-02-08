import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "es", "no", "ro"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

const isSignInPage = createRouteMatcher(["/login", "/register"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();
    const isSignIn = isSignInPage(request);
    const isInvitePage = request.nextUrl.pathname.startsWith("/invite/");
    const isPublic = isSignIn || isInvitePage;
    if (isSignIn && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    if (!isPublic && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/login");
    }

    return I18nMiddleware(request);
  },
  {
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
);

export const config = {
  // Match all routes except static assets
  // IMPORTANT: Must include /api/auth for Convex Auth to work
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
