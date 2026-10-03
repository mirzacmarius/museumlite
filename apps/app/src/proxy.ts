import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { createI18nMiddleware } from "next-international/middleware";
import {
  getLoginRedirectPath,
  getSignInRedirectPath,
  isInviteRoute,
  isSignInRoute,
} from "@/lib/locale-routes";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "es", "no", "ro"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();
    const pathname = request.nextUrl.pathname;
    const isSignIn = isSignInRoute(pathname);
    const isInvitePage = isInviteRoute(pathname);
    const isPublic = isSignIn || isInvitePage;
    if (isSignIn && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, getSignInRedirectPath(pathname));
    }
    if (!isPublic && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, getLoginRedirectPath(pathname));
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
