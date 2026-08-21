export function isAdminPathname(pathname: string): boolean {
  return /^\/product\/(?:admin(?:\/|$)|h\/[^/]+\/admin(?:\/|$))/.test(pathname);
}
