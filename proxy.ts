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
  if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/product");
  }
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
  if (isAdminRoute(request)) {
    const token = await convexAuth.getToken();
    if (!token) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
    const viewer = await fetchQuery(api.users.viewer, {}, { token });
    if (!viewer?.isAdmin) {
      return nextjsMiddlewareRedirect(request, "/product");
    }
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
