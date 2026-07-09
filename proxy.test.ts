import { describe, expect, it } from "vitest";
import { isAdminPathname } from "./lib/adminRoutes";

describe("isAdminPathname", () => {
  it.each([
    "/product/admin",
    "/product/admin/ideas",
    "/product/h/demo/admin",
    "/product/h/demo/admin/ideas",
  ])("matches admin route %s", (pathname) => {
    expect(isAdminPathname(pathname)).toBe(true);
  });

  it.each([
    "/product",
    "/product/administrator",
    "/product/administer",
    "/product/h/demo",
    "/product/h/demo/administrator",
    "/product/h/demo/administer",
    "/product/h/admin",
    "/product/h//admin",
  ])("does not match non-admin route %s", (pathname) => {
    expect(isAdminPathname(pathname)).toBe(false);
  });
});
