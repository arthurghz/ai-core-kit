// Nextra 3 i18n middleware (pages router, folder-based locales).
// Re-exports nextra/locales, which redirects `/` and unprefixed paths to the
// negotiated locale (cookie -> Accept-Language -> defaultLocale) so requests
// resolve to the matching pages/{locale}/ folder.
export { middleware } from 'nextra/locales'

export const config = {
  // Run on every path except Next internals, the API, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
