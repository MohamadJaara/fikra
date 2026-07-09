import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { isAdminPathname } from "@/lib/adminRoutes";

const isSignInPage = createRouteMatcher(["/signin"]);
const isProtectedRoute = createRouteMatcher(["/product(.*)"]);

const isAdminRoute = createRouteMatcher((request) =>
  isAdminPathname(request.nextUrl.pathname),
);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const token = await convexAuth.getToken();

  if (isSignInPage(request) && token) {
    const viewer = await fetchQuery(
      api.users.viewerOrNull,
      {},
      { token },
    ).catch(() => null);
    if (viewer) {
      return nextjsMiddlewareRedirect(request, "/product");
    }
    // Keep rejected or dangling authenticated sessions on the sign-in page so
    // they can sign out instead of bouncing forever between these two routes.
    return;
  }
  if (isAdminRoute(request)) {
    if (!token) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
    const viewer = await fetchQuery(api.users.viewer, {}, { token }).catch(
      () => null,
    );
    if (!viewer?.isAdmin) {
      return nextjsMiddlewareRedirect(request, "/product");
    }
    return;
  }
  if (isProtectedRoute(request) && !token) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
