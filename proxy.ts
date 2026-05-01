import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const isSignInPage = createRouteMatcher(["/signin"]);
const isProtectedRoute = createRouteMatcher(["/product(.*)"]);
const isAdminRoute = createRouteMatcher(["/product/admin(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const token = await convexAuth.getToken();

  if (isSignInPage(request) && token) {
    return nextjsMiddlewareRedirect(request, "/product");
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
